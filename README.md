# HIVE Roots

CAPA / quality complaint intelligence POC: historic case retrieval, guided Ai resolution (Why-Why → RCA → CA/PA), approval workflow, Ai chat, and configuration.

Stack: **React (Vite) + Express + PostgreSQL**.

---

## What it has

| Area | Description |
|------|-------------|
| **Auth** | Register / Login, Google SSO, Microsoft SSO (or local Microsoft POC login), MFA |
| **Dashboard** | CAPA stats and charts |
| **Ai-IIMS (Complaints)** | New Complaint wizard, All Complaints, Search History, Approval notifications |
| **New Complaint** | 3-step form (Details → Why-Why & RCA → CA/PA), Historic Records, Ai Suggested Solution (Generate → Review → Actions) |
| **Ai Chat** | Conversations with KB / CAPA context |
| **Ai Engine** | Smart Diagnostic, RCA Prediction, Analysis (Why-Why), CAPA recommendation pages |
| **Configuration** | Overview, Modules, Policy, Masters, Users, Audit Logs |
| **Settings** | Profile, Appearance, Ai models / behavior, Knowledge Base, uploads |
| **Theme** | Dark green HIVE branding, hover-expand sidebar |

---

## Application flow

### Login
1. Open frontend → `/login` (or `/register`)
2. Email/password **or** Continue with Google / Microsoft
3. Complete **MFA** (local POC default code is often `123456`; when `DEV_SHOW_OTP=true` the code is shown in UI / backend terminal)
4. Land on **Dashboard**

### New Complaint (main CAPA flow)
1. Sidebar → **Ai-IIMS → New Complaint**
2. **Step 1 – Complaint Details**  
   Type, severity, date, item, problem description, defect category, quantities, results to show → **Next**
3. Historic Records auto-match from the problem description; pick **Select as reference**
4. **Ai Suggested Solution**: Generate → Review Why-Why chain → Actions (CA/PA) → Save Resolution Draft into form fields
5. **Step 2 – Why-Why & RCA** → edit / pick Historic or Ai Suggested → **Next**
6. **Step 3 – CA / PA** → **Send Approval** (draft + notify Admin)
7. Track moves to **Approval sent**; Admin acts from **Approval** / notifications

### Other flows
- **All Complaints** — list, open detail, stage updates, uploads  
- **Search History** — find past cases  
- **Ai Chat** — ask against knowledge + CAPA context  
- **Configuration / Settings** — role-gated admin tooling  

---

## Prerequisites

- **Node.js** 18+ (20 recommended)
- **PostgreSQL** 14+
- npm (comes with Node)
- Optional: Google OAuth client + Microsoft Entra app (see [`docs/SSO_SETUP.md`](docs/SSO_SETUP.md))

---

## How to run (local)

### 1. Database
```bash
psql -U postgres -c "CREATE DATABASE hive_roots;"
psql -U postgres -d hive_roots -f database/schema.sql
```

Apply any files under `database/migrations/` if present after schema.

### 2. Backend
```bash
cd backend
copy .env.example .env
# Edit DATABASE_URL / JWT_SECRET if needed
npm install
npm run seed
npm run dev
```
API: **http://localhost:4000**

### 3. Frontend
```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```
UI: **http://localhost:5173**

Frontend proxies `/api` to the backend (see `VITE_API_URL` in `frontend/.env.example`).

---

## Dependencies

### Backend (`backend/package.json`)
- express, cors, dotenv, pg  
- jsonwebtoken, bcryptjs  
- multer, node-fetch  
- nodemon (dev)

### Frontend (`frontend/package.json`)
- react, react-dom, react-router-dom  
- vite, @vitejs/plugin-react (dev)

---

## Environment files

| File | Commit? | Purpose |
|------|---------|---------|
| `backend/.env.example` | Yes | Template for secrets |
| `frontend/.env.example` | Yes | `VITE_API_URL=/api` |
| `backend/.env` | **No** | Real DB URL, JWT, OAuth keys |
| `frontend/.env` | **No** | Local overrides |

Never commit real API keys, OAuth secrets, or production `JWT_SECRET`.

---

## What to push / what not to push

### Push
- `frontend/src/**`, `frontend/package.json`, `frontend/vite.config.*`, `frontend/index.html`, `frontend/.env.example`
- `backend/src/**`, `backend/package.json`, `backend/.env.example`
- `database/**` (schema + migrations)
- `docs/**`
- Root `README.md`, `.gitignore`
- Empty upload keepers such as `backend/uploads/.gitkeep`

### Do **not** push
- `node_modules/`
- `dist/` / build output
- `.env` / `.env.local` / any real secrets
- `backend/uploads/*` (user files)
- IDE folders (`.vscode/`, `.idea/`, `.cursor/`)
- Logs (`*.log`)

Covered by `.gitignore`.

---

## Git: create repo and push

From `c:\roots_poc\hive-roots` (PowerShell):

```powershell
# 1) Init
git init -b main

# 2) Stage (respects .gitignore)
git add .
git status

# 3) First commit
git commit -m "Initial commit: HIVE Roots CAPA POC"

# 4) Create empty GitHub repo named hive-roots (private recommended), then:
git remote add origin https://github.com/<ORG_OR_USER>/hive-roots.git
git push -u origin main
```

Using GitHub CLI (if logged in):

```powershell
gh repo create hive-roots --private --source=. --remote=origin --push
```

Replace `hive-roots` with `hive-roots-poc` if you prefer that name.

---

## Project layout

```
hive-roots/
  backend/          Express API
  frontend/         React + Vite UI
  database/         schema.sql + migrations
  docs/             SSO and setup notes
  README.md
  .gitignore
```

---

## Related docs

- [`docs/SSO_SETUP.md`](docs/SSO_SETUP.md) — Google / Microsoft OAuth and MFA
- [`backend/data/README.md`](backend/data/README.md) — local data notes
