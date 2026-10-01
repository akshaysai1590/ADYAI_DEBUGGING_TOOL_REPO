-- ==========================================
-- ADHYANT: Schema additions for real-time sync
-- Run this in Supabase Dashboard → SQL Editor
-- ==========================================

-- 1. Add presence columns to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS current_page TEXT DEFAULT 'offline';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS selected_language TEXT;

-- 2. Enable realtime on key tables (required for Supabase Realtime subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE violations;

-- 3. RLS policies for drafts table
CREATE POLICY "Allow all drafts" ON drafts FOR ALL USING (true) WITH CHECK (true);

-- 4. RLS for round_scores
CREATE POLICY "Allow all round_scores" ON round_scores FOR ALL USING (true) WITH CHECK (true);

-- 5. RLS for run_logs
CREATE POLICY "Allow all run_logs" ON run_logs FOR ALL USING (true) WITH CHECK (true);

-- 6. RLS for team_members
CREATE POLICY "Allow all team_members" ON team_members FOR ALL USING (true) WITH CHECK (true);
