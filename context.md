# Adhyant Debugging Tool — Full Project Context for AI Agents

> **READ THIS FIRST.** This document contains everything an AI assistant needs to understand, modify, and extend this project. It was written specifically for continuing development across different machines and chat sessions.

---

## 1. What This Project IS

A **live debugging contest platform** for college tech fests. Teams of students sit at computers, receive buggy code, and race to fix the bugs within a time limit. Think "competitive debugging" — like a hackathon but instead of building, participants are debugging pre-written broken code.

**Target scale:** 30–100 concurrent teams, 3–5 rounds of 15–30 minutes each, 1 computer per team.

---

## 2. Architecture (Three-Tier)

```
FRONTEND (React/Vite/TS)  ──▶  BACKEND (Supabase)  ──▶  EXECUTION (AWS EC2)
   localhost:5173                 PostgreSQL + Edge Fn     Docker containers
   or Vercel deploy              ztiifyaoxyeefxokqben     18.205.20.2:2358
```

### Frontend: `frontend/`
- **Framework:** React 19 + Vite + TypeScript
- **State:** Zustand with `persist` middleware (localStorage)
- **Editor:** Monaco Editor (`@monaco-editor/react`)
- **Styling:** Inline styles + CSS variables in `index.css` (dark theme)
- **No CSS framework** — all styling is inline `style={{}}` objects

### Backend: Supabase
- **Database:** PostgreSQL with Row Level Security (RLS)
- **Auth:** NOT using Supabase Auth. Custom team-based auth via `teams` table (team_id + pin_hash)
- **Edge Functions:** One function `evaluate` deployed with `--no-verify-jwt`
- **Realtime:** NOT used yet (currently polling every 3 seconds in Lobby)

### Execution Server: AWS EC2
- **Instance:** Ubuntu `t3.small`, 30GB disk, IP `18.205.20.2`
- **Runner:** Python HTTP server (`server/runner.py`) on port 2358
- **Sandboxing:** Each code submission runs in an isolated Docker container with `--network=none --memory=256m --cpus=1`
- **Supported languages and Docker images:**
  - Python 3 → `python:3-slim`
  - JavaScript → `node:18-slim`
  - C → `gcc:latest`
  - C++ → `gcc:latest`
  - Java → `eclipse-temurin:17`
- **Auth:** `X-Auth-Token: AdhyantSuperSecretToken123!` header required

---

## 3. Database Schema (Supabase PostgreSQL)

Full schema is in `phase1_schema.sql`. Key tables:

| Table | Purpose | RLS |
|---|---|---|
| `contests` | Top-level contest record | Read: public |
| `rounds` | Rounds within a contest (status: pending/active/ended) | Read: public |
| `teams` | Team credentials (team_id, pin_hash, display_name, status) | Read: public |
| `questions` | Buggy code for each round (title, buggy_code, editable_line_ranges, language) | Read: public |
| `question_answers` | **HIDDEN** expected output — only accessible via Edge Function using service role | **No public access** |
| `submissions` | Team submissions with is_correct, marks_awarded, locked status | Read: own team only |
| `violations` | Anti-cheat violation logs (tab_switch events) | Insert: any, Read: none |
| `team_members` | Optional member names per team | — |

### Important UUIDs (Seed Data)
- Contest: `11111111-1111-1111-1111-111111111111`
- Round: `22222222-2222-2222-2222-222222222222`
- Test Team: `33333333-3333-3333-3333-333333333333` (team_id: `DBG42`, pin: `1234`)
- Question 1: `44444444-4444-4444-4444-444444444444` (Buggy Greeting)
- Question 2: `55555555-5555-5555-5555-555555555555` (Array Sum)
- Question 3: `66666666-6666-6666-6666-666666666666` (Even or Odd)

---

## 4. Page-by-Page Breakdown

### `/join` → `Join.tsx`
- Team enters Team ID, PIN, optional Display Name
- Validates against Supabase `teams` table
- Fallback: PIN `1234` always works for demo mode
- Stores auth in Zustand (persisted to localStorage)
- Links to `/scoreboard` and `/admin/login` at bottom

