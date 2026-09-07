# Deploying the ACA Platform frontend to Vercel

This app is two pieces: a **Vite/React frontend** (the files in this project)
and a **FastAPI backend** (uvicorn, `/api/...` routes). Vercel is built for
static + serverless frontends — it can host the React app directly, but it
cannot run a long-lived `uvicorn` process. So the plan is:

1. Deploy the **backend** somewhere that runs a persistent Python process
   (Render, Railway, Fly.io, or a small VPS all work well for FastAPI).
2. Deploy the **frontend** (this project) to Vercel, pointed at that
   backend's URL.

If your backend is already hosted somewhere, skip to step 2.

## 1. Host the FastAPI backend

Pick one:
- **Render** — "New Web Service" → connect your repo → start command
  `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- **Railway** — "New Project" → deploy from repo → Railway auto-detects
  the Python app; set the start command the same way.
- **Fly.io** — `fly launch`, then `fly deploy`.

Whichever you pick, once it's live you'll have a URL like
`https://aca-backend.onrender.com`. Enable CORS on the FastAPI app for your
Vercel domain (add it to `allow_origins` in your `CORSMiddleware` config),
otherwise the browser will block requests from the deployed frontend.

## 2. Deploy the frontend to Vercel

**Option A — Vercel CLI**
```bash
npm i -g vercel
cd <this project folder>
vercel
```
Answer the prompts (framework preset: **Vite**, build command:
`npm run build`, output directory: `dist`).

**Option B — Vercel dashboard**
1. Push this project to a GitHub repo.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Framework preset: Vite (auto-detected). Leave build command/output as
   the defaults (`npm run build` / `dist`).

### Point the frontend at your backend
In the Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://aca-backend.onrender.com/api` (your backend URL) |

`client.ts` already reads this at build time — no code change needed. Redeploy
after adding the variable (env vars only apply to new builds).

### Alternative: proxy `/api` through Vercel instead of an env var
If you'd rather keep calling `/api` from the frontend (no env var), add a
rewrite to `vercel.json` so Vercel forwards those requests to your backend:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://aca-backend.onrender.com/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```
This project's `vercel.json` currently only has the SPA fallback rule (needed
so routes like `/results/:id` and `/admin` don't 404 on refresh) — add the
line above once you know your backend URL.

## 3. Local development
Nothing changes locally: run your backend with `uvicorn` on port 8000 as
before, `npm run dev` for the frontend, and it will keep hitting `/api` via
your existing Vite dev proxy.

## Files added/changed for this
- `vercel.json` — SPA routing fallback.
- `.env.example` — documents `VITE_API_URL`.
- `src/api/client.ts` — now reads `VITE_API_URL` (falls back to `/api`).
