# RedLockX — Deployment Guide

## Prerequisites
- Node.js 20+ installed
- pnpm (`npm install -g pnpm`)
- PostgreSQL database (Supabase, Railway, or local)

---

## Running on Windows (local development)

1. **Clone the repo**
   ```bat
   git clone https://github.com/YOUR_USER/redlockx.git
   cd redlockx
   ```

2. **Install dependencies**
   ```bat
   pnpm install
   ```

3. **Set environment variables** — copy `.env.example` and fill in your values:
   ```bat
   copy .env.example .env
   ```
   Edit `.env`:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   SESSION_SECRET=change-this-to-a-long-random-string
   ```

4. **Set up the database** — use the Supabase SQL Editor to run `supabase-schema.sql`,
   OR push via Drizzle:
   ```bat
   pnpm --filter @workspace/db run push
   ```

5. **Start the servers**
   ```bat
   :: Terminal 1 — API server
   pnpm --filter @workspace/api-server run dev

   :: Terminal 2 — Frontend
   pnpm --filter @workspace/firewall-ui run dev
   ```
   Frontend: http://localhost:5173  
   API: http://localhost:8080

---

## Deploying to Railway

1. **Push to GitHub** first (see section below).

2. **Create a new Railway project** at https://railway.app

3. **Add a PostgreSQL service** (Railway provides one-click Postgres).

4. **Deploy the API service:**
   - Connect your GitHub repo
   - Set root directory: `/`
   - Build command: `pnpm install && pnpm --filter @workspace/api-server run build`
   - Start command: `pnpm --filter @workspace/api-server run start`
   - Environment variables:
     - `DATABASE_URL` — copy from Railway Postgres service
     - `SESSION_SECRET` — any long random string
     - `PORT` — Railway sets this automatically

5. **Deploy the frontend service** (optional — or use Vercel/Netlify):
   - Build command: `pnpm install && pnpm --filter @workspace/firewall-ui run build`
   - Output directory: `artifacts/firewall-ui/dist`
   - Environment variables: none required for static build

6. **Run migrations:**
   - In the Railway API service shell: `pnpm --filter @workspace/db run push`
   - OR run `supabase-schema.sql` in the Supabase SQL Editor if using Supabase

---

## Deploying to GitHub + Vercel (frontend only)

1. Push to GitHub
2. Import the repo in Vercel
3. Framework: Vite
4. Root directory: `artifacts/firewall-ui`
5. Build command: `cd ../.. && pnpm install && pnpm --filter @workspace/firewall-ui run build`
6. Output directory: `dist`
7. Set `VITE_API_BASE_URL` to your Railway API URL

---

## Supabase Database Setup

1. Create a new Supabase project at https://supabase.com
2. Go to **SQL Editor**
3. Paste and run the contents of `supabase-schema.sql`
4. Copy the connection string from **Settings → Database → Connection string (URI)**
5. Use it as your `DATABASE_URL`

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Random secret for session signing |
| `PORT` | Auto | HTTP port (set by Railway/Replit automatically) |
| `HYBRID_SPACE_URL` | Optional | Override HuggingFace Hybrid Space URL |
| `ML_SPACE_URL` | Optional | Override HuggingFace ML Space URL |
