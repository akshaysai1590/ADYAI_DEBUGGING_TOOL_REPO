-- ============================================================
-- ADHYANT: Secure RLS migration
-- Run this in Supabase Dashboard → SQL Editor.
--
-- WHAT THIS DOES
--   Drops the wide-open "FOR ALL USING (true)" policies that currently let
--   anyone with the public anon key read hidden answers and write to any
--   table. After this migration the browser (anon) key can ONLY:
--     - read contests, rounds, questions   (the public contest data)
--   Everything else — teams, drafts, submissions, violations, question_answers,
--   round_scores, run_logs, team_members, and ALL writes — is handled by
--   edge functions running on the SERVICE ROLE key (which bypasses RLS).
--
-- ⚠️  IMPORTANT: apply this TOGETHER with the frontend/edge-function changes.
--   Until participant writes (join, drafts, heartbeat, violations) and the
--   admin panel are routed through edge functions, applying this alone will
--   break those writes. Do not apply this to the live event until the routing
--   work is done.
-- ============================================================

-- 1. Drop the dangerous wide-open policies.
DROP POLICY IF EXISTS "Admin write rounds"    ON rounds;
DROP POLICY IF EXISTS "Admin write questions" ON questions;
DROP POLICY IF EXISTS "Admin write answers"   ON question_answers;
DROP POLICY IF EXISTS "Admin write teams"     ON teams;
DROP POLICY IF EXISTS "Allow insert submissions" ON submissions;
DROP POLICY IF EXISTS "Allow update submissions" ON submissions;
DROP POLICY IF EXISTS "Allow read submissions"    ON submissions;
DROP POLICY IF EXISTS "Allow insert violations"   ON violations;
DROP POLICY IF EXISTS "Allow all drafts"       ON drafts;
DROP POLICY IF EXISTS "Allow all round_scores" ON round_scores;
DROP POLICY IF EXISTS "Allow all run_logs"     ON run_logs;
DROP POLICY IF EXISTS "Allow all team_members" ON team_members;

-- 2. Re-assert the ONLY public reads participants need.
DROP POLICY IF EXISTS "Public read access to contests"  ON contests;
DROP POLICY IF EXISTS "Public read access to rounds"    ON rounds;
DROP POLICY IF EXISTS "Public read access to questions" ON questions;
CREATE POLICY "Public read access to contests"  ON contests  FOR SELECT USING (true);
CREATE POLICY "Public read access to rounds"    ON rounds    FOR SELECT USING (true);
CREATE POLICY "Public read access to questions" ON questions FOR SELECT USING (true);

-- 3. That's it. No other anon policies remain, so:
--    - question_answers  → hidden (service role only)  ✅ fixes "hidden answers are public"
--    - teams             → not readable by anon         ✅ fixes "everyone can read every PIN"
--    - submissions       → not readable by anon         (scoreboard must use an edge function/view)
--    - drafts / violations / round_scores / run_logs / team_members → edge-function only
--
-- The evaluate edge function already uses the service role key, so judging and
-- submissions keep working after this migration.
