# CWIN At Home — Enterprise Care Platform

**Care When It's Needed**

A comprehensive, production-grade home care management platform built with React + Vite. Covers operations, compliance, billing, training, client/family portals, recruiting, marketing, and AI-powered case management.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/emmkiprono-coder/cwin-enterprise.git
cd cwin-enterprise

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app runs at `http://localhost:3000`.

---

## Demo Accounts

| Role | Email | PIN | Access |
|------|-------|-----|--------|
| **Owner** | kip@cwinathome.com | 1234 | Full platform (14 modules) |
| **Admin** | admin@cwinathome.com | 4321 | Full platform |
| **Manager** | (future) | — | Operations, compliance, training |
| **Caregiver** | erolyn@cwinathome.com | 1111 | Caregiver portal (6 tabs) |
| **Caregiver** | faith@cwinathome.com | 2222 | Caregiver portal |
| **Caregiver** | olena@cwinathome.com | 3333 | Caregiver portal |
| **Caregiver** | tiffany@cwinathome.com | 4444 | Caregiver portal |
| **Client** | becky.sutton@email.com | 5555 | Client portal (9 tabs) |
| **Client** | linda.frank@email.com | 6666 | Client portal |
| **Client** | steven.brown@email.com | 7777 | Client portal |
| **Family** | tom.sutton@email.com | 8888 | Family portal (4 tabs) |
| **Family** | mike.frank@email.com | 9999 | Family portal |
| **Family** | janet.brown@email.com | 0000 | Family portal |

---

## Modules

### Owner / Admin View
- **Command Center** — AI-powered dashboard with KPIs, insights, recent notes, upcoming events
- **Client Profiles** — Health, social, care plan, and timeline tabs per client
- **Care Management** — Tasks/chores, incident reports, care notes, AI case agent
- **Reconciliation Center** — Drillable time/GPS/cost variance analysis with approve/reject
- **Expenses** — Track, approve, and feed billable expenses to invoices
- **Training Academy** — 12 modules (Compliance, Safety, Clinical, Daily Living) with quizzes
- **Recruiting** — Caregiver pipeline (New > Screening > Interview > Offer > Hired) and client lead pipeline
- **Marketing** — Campaign management, budget tracking, lead analytics, AI recommendations
- **Events & Wellness** — Medical appointments, social activities, AI-suggested events
- **Compliance Center** — Certifications, agreements, regulatory tracking with overdue/expiring alerts
- **Client Portal** — Service requests, vitals, goals, billing, documents, satisfaction surveys
- **Family Portal** — Shared care notes, messaging, events, incident visibility
- **Team** — Caregiver profiles, certifications, training progress
- **User Management** — Full CRUD for all user accounts across 6 roles

### Caregiver View
- Home dashboard with personal stats
- My Clients (assigned clients with health data)
- Care Notes (create and view)
- Expenses (personal expense tracking)
- Training (module completion)
- Messages (team chat)

### Client View
- Health dashboard (vitals, medications, diagnoses, ADL)
- Care goals with progress tracking
- Schedule and care team info
- Direct messaging with care team
- Service requests
- Billing and expense receipts
- Documents library
- Satisfaction surveys with star ratings

### Family View
- Care updates feed
- Direct messaging with care team
- Upcoming events
- Incident reports (family-notified only)

---

## Role-Based Access Control

```
Owner (100)   — All modules
Admin (80)    — All modules
Manager (60)  — Operations, compliance, training, events, family, team
Caregiver (20) — Personal portal only
Client (10)   — Personal portal only
Family (5)    — Family portal only
```

---

## Tech Stack

- **React 18** — UI framework
- **Vite 5** — Build tool (sub-second HMR)
- **Playfair Display + Inter** — Editorial typography
- **Pure CSS** — No UI library dependencies
- **Zero external dependencies** — No Tailwind, no component library

---

## Design System

The platform uses an editorial design language inspired by magazine layouts:

- **Palette**: #070707 (near-black), #FFFFFF (white), #f5f2eb (warm cream), #3D3E3F (slate accent), #8a7356 (ochre), #3c4f3d (forest green), #7a3030 (muted red)
- **Typography**: Playfair Display (serif, weight 400) for headings, Inter (sans, weight 300-600) for body
- **Shape**: Sharp rectangles, no border-radius. Square avatars. Thin 1px borders.
- **Labels**: All-caps at 0.6rem with wide letter-spacing

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set framework to Vite, output to dist/
```

Or connect your GitHub repo at [vercel.com/new](https://vercel.com/new) for automatic deploys on every push.

### Custom Domain
Point `ops.cwinathome.com` to your Vercel deployment:
1. Add domain in Vercel project settings
2. Add CNAME record: `ops` -> `cname.vercel-dns.com`

---

## Future: Supabase Integration

Copy `.env.example` to `.env.local` and add your Supabase credentials. The database schema, Row Level Security policies, and migration SQL are documented in the deployment guide.

---

## File Structure

```
cwin-enterprise/
  index.html          — HTML entry point
  package.json        — Dependencies and scripts
  vite.config.js      — Vite configuration
  .env.example        — Environment variable template
  .gitignore          — Git ignore rules
  README.md           — This file
  src/
    main.jsx          — React entry point
    App.jsx           — Full application (23 components, 2000+ lines)
```

---

## Company

**CWIN At Home LLC**
15941 S. Harlem Ave. #305
Tinley Park IL, 60477
708.476.0021
CWINathome@gmail.com

*Care When It's Needed*

---

## License

Proprietary. All rights reserved. CWIN At Home LLC.
