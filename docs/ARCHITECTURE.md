# CWIN LifeCycle Admin - Architecture Documentation

## System Overview

The CWIN LifeCycle Admin platform is built on a modular, AI-driven architecture designed for scalability, security, and ease of maintenance.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  • React SPA (Client Portal)                                     │
│  • React Dashboard (Coordinator Dashboard)                       │
│  • React Dashboard (Admin Console)                               │
│  • AI Assistant Chat Widget                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API / WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                      API Gateway Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  • Express.js Server                                             │
│  • JWT Authentication                                            │
│  • Request Validation                                            │
│  • Rate Limiting                                                 │
│  • CORS & Security Headers                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                 AI Agent Orchestrator Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  • Agent Factory Pattern                                         │
│  • Request Routing                                               │
│  • Agent Pool Management                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Agent Classes                                              │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 1. AppointmentAgent   - Scheduling, confirmations         │  │
│  │ 2. BillingAgent       - Reconciliation, payments          │  │
│  │ 3. CoordinationAgent  - Tasks, planning                   │  │
│  │ 4. DocumentationAgent - Storage, reporting                │  │
│  │ 5. FamilyAgent        - Communication, sharing            │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Business Logic Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  • Data Access Objects (DAOs)                                    │
│  • Business Rules Engine                                         │
│  • Validation & Compliance                                       │
│  • Event Processing                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Data Access Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  • PostgreSQL ORM (Sequelize/Knex)                               │
│  • Query Builder                                                 │
│  • Transaction Management                                        │
│  • Migration Scripts                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Data Storage Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  • PostgreSQL (Primary)                                          │
│  • Redis (Cache)                                                 │
│  • S3 (Document Storage)                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Architecture

Each AI agent follows a consistent pattern:

```javascript
class Agent {
  async execute(action, data, context) {
    // Validate inputs
    // Execute action-specific logic
    // Return structured result
  }
  
  // Action handlers
  async actionName(data, context) {
    // Implementation
  }
}
```

### Agent Responsibilities

**AppointmentAgent**
- Schedule appointments with optimal time selection
- Send confirmations and reminders
- Detect and resolve scheduling conflicts
- Reschedule as needed
- Track confirmation status

**BillingAgent**
- Reconcile bills against insurance coverage
- Detect overdue payments
- Verify insurance eligibility
- Process payments
- Initiate disputes
- Analyze billing trends

**CoordinationAgent**
- Prioritize tasks based on urgency and impact
- Generate weekly care plans
- Coordinate provider communication
- Track task completion
- Optimize workload distribution

**DocumentationAgent**
- Auto-categorize documents
- Extract and store metadata
- Generate compliance reports
- Organize documents intelligently
- Maintain HIPAA audit trails

**FamilyAgent**
- Send coordinated family updates
- Notify on critical events
- Share documents securely
- Enforce privacy boundaries
- Manage family communication

## Database Schema

### Core Tables

**clients**
- id (PK)
- name, email, phone
- tier (Essentials/Comprehensive/Concierge)
- status (active/inactive)
- preferences (JSON)
- created_at, updated_at

**appointments**
- id (PK)
- clientId (FK)
- provider, type, date, time
- status (scheduled/pending/confirmed)
- reminderSent, confirmationStatus
- created_at, updated_at

**bills**
- id (PK)
- clientId (FK)
- vendor, amount, dueDate
- status (paid/unpaid)
- category, description
- created_at, updated_at

**tasks**
- id (PK)
- clientId (FK)
- coordinatorId (FK)
- title, description
- dueDate, priority
- status (pending/completed)
- created_at, updated_at

**documents**
- id (PK)
- clientId (FK)
- name, type, category
- s3Url, metadata (JSON)
- created_at, updated_at

**coordinators**
- id (PK)
- name, email, phone
- assignedClients (JSON array)
- certifications (JSON array)
- created_at, updated_at

## Security Architecture

### Authentication
- JWT tokens with 7-day expiry
- Bcrypt password hashing
- Refresh token rotation

### Authorization
- Role-based access control (RBAC)
- Client isolation (clients only see their data)
- Coordinator scoping (only assigned clients)
- Admin full access

### Data Security
- AES-256 encryption at rest
- TLS 1.3 encryption in transit
- Field-level encryption for PII
- Automatic key rotation

### Compliance
- HIPAA audit logging
- GDPR consent tracking
- SOC 2 compliance
- Regular security audits

## Deployment Architecture

### Development Environment
```
Local Machine
├── Backend (Node.js on :5000)
├── Frontend (React on :3000)
└── PostgreSQL (local)
```

### Staging Environment
```
AWS
├── ECS Cluster (Docker containers)
├── RDS PostgreSQL
├── CloudFront CDN
├── Application Load Balancer
└── CloudWatch Monitoring
```

### Production Environment
```
AWS Multi-Region
├── Primary Region
│   ├── ECS Auto-scaling cluster
│   ├── RDS Multi-AZ
│   ├── ElastiCache (Redis)
│   └── S3 with replication
├── Secondary Region
│   └── Standby cluster (failover)
└── Global
    ├── Route 53 (DNS)
    ├── CloudFront (CDN)
    └── WAF (security)
```

## Scaling Strategy

### Horizontal Scaling
- Stateless API servers in ECS cluster
- Auto-scaling based on CPU/memory
- Load balancing across instances

### Vertical Scaling
- Larger RDS instance if needed
- ElastiCache for hot data
- S3 for unlimited document storage

### Database Optimization
- Connection pooling
- Query optimization
- Indexing strategy
- Partitioning for large tables

## Monitoring & Observability

### Metrics
- API response times
- Agent execution times
- Error rates by agent
- Database query times
- User activity

### Logging
- Structured JSON logs
- Audit logging for compliance
- Error tracking (Sentry)
- Performance profiling

### Alerting
- Critical errors
- High latency (>1s)
- Failed agents
- Database issues
- Security events

## Integration Points

### External Services
- SendGrid (email)
- Twilio (SMS)
- Stripe (payments)
- Healthcare provider APIs (EHR integration)
- Insurance verification APIs

### Data Flow
```
Client Request
  ↓
API Gateway (validation, auth)
  ↓
Agent Router
  ↓
Specific Agent
  ↓
Business Logic
  ↓
Database/External Services
  ↓
Response
```

## Performance Considerations

- Response time target: < 500ms
- Database query optimization
- Redis caching for frequently accessed data
- Async/await for non-blocking operations
- Worker queues for long-running tasks

## Disaster Recovery

- Daily automated backups
- Cross-region replication
- RTO: 4 hours
- RPO: 1 hour
- Tested quarterly

---

For implementation details, see [DEPLOYMENT.md](DEPLOYMENT.md)
