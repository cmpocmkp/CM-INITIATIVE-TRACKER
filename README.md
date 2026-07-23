# CM INITIATIVE TRACKER

**Khyber Pakhtunkhwa — Chief Minister's Priority Initiatives & Sector Tracking Platform**
Data collection + visualization for the CM's **21 focus initiatives** and **86 ADP priority schemes**, reported **daily** by **34 departments**.

Built by CMPO (Chief Minister's Policy Office).

---

## What it does

| Capability | Detail |
|---|---|
| **21 CM Initiatives** | Each initiative is a tracked entity (e.g. Peshawar Revitalization Plan, DIK Motorway, Cashless Economy) with its ADP schemes grouped under it |
| **86 ADP Priority Schemes** | Seeded from the CM's Priority Projects list (ADP 2026-27 codes, costs, allocations) — every scheme is a tracked entity |
| **Departments = Sectors** | One dimension, 34 departments. Sector view and department view are the same thing |
| **Daily data collection** | Department users fill an **Excel-style sheet**: funds released, expenditure, financial %, physical %, stage, narrative, bottlenecks — upserted per entity per day |
| **Strict isolation** | A department sees and edits **only its own** schemes/initiatives (enforced server-side) |
| **Dashboards** | Provincial KPIs, initiative progress, sector allocation vs expenditure, stage distribution, daily reporting compliance |
| **Daily email digest** | Gmail SMTP, automatic at **18:00 PKT** + send-now button, HTML summary of all 21 initiatives |
| **Exports** | CSV of the full portfolio with latest progress |

## Stack (monolith)

- **Backend:** NestJS 10 + Prisma 6 + PostgreSQL (Railway)
- **Frontend:** React 18 + Vite 6 + Tailwind (duotone navy/white) + Recharts
- **One service:** NestJS serves the built SPA and `/api/*`

## Users & roles

| Role | Username | Notes |
|---|---|---|
| Super Admin | `superadmin` | full control + user management |
| Admin | `admin` | all dashboards, reports, digest |
| Department (×34) | dept code, e.g. `LG`, `HEALTH`, `CW`, `URBAN` | daily entry, own data only — default password `123456` (change via Admin) |

Login is case-insensitive. Peshawar Revitalization Plan schemes are owned by **LG**.

## Local development

```bash
npm install
# put real values in backend/.env  (see backend/.env.example)
npm run db:push && npm run db:seed
npm run build && npm start          # production-style on :4000
# — or hot-reload dev —
npm run dev:backend                 # API on :4000
npm run dev:frontend                # Vite on :5173 (proxies /api)
```

## Deploy on Railway

1. New project → **Deploy from GitHub repo** → `cmpocmkp/CM-INITIATIVE-TRACKER`
2. Add **PostgreSQL** database to the project
3. Service → **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `AUTH_SECRET` = long random string
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD` = Gmail + app password for the digest
   - `DIGEST_RECIPIENTS` = comma-separated emails
   - `APP_URL` = the public Railway URL
   - (optional) `SUPERADMIN_PASSWORD`, `ADMIN_PASSWORD`, `DEPARTMENT_DEFAULT_PASSWORD`
4. Deploy — `npm run start` pushes the schema, seeds reference data (idempotent), and serves on `$PORT`.

## Data model

`Department` (=Sector) → owns `Scheme`s · leads `Initiative`s
`Initiative` (21) → groups `Scheme`s across departments
`ProgressUpdate` → one row per **entity per day** (scheme *or* initiative), cumulative figures

Reference data lives in `backend/prisma/seed-data.json` (extracted from the ADP priority list); the seed is safe to re-run and never overwrites daily submissions.
