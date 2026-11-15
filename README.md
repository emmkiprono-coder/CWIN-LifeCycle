# CWIN Care Operations OS

Business operations backend for CWIN At Home: time ingestion (Connecteam),
rate/pay rules, invoicing, contractor pay slips, CRM, RBAC, exception-based
reconciliation, and locked-period billing.

Built on Next.js (TypeScript) + Prisma + PostgreSQL, with BullMQ/Redis for
background jobs (pay runs, future live Connecteam sync).

The `frontend/`, `backend/`, and root `src/App.jsx`/`src/main.jsx` from the
previous CWIN-LifeCycle prototype (in-memory Express "AI agent" backend +
Vite frontend, built around a different consumer-concierge data model) are
left in place for reference but are no longer the basis for this build —
everything under `src/app/` and `src/lib/` below is the new system.

## Architecture & migration plan

This is deliberately a **separate system** from the live CWIN At Home app
(React + Supabase, deployed at app.cwinathome.com). It does not touch that
app's database or deployment. Caregivers, clients, and families keep using
CWIN At Home exactly as-is while this is built and tested.

Once the operations pieces here (time, pay, invoicing, CRM, reconciliation)
are solid, the plan is a deliberate, single migration/connection step rather
than a gradual rewrite in place — see "Next steps" below. `externalRef`
fields on `Client` and `Caregiver` in the Prisma schema exist specifically
to hold the matching id from the Supabase app, so that step can reconcile
records rather than guess at matches.

## Phase 1 (this scaffold)

- [x] Prisma schema: RBAC, CRM (clients/leads), caregivers, pay rules,
      shifts, reconciliation exceptions, lockable billing periods, invoices,
      pay stubs, audit log
- [x] Rate/pay rules engine (`src/lib/pay-rules.ts`) — encodes the company's
      pricing law (client rate = direct cost / 0.80, fixed 20% admin margin)
      plus per-caregiver/per-client pay rule overrides (differentials,
      multipliers)
- [x] Connecteam manual import (`src/lib/connecteam-import.ts` +
      `POST /api/import/connecteam`) — parses the "All Employees" sheet of a
      Connecteam timesheet export, matches rows to existing Caregiver/Client
      records by name, and raises reconciliation exceptions for anything
      that needs a human: missing clock-outs, missing/zero rates, unmatched
      names. Shaped directly from the real export you provided
      (`timeclock-timesheet_overview_2026-02-25_2026-03-10.xlsx`).
- [x] Invoice + pay-stub generation (`src/lib/billing.ts` +
      `POST /api/billing-periods/:id/generate`) — document-only, per your
      decision: produces Invoice/PayStub records and PDFs for manual payment
      outside the system. Nothing here moves money. Only `APPROVED` shifts
      are billed/paid; `PENDING_REVIEW`/`EXCEPTION` shifts are excluded until
      a person resolves them.
- [ ] Admin UI for reviewing imports, resolving exceptions, approving
      shifts, and downloading generated documents (not built yet — Phase 1
      is API-first; see "Next steps")
- [ ] Live Connecteam API sync (`CONNECTEAM_API_KEY` in `.env.example` is a
      placeholder for this)
- [ ] Real payment rail (Stripe/ACH) for invoice collection and contractor
      payout — explicitly out of scope until you decide v1 document-only is
      ready to go further
- [ ] Document storage (S3 or similar) for generated PDFs — right now
      `generate` returns PDFs as base64 in the response; `Invoice.pdfUrl` /
      `PayStub.pdfUrl` are ready for wiring once storage exists

## Local development

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

## Deploying (Railway)

1. Create a Railway project, attach a **Postgres** plugin and a **Redis**
   plugin.
2. Connect this GitHub repo (branch `care-operations-os` for now).
3. Railway reads `railway.json` and builds from the `Dockerfile`.
4. Set `DATABASE_URL` and `REDIS_URL` from the attached plugins in the
   service's environment variables (Railway can inject these automatically
   if you reference the plugin's variables).
5. Run `npx prisma migrate deploy` against the production database (via
   Railway's one-off command runner, or a release step) before first boot.

## Next steps

1. Seed `Client`/`Caregiver` records (manually or via a one-time script
   pulling from the Supabase app) so the Connecteam importer has something
   to match against.
2. Build the review UI: list `EXCEPTION`/`PENDING_REVIEW` shifts, approve or
   correct them, then trigger `/api/billing-periods/:id/generate`.
3. Wire up document storage so generated PDFs persist and `pdfUrl` fields
   get set.
4. Decide when/how to connect this to CWIN At Home's data (migration vs.
   read-only sync) — do this as one planned, tested cutover, not
   incrementally, to avoid any risk to the live app.

## Company

**CWIN At Home LLC**
15941 S. Harlem Ave. #305, Tinley Park, IL 60477
708.476.0021 — CWINathome@gmail.com
*Care When It's Needed*

Proprietary. All rights reserved.
