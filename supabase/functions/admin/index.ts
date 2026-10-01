import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_SECRET = Deno.env.get("ADHYANT_ADMIN_SECRET") ?? "";
const PEPPER = Deno.env.get("ADHYANT_PIN_PEPPER") ?? "";
const CONTEST_ID = "11111111-1111-1111-1111-111111111111";

async function pinHash(teamId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${PEPPER}:${teamId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { action, payload, admin_secret } = await req.json();

    if (!ADMIN_SECRET || admin_secret !== ADMIN_SECRET) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const p: Record<string, any> = payload ?? {};

    switch (action) {
      // ── Lightweight auth check (used by the admin login screen) ──────────
      case "ping":
        return json({ success: true });

      // ── Read everything the admin dashboard needs ────────────────────────
      case "list": {
        const [r, q, t, v, s] = await Promise.all([
          supabase.from("rounds").select("*").eq("contest_id", CONTEST_ID).order("round_number"),
          supabase.from("questions").select("*").order("display_order"),
          supabase.from("teams").select("*").order("created_at"),
          supabase.from("violations").select("*"),
          supabase.from("submissions").select("*"),
        ]);
        return json({
          success: true,
          rounds: r.data ?? [],
          questions: q.data ?? [],
          teams: t.data ?? [],
          violations: v.data ?? [],
          submissions: s.data ?? [],
        });
      }

      // ── Rounds ───────────────────────────────────────────────────────────
      case "add_round": {
        const name = String(p.name ?? "").trim();
        if (!name) return json({ success: false, error: "Round name is required" }, 400);
        const duration = parseInt(p.duration) || 1800;
        const { data: existing } = await supabase
          .from("rounds").select("round_number").eq("contest_id", CONTEST_ID);
        const num = (existing?.length ? Math.max(...existing.map((r: any) => r.round_number)) : 0) + 1;
        const { data, error } = await supabase
          .from("rounds")
          .insert({ contest_id: CONTEST_ID, round_number: num, name, duration_seconds: duration, status: "pending" })
          .select().single();
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true, round: data });
      }

      case "delete_round": {
        const { error } = await supabase.from("rounds").delete().eq("id", p.id);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true });
      }

      case "start_round": {
        // End any other active round first.
        await supabase.from("rounds").update({ status: "ended", ends_at: new Date().toISOString() })
          .eq("contest_id", CONTEST_ID).eq("status", "active").neq("id", p.id);
        const { error } = await supabase.from("rounds").update({ status: "active", starts_at: new Date().toISOString() }).eq("id", p.id);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true });
      }

      case "stop_round": {
        const { error } = await supabase.from("rounds").update({ status: "ended", ends_at: new Date().toISOString() }).eq("id", p.id);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true });
      }

      case "reveal_scores": {
        const { error } = await supabase.from("rounds").update({ scores_revealed: true }).eq("id", p.id);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true });
      }

      case "reset_round": {
        const { error } = await supabase.from("rounds").update({ status: "pending", starts_at: null, ends_at: null, scores_revealed: false }).eq("id", p.id);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true });
      }

      // ── Questions ────────────────────────────────────────────────────────
      case "add_question": {
        const title = String(p.title ?? "").trim();
        const buggy = String(p.buggy_code ?? "");
        const expected = String(p.expected_output ?? "");
        if (!p.round_id || !title || !buggy || expected === "") {
          return json({ success: false, error: "round_id, title, buggy_code and expected_output are required" }, 400);
        }
        let ranges: unknown = p.editable_line_ranges;
        if (typeof ranges === "string") {
          try { ranges = JSON.parse(ranges); } catch { return json({ success: false, error: "Invalid editable_line_ranges JSON" }, 400); }
        }
        const { data: qs } = await supabase.from("questions").select("display_order").eq("round_id", p.round_id);
        const order = (qs?.length ?? 0) + 1;
        const { data, error } = await supabase
          .from("questions")
          .insert({
            round_id: p.round_id,
            language: p.language ?? "python",
            title,
            buggy_code: buggy,
            editable_line_ranges: ranges,
            marks: parseInt(p.marks) || 10,
            display_order: order,
          })
          .select().single();
        if (error) return json({ success: false, error: error.message }, 400);
        await supabase.from("question_answers").insert({ question_id: data.id, expected_output: expected });
        return json({ success: true, question: data });
      }

      case "delete_question": {
        await supabase.from("question_answers").delete().eq("question_id", p.id);
        const { error } = await supabase.from("questions").delete().eq("id", p.id);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true });
      }

      // ── Teams ────────────────────────────────────────────────────────────
      case "add_team": {
        const teamId = String(p.team_id ?? "").trim().toUpperCase();
        const pin = String(p.pin ?? "").trim();
        if (!teamId || !pin) return json({ success: false, error: "Team ID and PIN required" }, 400);
        const display = String(p.display_name ?? "").trim() || teamId;
        const { error } = await supabase.from("teams").insert({
          team_id: teamId,
          pin_hash: await pinHash(teamId, pin),
          display_name: display,
          status: "active",
        });
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true, team: { team_id: teamId, pin, display_name: display } });
      }

      case "generate_teams": {
        const prefix = String(p.prefix ?? "DBG").toUpperCase();
        const count = Math.min(Math.max(parseInt(p.count) || 10, 1), 200);
        const rows: any[] = [];
        const plain: any[] = [];
        for (let i = 1; i <= count; i++) {
          const teamId = `${prefix}${String(i).padStart(2, "0")}`;
          const pin = generatePin();
          rows.push({ team_id: teamId, pin_hash: await pinHash(teamId, pin), display_name: teamId, status: "active" });
          plain.push({ team_id: teamId, pin, display_name: teamId });
        }
        const { error } = await supabase.from("teams").insert(rows);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true, teams: plain });
      }

      case "delete_team": {
        const { error } = await supabase.from("teams").delete().eq("id", p.id);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true });
      }

      case "delete_all_teams": {
        const { error } = await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true });
      }

      case "toggle_disqualify": {
        const newStatus = p.status === "active" ? "disqualified" : "active";
        const { error } = await supabase.from("teams").update({ status: newStatus }).eq("id", p.id);
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true, status: newStatus });
      }

      default:
        return json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: msg }, 500);
  }
});
