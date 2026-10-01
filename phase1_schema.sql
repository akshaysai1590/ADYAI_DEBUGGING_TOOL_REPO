-- ==========================================
-- ADHYANT DEBUGGING CONTEST - SUPABASE SCHEMA
-- ==========================================

-- 1. Contests & Rounds
CREATE TABLE contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    name TEXT NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 1800,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended')),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    scores_revealed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT UNIQUE NOT NULL, -- e.g., 'DBG42'
    pin_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disqualified')),
    session_token TEXT UNIQUE,
    session_created_at TIMESTAMPTZ,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL
);

-- 3. Questions (Publicly readable by teams)
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    title TEXT NOT NULL,
    buggy_code TEXT NOT NULL,
    editable_line_ranges JSONB NOT NULL, -- e.g., [[3,7], [12,15]]
    marks INT NOT NULL DEFAULT 10,
    display_order INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Answers (STRICTLY HIDDEN - Edge Functions only)
CREATE TABLE question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    expected_output TEXT NOT NULL
);

-- 5. Code Drafts (Autosaves)
CREATE TABLE drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, question_id)
);

-- 6. Submissions & Scoring
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    marks_awarded INT DEFAULT 0,
    time_bonus INT DEFAULT 0,
    run_attempt_count INT DEFAULT 0,
    diff_ratio FLOAT,
    auto_submitted BOOLEAN DEFAULT FALSE,
    locked BOOLEAN DEFAULT TRUE,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, question_id)
);

CREATE TABLE round_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    total_score INT DEFAULT 0,
    total_time_bonus INT DEFAULT 0,
    submission_time TIMESTAMPTZ, -- for tie-breaks
    UNIQUE(team_id, round_id)
);

-- 7. Logs & Anti-Cheat
CREATE TABLE run_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    is_pass BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Service Role (Edge Functions) can bypass all RLS automatically.

-- Allow public read access to contests, rounds, and questions
CREATE POLICY "Public read access to contests" ON contests FOR SELECT USING (true);
CREATE POLICY "Public read access to rounds" ON rounds FOR SELECT USING (true);
CREATE POLICY "Public read access to questions" ON questions FOR SELECT USING (true);

-- No public policies for question_answers. It remains strictly hidden.

-- Allow teams to read only their own data
-- (Note: In Phase 2, we will add a custom JWT claim check here. For now, this is a placeholder structure)
