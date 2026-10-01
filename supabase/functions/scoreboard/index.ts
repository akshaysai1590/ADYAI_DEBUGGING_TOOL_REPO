import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side leaderboard. Computed here (on the service role) so the browser
// never needs direct read access to teams/submissions after RLS is locked down.
//
// Tie-break: score desc → solved count desc → earliest "finish time"
// (the time of the team's LAST correct submission) wins.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    const roundId = url.searchParams.get("round_id"); // null = overall

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const [teamsRes, subsRes] = await Promise.all([
      supabase.from("teams").select("id, team_id, display_name, status"),
      supabase.from("submissions").select("team_id, question_id, is_correct, marks_awarded, submitted_at, questions(round_id)"),
    ]);

    const teams = teamsRes.data ?? [];
    const subs = subsRes.data ?? [];

    const map = new Map<string, any>();
    for (const t of teams) {
      map.set(t.id, {
        team_id_str: t.team_id,
        display_name: t.display_name || t.team_id,
        status: t.status || "active",
        score: 0,
        solved_count: 0,
        finish_time: null as string | null,
      });
    }

    for (const s of subs) {
      const qRoundId = (s.questions as any)?.round_id;
      if (roundId && qRoundId !== roundId) continue;
      const entry = map.get(s.team_id);
      if (!entry || !s.is_correct) continue;
      entry.score += s.marks_awarded || 10;
      entry.solved_count += 1;
      if (s.submitted_at && (!entry.finish_time || new Date(s.submitted_at) > new Date(entry.finish_time))) {
        entry.finish_time = s.submitted_at;
      }
    }

    const leaderboard = Array.from(map.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.solved_count !== a.solved_count) return b.solved_count - a.solved_count;
      if (a.finish_time && b.finish_time) return new Date(a.finish_time).getTime() - new Date(b.finish_time).getTime();
      if (a.finish_time) return -1;
      if (b.finish_time) return 1;
      return 0;
    });

    return json({ success: true, leaderboard });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: msg }, 500);
  }
});
