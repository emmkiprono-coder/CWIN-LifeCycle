# CWIN LifeCycle Admin API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication

All endpoints (except `/auth/login`) require authentication via JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Login
```
POST /auth/login

Request Body:
{
  "email": "margaret@email.com",
  "password": "demo",
  "role": "client"
}

Response:
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "C001",
    "name": "Margaret Chen",
    "type": "client",
    "email": "margaret@email.com"
  }
}
```

## AI Request Endpoint

### Post AI Request
```
POST /ai/request

Headers:
  x-user-id: C001
  x-user-type: client
  Content-Type: application/json

Request Body:
{
  "type": "appointment|billing|coordination|documentation|family",
  "action": "schedule|confirm|list|reconcile|etc",
  "data": { ... specific to action }
}

Response:
{
  "success": true,
  "data": { ... result }
}
```

## Appointment Agent

### Schedule Appointment
```
POST /ai/request

{
  "type": "appointment",
  "action": "schedule",
  "data": {
    "provider": "Dr. Patel",
    "type": "Annual Physical",
    "date": "2026-04-15",
    "time": "14:00",
    "location": "Medical Center",
    "notes": "Annual checkup"
  }
}

Response:
{
  "success": true,
  "data": {
    "appointmentId": "APT001",
    "message": "Appointment scheduled with Dr. Patel",
    "status": "pending_confirmation",
    "reminderScheduled": true
  }
}
```

### Confirm Appointment
```
POST /ai/request

{
  "type": "appointment",
  "action": "confirm",
  "data": {
    "appointmentId": "APT001"
  }
}
```

### Reschedule Appointment
```
POST /ai/request

{
  "type": "appointment",
  "action": "reschedule",
  "data": {
    "appointmentId": "APT001",
    "newDate": "2026-04-16",
    "newTime": "10:00"
  }
}
```

### List Appointments
```
POST /ai/request

{
  "type": "appointment",
  "action": "list"
}

Response:
{
  "success": true,
  "data": [
    {
      "id": "APT001",
      "provider": "Dr. Patel",
      "date": "2026-04-15",
      "time": "14:00",
      "type": "Annual Physical",
      "status": "scheduled"
    }
  ]
}
```

## Billing Agent

### List Bills
```
POST /ai/request

{
  "type": "billing",
  "action": "listBills"
}

Response:
{
  "success": true,
  "data": [
    {
      "id": "BILL001",
      "vendor": "Medical Center Lab",
      "amount": 245.00,
      "dueDate": "2026-04-30",
      "status": "unpaid"
    }
  ]
}
```

### Reconcile Bills
```
POST /ai/request

{
  "type": "billing",
  "action": "reconcileBills"
}

Response:
{
  "success": true,
  "data": {
    "totalUnpaid": 401.50,
    "totalPaid": 89.50,
    "overdueCount": 1,
    "overdueBills": [...],
    "billsByCategory": {...},
    "recommendation": "Address overdue bills immediately"
  }
}
```

### Process Payment
```
POST /ai/request

{
  "type": "billing",
  "action": "processPayment",
  "data": {
    "billId": "BILL001",
    "paymentMethod": "credit_card"
  }
}
```

### Verify Insurance
```
POST /ai/request

{
  "type": "billing",
  "action": "verifyInsurance"
}

Response:
{
  "success": true,
  "data": {
    "provider": "Blue Cross",
    "memberId": "BC123456789",
    "coverageActive": true,
    "deductibleMet": false,
    "outOfPocketMax": 5000
  }
}
```

## Coordination Agent

### List Tasks
```
POST /ai/request

{
  "type": "coordination",
  "action": "listTasks"
}
```

### Create Task
```
POST /ai/request

{
  "type": "coordination",
  "action": "createTask",
  "data": {
    "title": "Confirm appointment with Dr. Patel",
    "description": "Call office to confirm April 15 appointment",
    "dueDate": "2026-04-13",
    "priority": "high",
    "category": "Coordination"
  }
}
```

### Complete Task
```
POST /ai/request

{
  "type": "coordination",
  "action": "completeTask",
  "data": {
    "taskId": "TSK001"
  }
}
```

### Generate Weekly Plan
```
POST /ai/request

{
  "type": "coordination",
  "action": "generateWeeklyPlan"
}

Response:
{
  "success": true,
  "data": {
    "weekPlan": {
      "appointments": [...],
      "tasks": [...],
      "billsDue": [...],
      "focusItems": [...]
    }
  }
}
```

## Documentation Agent

### Upload Document
```
POST /ai/request

{
  "type": "documentation",
  "action": "uploadDocument",
  "data": {
    "name": "Lab Results",
    "type": "PDF",
    "category": "Medical Records",
    "metadata": {
      "date": "2026-04-08",
      "provider": "Medical Center Lab"
    }
  }
}
```

### List Documents
```
POST /ai/request

{
  "type": "documentation",
  "action": "listDocuments"
}
```

## Family Agent

### Send Family Update
```
POST /ai/request

{
  "type": "family",
  "action": "sendFamilyUpdate",
  "data": {
    "subject": "Weekly Health Update",
    "message": "Margaret's appointments are on track..."
  }
}
```

### List Family Contacts
```
POST /ai/request

{
  "type": "family",
  "action": "listFamilyContacts"
}
```

## Standard Endpoints

### Get Client
```
GET /clients/:id

Response:
{
  "id": "C001",
  "name": "Margaret Chen",
  "email": "margaret@email.com",
  "phone": "(312) 555-0145",
  "tier": "Comprehensive",
  "status": "active",
  "providers": ["Dr. Patel", "Cardiologist"]
}
```

### Get Analytics
```
GET /analytics/client/:id

Response:
{
  "clientId": "C001",
  "statistics": {
    "totalAppointments": 4,
    "scheduledAppointments": 2,
    "totalBillingValue": 334.50,
    "unpaidAmount": 245.00,
    "tasksCompleted": 0,
    "pendingTasks": 3
  }
}
```

### Admin Dashboard
```
GET /admin/dashboard (admin only)

Response:
{
  "overview": {
    "totalClients": 3,
    "activeClients": 3,
    "totalBilling": 334.50,
    "unpaidBilling": 245.00,
    "monthlyRevenue": 6600,
    "coordinatorCount": 2
  },
  "clients": [...],
  "billingStatus": {...},
  "trends": {...}
}
```

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `INVALID_TYPE` - Unknown AI agent type
- `AGENT_ERROR` - Agent processing failed
- `UNAUTHORIZED` - Authentication failed
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed

## Rate Limiting

- 1000 requests per hour per user
- 10000 requests per hour per IP

## Pagination

For list endpoints that support pagination:

```
GET /endpoint?page=1&limit=20

Response includes:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

For more information, see the main [README.md](../README.md)