### `/lobby` → `Lobby.tsx`
- Polls Supabase `rounds` table every 3 seconds for `status = 'active'`
- Shows "Waiting for Next Round" or green "Enter Debugging Sandbox" button
- Shows connected teams count and revealed round scores
- Displays contest rules sidebar

### `/contest` → `Contest.tsx` ⭐ (Main feature)
- **Left sidebar:** Question list with status (points or LOCKED)
- **Top toolbar:** Language toggle `[🐍 Python] [🟨 JS] [☕ Java] [🔷 C] [⚡ C++]` + Run/Reset/Submit buttons
- **Center:** Monaco editor with locked lines (gray background, keystrokes blocked) and editable lines (purple left border)
- **Bottom:** Execution result drawer (RUNNING → ACCEPTED/FAILED/ERROR)
- **Anti-cheat:**
  - Tab switch detection → modal warning + logged to `violations` table
  - Paste detection → alert warning
  - Locked lines → keystrokes blocked outside editable ranges
  - beforeunload → confirmation dialog
- **State management:**
  - `editableRangesRef` (useRef) — avoids stale closure bugs in Monaco's onKeyDown
  - `decorationsRef` (useRef) — properly clears old decorations when switching languages
  - LocalStorage drafts per `teamId_questionId_language`
- **Code execution flow:**
  1. Direct `fetch()` to Supabase Edge Function (NOT using `supabase.functions.invoke` — that caused opaque error objects)
  2. Edge Function reads hidden `expected_output` from `question_answers` table
  3. Edge Function forwards code to AWS runner
  4. AWS runner executes in Docker, returns stdout
  5. Edge Function compares stdout with expected_output
  6. Returns `{ is_correct: true/false }` to browser
  7. Browser shows alert popup + result drawer

### `/admin/login` → `AdminLogin.tsx`
- Password: `adhyant2026`
- Sets `isAdmin: true` in Zustand store

### `/admin` → `Admin.tsx`
- **Rounds tab:** Add rounds (name + duration), Start/Stop rounds (one-click), Reveal Scores
- **Questions tab:** Add questions with buggy code, editable line ranges JSON, expected output, language, marks. Delete questions.
- **Teams tab:** Bulk generate N teams with random 4-digit PINs, Export CSV, Delete All

### `/scoreboard` → `Scoreboard.tsx`
- Auto-refreshes every 5 seconds
- Top 3 podium visualization (Gold/Silver/Bronze cards)
- Round-by-round filtering tabs
- Projector Mode (fullscreen)
- Tie-breaking: higher score → more solved → earlier last submission time

---

## 5. Multi-Language System

**File:** `frontend/src/lib/questionTemplates.ts`

Each question has 5 `variants` (one per language). Each variant has:
- `buggy_code` — the same logic bug expressed in that language's syntax
- `editable_line_ranges` — which lines are unlocked (different per language due to syntax)
- `monacoLang` — Monaco editor language mode

When a participant switches language:
1. `selectedLang` state updates
2. `currentVariant` recomputes
3. `editableRangesRef` updates (so keystroke blocker uses correct ranges)
4. `decorationsRef` clears old decorations, applies new ones
5. LocalStorage draft for that language loads (or falls back to template)

**Currently:** 3 hardcoded questions in `questionTemplates.ts` (Buggy Greeting, Array Sum, Even or Odd). Each has all 5 language variants.

**TODO:** Admin dashboard should allow creating multi-language variants dynamically.

---

## 6. Edge Function: `supabase/functions/evaluate/index.ts`

```
POST /functions/v1/evaluate
Body: { question_id, team_id, code, language, action: 'run'|'submit' }
```

- Uses `SUPABASE_SERVICE_ROLE_KEY` (auto-injected) to read `question_answers`
- Maps language string to numeric ID: python=71, javascript=93, java=62, c=50, cpp=54
- Calls `http://18.205.20.2:2358/submissions` with source_code and language_id
- Compares `stdout.trim()` with `expected_output.trim()`
- If `action === 'submit'`: upserts into `submissions` table
- Returns `{ success: true, is_correct: true/false, actual_output: "..." }`
- Deployed with `--no-verify-jwt` (no auth required for the function itself, but anon key sent in Authorization header)

