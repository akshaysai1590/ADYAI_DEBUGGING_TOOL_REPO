import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDGE_URL = Deno.env.get("ADHYANT_JUDGE_URL") ?? "http://18.205.20.2:2358";
const JUDGE_TOKEN = Deno.env.get("ADHYANT_JUDGE_TOKEN") ?? "AdhyantSuperSecretToken123!";
const JUDGE_TIMEOUT_MS = 20000; // abort if the runner doesn't respond in 20s

const LANG_IDS: Record<string, number> = {
  python: 71,
  javascript: 93,
  java: 62,
  c: 50,
  cpp: 54,
};

// ── In-memory per-team rate limit (approximate; isolates can recycle) ───────
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_RUNS = 20;
const teamRunTimestamps = new Map<string, number[]>();

function rateLimited(teamId: string): boolean {
  const now = Date.now();
  const arr = (teamRunTimestamps.get(teamId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX_RUNS) {
    teamRunTimestamps.set(teamId, arr);
    return true;
  }
  arr.push(now);
  teamRunTimestamps.set(teamId, arr);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const fail = (obj: Record<string, unknown>, status = 400) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { question_id, team_id, session_token, code, language, action } = await req.json();

    if (!question_id || !team_id || !session_token || typeof code !== "string" || !language || !action) {
      return fail({ success: false, error: "Missing required fields" });
    }
    if (!(language in LANG_IDS)) {
      return fail({ success: false, error: `Unsupported language: ${language}` });
    }
    if (action !== "run" && action !== "submit") {
      return fail({ success: false, error: "Invalid action" });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Verify the team exists, isn't disqualified, and the session matches.
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, status, session_token")
      .eq("id", team_id)
      .maybeSingle();
    if (!team) return fail({ success: false, error: "Team not found" });
    if (team.status === "disqualified") return fail({ success: false, error: "Team disqualified" });
    if (team.session_token !== session_token) return fail({ success: false, error: "Invalid session" }, 401);

    // 2. Per-team rate limit.
    if (rateLimited(team_id)) {
      return fail({ success: false, error: "Too many requests, slow down" }, 429);
    }

    // 3. Fetch the question (for marks) and its hidden answer.
    const { data: qData } = await supabaseAdmin
      .from("questions")
      .select("id, marks, round_id")
      .eq("id", question_id)
      .maybeSingle();
    if (!qData) return fail({ success: false, error: "Question not found" });

    const { data: answerData } = await supabaseAdmin
      .from("question_answers")
      .select("expected_output")
      .eq("question_id", question_id)
      .maybeSingle();
    if (!answerData || answerData.expected_output == null || answerData.expected_output.trim() === "") {
      return fail({ success: false, error: "Question has no answer configured" });
    }
    const expectedOutput = answerData.expected_output.trim();

    // 4. Execute on the runner, with a hard timeout.
    let actualOutput = "";
    let errorMessage = "";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
      const awsReq = await fetch(`${JUDGE_URL}/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": JUDGE_TOKEN,
        },
        body: JSON.stringify({ source_code: code, language_id: LANG_IDS[language] }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const awsRes = await awsReq.json();
      if (awsRes.status?.id === 3) {
        actualOutput = (awsRes.stdout ?? "").trim();
      } else {
        errorMessage = (awsRes.stderr ?? awsRes.compile_output ?? awsRes.message ?? "Execution error").trim();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errorMessage = "Could not reach execution server: " + msg;
    }

    if (errorMessage) {
      // NOTE: this MUST stay HTTP 200 — the body carries success:true and the
      // frontend treats any success:false body as a throw. A 4xx status here
      // would break every status-based client while looking identical.
      return new Response(
        JSON.stringify({ success: true, is_correct: false, error_details: errorMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let isCorrect = actualOutput === expectedOutput;

    // 5. Log the run (best effort — never let logging break scoring).
    try {
      await supabaseAdmin.from("run_logs").insert({
        team_id,
        question_id,
        is_pass: isCorrect,
      });
    } catch (_) {
      // ignore
    }

    // 6. On submit, persist the result with the question's real marks and a
    //    correct onConflict target so re-submitting doesn't 400-crash. Never let
    //    a wrong re-submit overwrite an already-correct answer.
    if (action === "submit") {
      const { data: existing } = await supabaseAdmin
        .from("submissions")
        .select("is_correct")
        .eq("team_id", team_id)
        .eq("question_id", question_id)
        .maybeSingle();
      const finalCorrect = isCorrect || existing?.is_correct === true;
      await supabaseAdmin.from("submissions").upsert(
        {
          team_id,
          question_id,
          code,
          is_correct: finalCorrect,
          marks_awarded: finalCorrect ? qData.marks ?? 10 : 0,
          locked: true,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "team_id,question_id" },
      );
      isCorrect = finalCorrect;
    }

    return new Response(
      JSON.stringify({ success: true, is_correct: isCorrect, actual_output: actualOutput }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return fail({ success: false, error: msg });
  }
});
