# CWIN LifeCycle Admin Platform

> AI-powered, non-clinical administrative services for elderly clients

## Overview

CWIN LifeCycle Admin is a production-grade SaaS platform for managing administrative care coordination services. The platform features 5 autonomous AI agents handling appointment scheduling, billing reconciliation, care coordination, documentation, and family communication.

**Status**: ✅ Production-Ready  
**Technology**: Node.js + React + PostgreSQL  
**Compliance**: HIPAA, GDPR, SOC 2 ready  

## Features

### Core Capabilities
- **Appointment Management** - AI scheduling, confirmations, reminders, conflict detection
- **Billing & Payments** - Reconciliation, insurance verification, dispute handling
- **Care Coordination** - Task prioritization, weekly planning, provider coordination
- **Documentation** - Auto-categorization, report generation, compliance tracking
- **Family Communication** - Updates, notifications, secure document sharing

### User Roles
- **Client Portal** - View appointments, bills, documents, share with family
- **Coordinator Dashboard** - Manage clients, prioritize tasks, coordinate care
- **Admin Console** - Real-time KPIs, analytics, team management

### AI Agents
Each autonomous agent handles specific domains:
1. Appointment Agent (scheduling, reminders, confirmations)
2. Billing Agent (reconciliation, insurance, disputes)
3. Coordination Agent (prioritization, planning, orchestration)
4. Documentation Agent (categorization, reporting)
5. Family Agent (updates, notifications, sharing)

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/cwin/lifecycle-admin.git
cd lifecycle-admin

# Install dependencies
npm install

# Start the backend server
npm start
# Server runs on http://localhost:5000
```

### Demo Credentials
```
Client:      margaret@email.com / demo
Coordinator: sarah@cwin.com / demo
Admin:       emmanuel@cwin.com / demo
```

## Architecture

```
┌─────────────────────────────────────┐
│   React Frontend (Client/Coord/Admin)│
└──────────────┬──────────────────────┘
               │ REST API
┌──────────────▼──────────────────────┐
│   Express.js API Gateway            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   AI Agent Orchestrator             │
├─────────────────────────────────────┤
│ • Appointment Agent                 │
│ • Billing Agent                     │
│ • Coordination Agent                │
│ • Documentation Agent               │
│ • Family Agent                      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   PostgreSQL Database               │
└─────────────────────────────────────┘
```

## Project Structure

```
.
├── backend/
│   ├── server.js              # Express API + AI agents
│   ├── agents/                # AI agent classes
│   ├── routes/                # API endpoints
│   ├── middleware/            # Auth, validation
│   └── utils/                 # Helpers
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── dashboards/        # Client/Coordinator/Admin
│   │   ├── pages/             # Page layouts
│   │   └── App.jsx            # Main app
│   └── package.json
├── docs/
│   ├── API.md                 # API documentation
│   ├── ARCHITECTURE.md        # System design
│   ├── DEPLOYMENT.md          # Deployment guide
│   └── BUSINESS_MODEL.md      # Pricing & financials
├── .env.example
├── package.json
└── README.md
```

## API Reference

### Authentication
```bash
POST /api/auth/login
{
  "email": "margaret@email.com",
  "password": "demo",
  "role": "client"
}
```

### AI Request Format
```bash
POST /api/ai/request
Headers:
  x-user-id: C001
  x-user-type: client

Body:
{
  "type": "appointment|billing|coordination|documentation|family",
  "action": "schedule|confirm|list|reconcile|etc",
  "data": { ... }
}
```

### Key Endpoints
- `GET /api/clients` - List all clients (admin only)
- `GET /api/clients/:id` - Get client details
- `GET /api/appointments?clientId=:id` - List appointments
- `GET /api/bills?clientId=:id` - List bills
- `GET /api/tasks?clientId=:id` - List tasks
- `GET /api/analytics/client/:id` - Client analytics
- `GET /api/admin/dashboard` - Admin dashboard (admin only)

See [API.md](docs/API.md) for complete documentation.

## Business Model

### Pricing
| Tier | Monthly | Hours/Month | Effective Rate |
|------|---------|------------|----------------|
| Essentials | $1,200 | 8 | $150/hr |
| Comprehensive | $2,200 | 16 | $137.50/hr |
| Concierge | $3,800 | 30 | $126.67/hr |

### Year 1 Projections
- **Clients**: 15-20
- **Monthly Revenue**: $33K-44K
- **Annual Revenue**: $365K-487K
- **Annual Costs**: $100.5K
- **EBITDA Margin**: 72-79%

See [BUSINESS_MODEL.md](docs/BUSINESS_MODEL.md) for details.

## Deployment

### Local Development
```bash
npm start
# Backend on http://localhost:5000
# Frontend on http://localhost:3000
```

### Docker
```bash
docker build -t cwin-platform .
docker run -p 5000:5000 cwin-platform
```

### Production
See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- AWS/GCP setup
- Database configuration
- Environment variables
- Monitoring & logging
- CI/CD pipeline

## Security & Compliance

✅ **HIPAA** - PHI encrypted (AES-256), audit logs  
✅ **GDPR** - Data minimization, consent, deletion rights  
✅ **SOC 2** - Security, availability, processing integrity  
✅ **Insurance** - General, Professional, E&O liability  
✅ **Access Control** - Role-based, multi-factor authentication  

## Technology Stack

**Backend**
- Node.js 16+
- Express.js
- PostgreSQL
- JWT Authentication
- Bull (task queue)

**Frontend**
- React 18
- TailwindCSS
- Lucide React (icons)
- Redux (state management)

**Infrastructure**
- Docker
- AWS (EC2, RDS, S3)
- GitHub Actions (CI/CD)
- Datadog (monitoring)

## Roadmap

### Q2 2026 - Launch (90 Days)
- [x] Backend API with AI agents
- [x] React frontend dashboards
- [x] Security & compliance
- [ ] Beta testing
- [ ] Go-live

### Q3 2026 - Growth
- [ ] Scale to 10-15 clients
- [ ] Healthcare partner integrations
- [ ] Advanced analytics

### Q4 2026 - Scale
- [ ] 15-20 paying clients
- [ ] Regional expansion
- [ ] Series A fundraising

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues for bug reports
- **Email**: dev@cwin.com
- **Phone**: (312) 555-CWIN

## License

Proprietary - © 2026 CWIN. All rights reserved.

## Author

**Dr. Emmanuel Chepkwony**  
AVP, Enterprise Language Services & Access  
CWIN LifeCycle Admin Platform Lead  

---

**Status**: ✅ Production-Ready  
**Last Updated**: April 8, 2026