---

## 7. Critical Lessons Learned (DO NOT Repeat These Mistakes)

### ❌ Judge0 CE v1.13.1 DOES NOT WORK on modern Ubuntu
- Requires cgroups v1 but Ubuntu uses cgroups v2
- The `isolate` sandbox cannot create `/box/script.py`
- GRUB kernel parameter fix (`systemd.unified_cgroup_hierarchy=0`) did NOT work
- **We replaced Judge0 with a custom Python runner. DO NOT attempt Judge0 again.**

### ❌ Piston API is DEAD
- `https://emkc.org/api/v2/piston/execute` returns `"Public Piston API is now whitelist only as of 2/15/2026"`
- DO NOT use as failover

### ❌ `supabase.functions.invoke()` wraps errors in opaque objects
- When the Edge Function returns non-200, the SDK wraps the error in a `FunctionsHttpError` object
- `error.message` doesn't work as expected
- **We bypass the SDK entirely and use raw `fetch()` to the Edge Function URL**

### ❌ Monaco `onDidPaste` event does NOT have `preventDefault()`
- Monaco's paste event is not a DOM event — it's a Monaco range event
- Calling `e.preventDefault()` crashes with `TypeError: e.preventDefault is not a function`
- **We just show an `alert()` warning instead**

### ❌ Monaco `onKeyDown` captures stale closures
- If you reference React state inside Monaco's `onKeyDown`, it captures the value at mount time
- When language switches change the editable ranges, the keystroke blocker still uses the old ranges
- **We use `useRef` for `editableRangesRef` and read `.current` inside the callback**

### ❌ `deltaDecorations` accumulates if you don't pass old IDs
- Calling `editor.deltaDecorations([], newDecorations)` every time causes decorations to pile up
- **We store decoration IDs in `decorationsRef` and pass them: `editor.deltaDecorations(decorationsRef.current, newDecorations)`**

### ❌ PostgreSQL UUID type only accepts hex chars
- Using `r1111...` or `c1111...` causes `invalid input syntax for type uuid`
- **Use `11111111-...`, `22222222-...`, etc.**

### ❌ `openjdk:17-slim` Docker image was discontinued
- Use `eclipse-temurin:17` instead

---

## 8. Environment & Keys Summary

```
# Frontend .env
VITE_SUPABASE_URL=https://ztiifyaoxyeefxokqben.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AWS Runner
IP: 18.205.20.2
Port: 2358
Auth: X-Auth-Token: AdhyantSuperSecretToken123!

# Supabase Edge Function
Deployed at: https://ztiifyaoxyeefxokqben.supabase.co/functions/v1/evaluate
Deploy command: npx supabase functions deploy evaluate --no-verify-jwt

# Admin Dashboard
Password: adhyant2026

# Demo Team Login
Team ID: DBG42, PIN: 1234
```

---

## 9. Development Workflow

```bash
# Start frontend dev server
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Deploy Edge Function (after changes to supabase/functions/evaluate/index.ts)
npx supabase functions deploy evaluate --no-verify-jwt

# Check AWS runner status
curl http://18.205.20.2:2358/languages

# Test code execution directly
curl -X POST http://18.205.20.2:2358/submissions \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: AdhyantSuperSecretToken123!" \
  -d '{"source_code": "print(\"Hello, World\")", "language_id": 71}'
```

---

## 10. What to Work on Next (Priority Order)

1. **Admin multi-language question creation** — Let admin create one question and define buggy code for each of the 5 languages from the dashboard UI, instead of hardcoding in `questionTemplates.ts`
2. **Fullscreen enforcement** — Force participants into fullscreen mode and log violations if they exit
3. **Supabase Realtime** — Replace 3-second polling in Lobby with WebSocket subscription for instant round start notifications
4. **Deploy frontend to Vercel** — Currently only runs on `localhost:5173`
5. **CSS polish** — The dark theme works but could use refinement
6. **Timer server-sync** — Currently the countdown timer is purely client-side; should sync with server `starts_at` + `duration_seconds`
