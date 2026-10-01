import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Team-scoped operations during the contest. Every call is authenticated by
// the session token issued by the `join` function, so a team cannot write as
// another team (closes the team-spoofing hole).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { action, team_id, session_token, ...rest } = await req.json();

    if (!team_id || !session_token) {
      return json({ success: false, error: "Missing team_id or session_token" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: team } = await supabase
      .from("teams")
      .select("session_token, status")
      .eq("id", team_id)
      .maybeSingle();
    if (!team) return json({ success: false, error: "Team not found" }, 404);
    if (team.status === "disqualified") return json({ success: false, error: "Disqualified" }, 403);
    if (team.session_token !== session_token) return json({ success: false, error: "Invalid session" }, 401);

    switch (action) {
      case "save_draft": {
        const { question_id, code } = rest;
        if (!question_id || typeof code !== "string") {
          return json({ success: false, error: "question_id and code required" }, 400);
        }
        await supabase.from("drafts").upsert(
          { team_id, question_id, code, updated_at: new Date().toISOString() },
          { onConflict: "team_id,question_id" },
        );
        return json({ success: true });
      }

      case "get_draft": {
        const { question_id } = rest;
        const { data } = await supabase
          .from("drafts").select("code")
          .eq("team_id", team_id).eq("question_id", question_id)
          .maybeSingle();
        return json({ success: true, code: data?.code ?? null });
      }

      case "get_my_submissions": {
        const { data } = await supabase
          .from("submissions")
          .select("question_id, is_correct, marks_awarded")
          .eq("team_id", team_id);
        return json({ success: true, submissions: data ?? [] });
      }

      case "set_language": {
        const { language } = rest;
        if (!language) return json({ success: false, error: "language required" }, 400);
        await supabase.from("teams").update({ selected_language: language }).eq("id", team_id);
        return json({ success: true });
      }

      case "delete_draft": {
        const { question_id } = rest;
        if (!question_id) return json({ success: false, error: "question_id required" }, 400);
        await supabase.from("drafts").delete().eq("team_id", team_id).eq("question_id", question_id);
        return json({ success: true });
      }

      case "heartbeat": {
        await supabase.from("teams").update({
          current_page: typeof rest.current_page === "string" ? rest.current_page : "contest",
          last_seen_at: new Date().toISOString(),
        }).eq("id", team_id);
        return json({ success: true });
      }

      case "log_violation": {
        const { violation_type, details } = rest;
        if (!violation_type) return json({ success: false, error: "violation_type required" }, 400);
        await supabase.from("violations").insert({ team_id, violation_type, details });
        return json({ success: true });
      }

      case "logout": {
        await supabase.from("teams").update({ current_page: "offline", session_token: null }).eq("id", team_id);
        return json({ success: true });
      }

      case "team_count": {
        const { count } = await supabase.from("teams").select("*", { count: "exact", head: true });
        return json({ success: true, count: count ?? 0 });
      }

      default:
        return json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: msg }, 500);
  }
});
