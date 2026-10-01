-- ==========================================
-- ADHYANT: Add write policies for admin ops
-- Run this in Supabase Dashboard → SQL Editor
-- ==========================================

-- ROUNDS: allow anon to insert, update, delete
CREATE POLICY "Admin write rounds" ON rounds
  FOR ALL USING (true) WITH CHECK (true);

-- QUESTIONS: allow anon to insert, update, delete
CREATE POLICY "Admin write questions" ON questions
  FOR ALL USING (true) WITH CHECK (true);

-- QUESTION_ANSWERS: allow anon to insert, delete
CREATE POLICY "Admin write answers" ON question_answers
  FOR ALL USING (true) WITH CHECK (true);

-- TEAMS: allow anon to insert, update, delete
CREATE POLICY "Admin write teams" ON teams
  FOR ALL USING (true) WITH CHECK (true);

-- SUBMISSIONS: allow anon to insert, update
CREATE POLICY "Allow insert submissions" ON submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update submissions" ON submissions
  FOR UPDATE USING (true);

CREATE POLICY "Allow read submissions" ON submissions
  FOR SELECT USING (true);

-- VIOLATIONS: allow anon to insert
CREATE POLICY "Allow insert violations" ON violations
  FOR INSERT WITH CHECK (true);

-- CONTESTS: allow anon to read (already exists, keep)
-- (already created in phase1_schema.sql)
