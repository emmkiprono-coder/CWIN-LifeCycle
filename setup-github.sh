#!/bin/bash
# ═══════════════════════════════════════════════════════
# CWIN Enterprise — Push to GitHub
# Run this from the project root after unzipping
# ═══════════════════════════════════════════════════════

echo "🏠 CWIN At Home — Enterprise Care Platform"
echo "Setting up GitHub repository..."
echo ""

# Initialize git
git init

# Add all files
git add .

# Initial commit
git commit -m "feat: CWIN Enterprise Care Platform v3.1

- 6-role auth system (Owner, Admin, Manager, Caregiver, Client, Family)
- 14 admin modules (Dashboard, Clients, Care Mgmt, Reconciliation, Expenses, Training, Recruiting, Marketing, Events, Compliance, Client Portal, Family Portal, Team, User Management)
- Caregiver portal (6 tabs: Home, Clients, Notes, Expenses, Training, Messages)
- Client portal (9 tabs: Home, Schedule, Health, Goals, Messages, Requests, Billing, Documents, Feedback)
- Family portal (4 tabs: Updates, Messages, Events, Incidents)
- AI case management agent with risk assessments
- Drillable reconciliation with GPS verification
- 12-module training academy with quizzes
- Editorial design: Playfair Display + Inter, warm cream + near-black palette
- User management with CRUD, role assignment, activate/deactivate"

# Set main branch
git branch -M main

# Add remote (update with your repo URL)
git remote add origin https://github.com/emmkiprono-coder/cwin-enterprise.git

# Push
git push -u origin main

echo ""
echo "✅ Pushed to GitHub!"
echo "Now go to https://vercel.com/new to deploy."
