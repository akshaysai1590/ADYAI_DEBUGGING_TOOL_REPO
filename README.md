# 🛡️ Adhyant Debugging Tool

A **live, timed debugging contest platform** where 30–100 teams race to fix buggy code across 5 programming languages. Built for college tech fests and coding competitions.

**Tech Stack:** React + Vite + TypeScript (Frontend) → Supabase (Database + Edge Functions) → AWS EC2 (Dockerized Code Execution)

---

## ⚡ Quick Start (New Laptop Setup)

```bash
# 1. Clone the repo
git clone https://github.com/akshaysai1590/Adyant_Debugging_Tool.git
cd Adyant_Debugging_Tool

# 2. Install frontend dependencies
cd frontend
npm install

# 3. Create .env file (copy from example)
cp .env.example .env

# 4. Start the dev server
npm run dev
```

Open `http://localhost:5173` → You're in!

---

## 🔐 All Credentials & Logins

### Frontend (Participant Login)
| Field | Value |
|---|---|
| URL | `http://localhost:5173/join` |
| Demo Team ID | `DBG42` |
| Demo PIN | `1234` |

### Admin Dashboard
| Field | Value |
|---|---|
| URL | `http://localhost:5173/admin/login` |
| Password | `adhyant2026` |

### Supabase (Database & Edge Functions)
| Field | Value |
|---|---|
| Project URL | `https://ztiifyaoxyeefxokqben.supabase.co` |
| Dashboard | `https://supabase.com/dashboard/project/ztiifyaoxyeefxokqben` |
| Project Ref | `ztiifyaoxyeefxokqben` |
| Anon Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWlmeWFveHllZWZ4b2txYmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzMwMjEsImV4cCI6MjEwNjM0OTAyMX0.ngeYVon4Gmq06ToDpFIjei5bh1j2YzT51fZCvQKKROY` |

### AWS EC2 (Code Execution Server)
| Field | Value |
|---|---|
| IP | `18.205.20.2` |
| Port | `2358` |
| Auth Token | `AdhyantSuperSecretToken123!` |
| Instance | Ubuntu `t3.small`, 30GB disk |
| Security Groups | Ports 22, 2358 open to `0.0.0.0/0` |
| SSH Key | `judge0-key.pem` (not in repo) |

### Supabase CLI (for deploying Edge Functions)
```bash
npx supabase login
# Use the access token from your Supabase dashboard
npx supabase functions deploy evaluate --no-verify-jwt
```

---

## 📁 Project Structure

```
Adyant_Debugging_Tool/
├── frontend/                          # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Join.tsx               # Team login (Team ID + PIN)
│   │   │   ├── Lobby.tsx              # Waiting room (polls for active round)
│   │   │   ├── Contest.tsx            # Monaco editor + language toggle + anti-cheat
│   │   │   ├── AdminLogin.tsx         # Admin password gate
│   │   │   ├── Admin.tsx              # Rounds, Questions, Teams management
│   │   │   └── Scoreboard.tsx         # Live leaderboard + projector mode
│   │   ├── lib/
│   │   │   ├── supabase.ts            # Supabase client init
│   │   │   └── questionTemplates.ts   # Multi-language question definitions
│   │   ├── store/
│   │   │   └── auth.ts               # Zustand auth store (persisted)
│   │   ├── App.tsx                    # Router
│   │   ├── main.tsx                   # Entry point
│   │   └── index.css                  # Dark theme + locked line styles
│   ├── .env.example                   # Copy to .env
│   └── package.json
│
├── supabase/
│   └── functions/
│       └── evaluate/
│           └── index.ts               # Edge Function: sends code to AWS, compares output
│
├── server/
│   └── runner.py                      # AWS runner: executes code in Docker containers
│
├── phase1_schema.sql                  # Full database schema + RLS policies
├── context.md                         # AI agent context (read this to understand the project)
└── README.md                          # This file
```

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Browser    │────▶│  Supabase Edge Fn    │────▶│  AWS EC2        │
│  (React App) │     │  evaluate()          │     │  runner.py      │
│              │◀────│                      │◀────│  Docker sandbox │
└──────────────┘     └──────────────────────┘     └─────────────────┘
       │                      │
       │              ┌───────┴────────┐
       │              │  Supabase DB   │
       └─────────────▶│  (PostgreSQL)  │
                      │  teams, rounds │
                      │  questions,    │
                      │  submissions   │
                      └────────────────┘
```

**Flow:** Browser → Supabase Edge Function → AWS Docker → Compare output → Return result

---

## 🔧 What's Done vs TODO

### ✅ Completed
- [x] AWS code execution server (Python, JS, C, C++, Java)
- [x] Database schema with RLS policies
- [x] Team Join page with real Supabase auth
- [x] Lobby with live round polling
- [x] Contest page with Monaco editor
- [x] **Multi-language toggle** (5 languages per question)
- [x] Locked line enforcement (anti-cheat)
- [x] Tab-switch detection + violation logging
- [x] Auto-draft saving per question per language
- [x] Admin dashboard (Rounds, Questions, Teams)
- [x] Bulk team generation + CSV export
- [x] Live scoreboard with projector mode
- [x] Edge Function for code evaluation

### 🔲 TODO
- [ ] Add more contest questions (currently 3 hardcoded demo questions)
- [ ] Admin: dynamically create multi-language question variants from the dashboard
- [ ] Fullscreen enforcement (force participants into fullscreen)
- [ ] Anti-cheat: diff guard (detect if locked lines were modified)
- [ ] Supabase Realtime (replace polling with instant WebSocket pushes)
- [ ] Deploy frontend to Vercel for production
- [ ] Styled CSS polish (dark theme refinements)
- [ ] Contest timer sync from server (currently client-side)

---

## 🚀 Deploying Edge Functions

```bash
cd Adyant_Debugging_Tool
npx supabase login
npx supabase link --project-ref ztiifyaoxyeefxokqben
npx supabase functions deploy evaluate --no-verify-jwt
```

---

## 🖥️ AWS Runner Setup

If the AWS runner dies or you need to restart it:

```bash
ssh -i judge0-key.pem ubuntu@18.205.20.2

# Pull all required Docker images
sudo docker pull python:3-slim
sudo docker pull node:18-slim
sudo docker pull gcc:latest
sudo docker pull eclipse-temurin:17

# Copy server/runner.py to ~/runner.py on the instance, then:
nohup python3 ~/runner.py > ~/runner.log 2>&1 &

# Verify it's running
curl http://localhost:2358/languages
```

---

## 📝 License

Built by Akshay Sai for the Adhyant college tech fest debugging contest.
