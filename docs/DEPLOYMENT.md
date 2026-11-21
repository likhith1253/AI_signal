# Deployment — Vercel + Neon

## 1. Database (Neon)
1. Create a Neon project (any region close to your Vercel region, e.g. `aws-us-east-1`).
2. Copy two connection strings:
   - **pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **direct** → `DIRECT_URL`
   Both need `?sslmode=require`.

You can also add Neon from the Vercel dashboard (Storage → Neon), which injects the variables automatically. If the injected names differ, map them to `DATABASE_URL` / `DIRECT_URL`.

## 2. Schema and data
From your machine, with the Neon URLs exported:
```bash
DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
DATABASE_URL=... DIRECT_URL=... npm run ingest
```
Seed **before** the first Vercel build: some pages (home, labs, providers, ecosystem) are pre-rendered at build time and revalidated every 5–10 minutes.

## 3. Vercel
1. Import the GitHub repo (or `vercel link`).
2. Environment variables (Production + Preview): `DATABASE_URL`, `DIRECT_URL`, `INGEST_SECRET`, `CRON_SECRET`, optionally `NEXT_PUBLIC_SITE_URL`.
3. Deploy. `vercel.json` sets the build command to `prisma generate && prisma migrate deploy && next build`, so future schema changes migrate automatically.
4. The daily cron (`0 6 * * *`) calls `/api/cron/ingest`, which Vercel authenticates with `CRON_SECRET`. Each run appends to the change ledger.

## 4. Verify
```bash
curl https://<app>/api/models?pageSize=1
curl -X POST -H "Authorization: Bearer $INGEST_SECRET" "https://<app>/api/ingest?plan=1"
E2E_BASE_URL=https://<app> npx playwright test
```
