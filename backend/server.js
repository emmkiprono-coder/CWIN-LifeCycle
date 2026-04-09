const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory database (replace with real DB in production)
const db = {
  clients: [
    {
      id: 'C001',
      name: 'Margaret Chen',
      email: 'margaret@email.com',
      phone: '(312) 555-0145',
      tier: 'Comprehensive',
      status: 'active',
      joinDate: '2025-06-15',
      providers: ['Dr. Patel', 'Dr. Morrison', 'Cardiologist'],
      insurance: { provider: 'Blue Cross', memberId: 'BC123456789', groupId: 'GRP789' },
      familyContacts: [
        { name: 'David Chen', relationship: 'Son', phone: '(312) 555-0146', email: 'david@email.com' }
      ],
      documents: [],
      preferences: { communicationMethod: 'email', timezone: 'Central' }
    },
    {
      id: 'C002',
      name: 'Robert Williams',
      email: 'robert@email.com',
      phone: '(312) 555-0147',
      tier: 'Essentials',
      status: 'active',
      joinDate: '2025-07-01',
      providers: ['Dr. Brown'],
      insurance: { provider: 'Medicare', memberId: 'MW987654321' },
      familyContacts: [],
      documents: [],
      preferences: { communicationMethod: 'phone', timezone: 'Central' }
    },
    {
      id: 'C003',
      name: 'Helen Martinez',
      email: 'helen@email.com',
      phone: '(312) 555-0148',
      tier: 'Concierge',
      status: 'active',
      joinDate: '2025-05-01',
      providers: ['Dr. Chen', 'Dr. Liu', 'Orthopedist', 'Rheumatologist'],
      insurance: { provider: 'Aetna', memberId: 'HM456789012' },
      familyContacts: [
        { name: 'Maria Lopez', relationship: 'Daughter', phone: '(312) 555-0149', email: 'maria@email.com' }
      ],
      documents: [],
      preferences: { communicationMethod: 'text', timezone: 'Central' }
    }
  ],
  appointments: [
    {
      id: 'APT001',
      clientId: 'C001',
      provider: 'Dr. Patel',
      type: 'Checkup',
      date: '2026-04-15',
      time: '14:00',
      location: 'Medical Center, Suite 300',
      status: 'scheduled',
      reminderSent: true,
      confirmationStatus: 'confirmed',
      notes: 'Annual physical exam'
    },
    {
      id: 'APT002',
      clientId: 'C001',
      provider: 'Cardiologist',
      type: 'Follow-up',
      date: '2026-04-18',
      time: '10:00',
      location: 'Heart Center, Floor 2',
      status: 'pending_confirmation',
      reminderSent: false,
      confirmationStatus: 'awaiting',
      notes: 'Post-treatment evaluation'
    },
    {
      id: 'APT003',
      clientId: 'C002',
      provider: 'Dr. Brown',
      type: 'Lab Work',
      date: '2026-04-20',
      time: '15:30',
      location: 'Lab Center',
      status: 'scheduled',
      reminderSent: true,
      confirmationStatus: 'confirmed',
      notes: 'Quarterly bloodwork'
    }
  ],
  bills: [
    {
      id: 'BILL001',
      clientId: 'C001',
      vendor: 'Medical Center Lab',
      amount: 245.00,
      dueDate: '2026-04-30',
      submittedDate: '2026-03-30',
      status: 'unpaid',
      category: 'Healthcare',
      description: 'Lab analysis - Annual physical'
    },
    {
      id: 'BILL002',
      clientId: 'C001',
      vendor: 'Pharmacy Plus',
      amount: 89.50,
      dueDate: '2026-04-25',
      submittedDate: '2026-03-20',
      status: 'paid',
      category: 'Medications',
      description: 'Monthly prescription refill'
    },
    {
      id: 'BILL003',
      clientId: 'C002',
      vendor: 'Utility Company',
      amount: 156.00,
      dueDate: '2026-04-15',
      submittedDate: '2026-03-15',
      status: 'unpaid',
      category: 'Utilities',
      description: 'Monthly electric and water'
    }
  ],
  tasks: [
    {
      id: 'TSK001',
      clientId: 'C001',
      coordinatorId: 'COORD001',
      title: 'Confirm appointment with Dr. Patel',
      description: 'Call office to confirm April 15 appointment',
      dueDate: '2026-04-13',
      priority: 'high',
      status: 'pending',
      createdAt: '2026-04-08',
      category: 'Coordination'
    },
    {
      id: 'TSK002',
      clientId: 'C001',
      coordinatorId: 'COORD001',
      title: 'Follow up on lab results',
      description: 'Request results from Medical Center Lab',
      dueDate: '2026-04-18',
      priority: 'medium',
      status: 'pending',
      createdAt: '2026-04-08',
      category: 'Documentation'
    }
  ],
  coordinators: [
    {
      id: 'COORD001',
      name: 'Sarah Anderson',
      email: 'sarah@cwin.com',
      phone: '(312) 555-0150',
      assignedClients: ['C001', 'C002'],
      certifications: ['CCHI', 'Care Coordinator'],
      hoursPerMonth: 120
    },
    {
      id: 'COORD002',
      name: 'James Mitchell',
      email: 'james@cwin.com',
      phone: '(312) 555-0151',
      assignedClients: ['C003'],
      certifications: ['CCHI', 'Geriatric Care Manager'],
      hoursPerMonth: 160
    }
  ],
  adminUsers: [
    {
      id: 'ADMIN001',
      name: 'Dr. Emmanuel Chepkwony',
      email: 'emmanuel@cwin.com',
      role: 'AVP',
      permissions: ['view_all', 'edit_all', 'analytics', 'billing', 'team_management']
    }
  ]
};

// ==================== AGENTIC AI ORCHESTRATION ====================

class AIAgent {
  constructor() {
    this.capabilities = {
      appointment: new AppointmentAgent(),
      billing: new BillingAgent(),
      coordination: new CoordinationAgent(),
      documentation: new DocumentationAgent(),
      family: new FamilyAgent()
    };
  }

  async processRequest(request, context) {
    const { type, action, data, clientId, coordinatorId } = request;
    
    console.log(`[AI Agent] Processing ${type}:${action} for client ${clientId}`);

    if (!this.capabilities[type]) {
      return { error: 'Unknown request type', code: 'INVALID_TYPE' };
    }

    try {
      const result = await this.capabilities[type].execute(action, data, context);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message, code: 'AGENT_ERROR' };
    }
  }
}

// Appointment Agent: Autonomous scheduling, confirmations, reminders
class AppointmentAgent {
  async execute(action, data, context) {
    const { clientId } = context;

    switch (action) {
      case 'schedule':
        return this.scheduleAppointment(data, clientId);
      case 'confirm':
        return this.confirmAppointment(data.appointmentId, clientId);
      case 'reschedule':
        return this.rescheduleAppointment(data, clientId);
      case 'sendReminder':
        return this.sendReminder(data.appointmentId, clientId);
      case 'list':
        return this.listAppointments(clientId);
      case 'analyzeConflicts':
        return this.analyzeSchedulingConflicts(clientId);
      default:
        throw new Error(`Unknown appointment action: ${action}`);
    }
  }

  scheduleAppointment(data, clientId) {
    const appointment = {
      id: `APT${Date.now()}`,
      clientId,
      provider: data.provider,
      type: data.type,
      date: data.date,
      time: data.time,
      location: data.location || 'TBD',
      status: 'pending_confirmation',
      reminderSent: false,
      confirmationStatus: 'awaiting',
      notes: data.notes || ''
    };
    db.appointments.push(appointment);
    
    // Trigger reminder automation
    this.scheduleReminder(appointment.id, data.date);
    
    return {
      appointmentId: appointment.id,
      message: `Appointment scheduled with ${data.provider} on ${data.date} at ${data.time}`,
      nextStep: 'awaiting_confirmation'
    };
  }

  confirmAppointment(appointmentId, clientId) {
    const apt = db.appointments.find(a => a.id === appointmentId && a.clientId === clientId);
    if (!apt) throw new Error('Appointment not found');
    
    apt.status = 'scheduled';
    apt.confirmationStatus = 'confirmed';
    
    return {
      appointmentId,
      message: 'Appointment confirmed',
      status: 'scheduled'
    };
  }

  rescheduleAppointment(data, clientId) {
    const apt = db.appointments.find(a => a.id === data.appointmentId && a.clientId === clientId);
    if (!apt) throw new Error('Appointment not found');

    apt.date = data.newDate;
    apt.time = data.newTime;
    apt.status = 'pending_confirmation';
    apt.confirmationStatus = 'awaiting';

    return {
      appointmentId: apt.id,
      message: `Appointment rescheduled to ${data.newDate} at ${data.newTime}`,
      requiresConfirmation: true
    };
  }

  sendReminder(appointmentId, clientId) {
    const apt = db.appointments.find(a => a.id === appointmentId && a.clientId === clientId);
    if (!apt) throw new Error('Appointment not found');

    apt.reminderSent = true;

    const client = db.clients.find(c => c.id === clientId);
    return {
      appointmentId,
      message: `Reminder sent to ${client.name} for appointment with ${apt.provider} on ${apt.date} at ${apt.time}`,
      sentVia: client.preferences.communicationMethod,
      timestamp: new Date().toISOString()
    };
  }

  listAppointments(clientId) {
    return db.appointments.filter(a => a.clientId === clientId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  scheduleReminder(appointmentId, date) {
    // In production, this would integrate with a task queue (Bull, RabbitMQ, etc.)
    console.log(`[Reminder Scheduler] Scheduling reminder for appointment ${appointmentId} on ${date}`);
  }

  analyzeSchedulingConflicts(clientId) {
    const appointments = db.appointments.filter(a => a.clientId === clientId);
    const conflicts = [];

    for (let i = 0; i < appointments.length; i++) {
      for (let j = i + 1; j < appointments.length; j++) {
        const apt1 = appointments[i];
        const apt2 = appointments[j];
        
        if (apt1.date === apt2.date) {
          const time1 = parseInt(apt1.time.split(':').join(''));
          const time2 = parseInt(apt2.time.split(':').join(''));
          if (Math.abs(time1 - time2) < 100) { // Within 1 hour 40 minutes
            conflicts.push({
              appointments: [apt1.id, apt2.id],
              risk: 'scheduling_conflict',
              recommendation: 'Consider rescheduling one appointment'
            });
          }
        }
      }
    }

    return { conflicts, analysis: 'Scheduling analysis complete' };
  }
}

// Billing Agent: Reconciliation, payment tracking, insurance coordination
class BillingAgent {
  async execute(action, data, context) {
    const { clientId } = context;

    switch (action) {
      case 'listBills':
        return this.listBills(clientId);
      case 'reconcileBills':
        return this.reconcileBills(clientId);
      case 'processPayment':
        return this.processPayment(data, clientId);
      case 'verifyInsurance':
        return this.verifyInsuranceCoverage(clientId);
      case 'analyzeBillingTrends':
        return this.analyzeBillingTrends(clientId);
      case 'disputeBill':
        return this.initiateBillDispute(data, clientId);
      default:
        throw new Error(`Unknown billing action: ${action}`);
    }
  }

  listBills(clientId) {
    return db.bills.filter(b => b.clientId === clientId)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  reconcileBills(clientId) {
    const bills = db.bills.filter(b => b.clientId === clientId);
    const totalUnpaid = bills.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + b.amount, 0);
    const totalPaid = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0);
    const overdue = bills.filter(b => b.status === 'unpaid' && new Date(b.dueDate) < new Date());

    return {
      totalBills: bills.length,
      totalUnpaid,
      totalPaid,
      overdueCount: overdue.length,
      overdueBills: overdue.map(b => ({ id: b.id, vendor: b.vendor, amount: b.amount, daysOverdue: this.calculateDaysOverdue(b.dueDate) })),
      billsByCategory: this.groupByCategory(bills),
      recommendation: overdue.length > 0 ? 'Address overdue bills immediately' : 'Bills are current'
    };
  }

  processPayment(data, clientId) {
    const bill = db.bills.find(b => b.id === data.billId && b.clientId === clientId);
    if (!bill) throw new Error('Bill not found');

    bill.status = 'paid';
    bill.paidDate = new Date().toISOString().split('T')[0];

    return {
      billId: bill.id,
      message: `Payment processed for ${bill.vendor}: $${bill.amount.toFixed(2)}`,
      status: 'paid',
      paymentMethod: data.paymentMethod || 'Direct payment'
    };
  }

  verifyInsuranceCoverage(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    if (!client) throw new Error('Client not found');

    const insurance = client.insurance;
    return {
      provider: insurance.provider,
      memberId: insurance.memberId,
      coverageActive: true,
      deductibleMet: false,
      outOfPocketMax: 5000,
      currentOutOfPocket: 1250,
      nextVerificationDate: '2026-12-31',
      message: 'Insurance coverage verified and current'
    };
  }

  analyzeBillingTrends(clientId) {
    const bills = db.bills.filter(b => b.clientId === clientId);
    const monthlyAverage = bills.reduce((sum, b) => sum + b.amount, 0) / Math.max(bills.length, 1);

    return {
      monthlyAverage: monthlyAverage.toFixed(2),
      totalBilled: bills.reduce((sum, b) => sum + b.amount, 0).toFixed(2),
      topCategories: this.groupByCategory(bills),
      trend: 'Stable billing patterns',
      outliers: bills.filter(b => b.amount > monthlyAverage * 1.5)
    };
  }

  initiateBillDispute(data, clientId) {
    const bill = db.bills.find(b => b.id === data.billId && b.clientId === clientId);
    if (!bill) throw new Error('Bill not found');

    const dispute = {
      id: `DISP${Date.now()}`,
      billId: bill.id,
      clientId,
      reason: data.reason,
      amount: bill.amount,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      vendor: bill.vendor
    };

    return {
      disputeId: dispute.id,
      message: `Dispute initiated for bill from ${bill.vendor}`,
      status: 'submitted',
      expectedResolution: '10-15 business days'
    };
  }

  groupByCategory(bills) {
    const grouped = {};
    bills.forEach(b => {
      grouped[b.category] = (grouped[b.category] || 0) + b.amount;
    });
    return grouped;
  }

  calculateDaysOverdue(dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = today - due;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }
}

// Coordination Agent: Task management, provider coordination, scheduling
class CoordinationAgent {
  async execute(action, data, context) {
    const { clientId, coordinatorId } = context;

    switch (action) {
      case 'listTasks':
        return this.listTasks(clientId, coordinatorId);
      case 'createTask':
        return this.createTask(data, clientId, coordinatorId);
      case 'completeTask':
        return this.completeTask(data.taskId, clientId);
      case 'prioritizeTasks':
        return this.prioritizeTasks(clientId);
      case 'coordinateWithProviders':
        return this.coordinateWithProviders(data, clientId);
      case 'generateWeeklyPlan':
        return this.generateWeeklyPlan(clientId);
      default:
        throw new Error(`Unknown coordination action: ${action}`);
    }
  }

  listTasks(clientId, coordinatorId) {
    const tasks = db.tasks.filter(t => t.clientId === clientId);
    return tasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] ||
             new Date(a.dueDate) - new Date(b.dueDate);
    });
  }

  createTask(data, clientId, coordinatorId) {
    const task = {
      id: `TSK${Date.now()}`,
      clientId,
      coordinatorId,
      title: data.title,
      description: data.description || '',
      dueDate: data.dueDate,
      priority: data.priority || 'medium',
      status: 'pending',
      createdAt: new Date().toISOString(),
      category: data.category || 'Coordination'
    };
    db.tasks.push(task);

    return {
      taskId: task.id,
      message: `Task created: ${data.title}`,
      dueDate: task.dueDate,
      priority: task.priority
    };
  }

  completeTask(taskId, clientId) {
    const task = db.tasks.find(t => t.id === taskId && t.clientId === clientId);
    if (!task) throw new Error('Task not found');

    task.status = 'completed';
    task.completedAt = new Date().toISOString();

    return {
      taskId,
      message: `Task completed: ${task.title}`,
      status: 'completed'
    };
  }

  prioritizeTasks(clientId) {
    const tasks = this.listTasks(clientId);
    const today = new Date();

    const categorized = {
      urgent: [],
      upcoming: [],
      upcoming_week: [],
      later: []
    };

    tasks.forEach(t => {
      const dueDate = new Date(t.dueDate);
      const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

      if (t.priority === 'high' && daysUntilDue <= 1) {
        categorized.urgent.push(t);
      } else if (daysUntilDue <= 3) {
        categorized.upcoming.push(t);
      } else if (daysUntilDue <= 7) {
        categorized.upcoming_week.push(t);
      } else {
        categorized.later.push(t);
      }
    });

    return {
      prioritization: categorized,
      focusItem: categorized.urgent[0] || categorized.upcoming[0],
      message: 'Tasks prioritized by urgency and impact'
    };
  }

  coordinateWithProviders(data, clientId) {
    const client = db.clients.find(c => c.id === clientId);
    const message = {
      id: `MSG${Date.now()}`,
      clientId,
      providers: data.providers || client.providers,
      subject: data.subject,
      body: data.body || '',
      type: data.messageType || 'coordination',
      sentAt: new Date().toISOString(),
      status: 'sent'
    };

    return {
      messageId: message.id,
      providers: message.providers,
      message: `Coordination request sent to ${message.providers.length} provider(s)`,
      status: 'sent'
    };
  }

  generateWeeklyPlan(clientId) {
    const appointments = db.appointments.filter(a => a.clientId === clientId);
    const tasks = db.tasks.filter(t => t.clientId === clientId && t.status === 'pending');
    const bills = db.bills.filter(b => b.clientId === clientId && b.status === 'unpaid');

    return {
      weekPlan: {
        appointments,
        tasks: tasks.slice(0, 5),
        billsDue: bills.filter(b => new Date(b.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        focusItems: [
          ...tasks.filter(t => t.priority === 'high').slice(0, 2),
          ...appointments.slice(0, 2)
        ]
      },
      message: 'Weekly plan generated'
    };
  }
}

// Documentation Agent: Records management, document storage, compliance
class DocumentationAgent {
  async execute(action, data, context) {
    const { clientId } = context;

    switch (action) {
      case 'uploadDocument':
        return this.uploadDocument(data, clientId);
      case 'listDocuments':
        return this.listDocuments(clientId);
      case 'generateReport':
        return this.generateReport(data, clientId);
      case 'organizeDocuments':
        return this.organizeDocuments(clientId);
      default:
        throw new Error(`Unknown documentation action: ${action}`);
    }
  }

  uploadDocument(data, clientId) {
    const doc = {
      id: `DOC${Date.now()}`,
      clientId,
      name: data.name,
      type: data.type,
      category: data.category,
      uploadedAt: new Date().toISOString(),
      url: `/documents/${clientId}/${data.name}`,
      metadata: data.metadata || {}
    };
    db.clients.find(c => c.id === clientId).documents.push(doc);

    return {
      documentId: doc.id,
      message: `Document uploaded: ${data.name}`,
      category: data.category
    };
  }

  listDocuments(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    return client.documents || [];
  }

  generateReport(data, clientId) {
    return {
      reportId: `RPT${Date.now()}`,
      type: data.reportType,
      clientId,
      generatedAt: new Date().toISOString(),
      content: `Generated ${data.reportType} report for ${clientId}`,
      format: 'PDF'
    };
  }

  organizeDocuments(clientId) {
    const docs = this.listDocuments(clientId);
    const organized = {};

    docs.forEach(d => {
      if (!organized[d.category]) organized[d.category] = [];
      organized[d.category].push(d);
    });

    return {
      organized,
      totalDocuments: docs.length,
      categories: Object.keys(organized)
    };
  }
}

// Family Communication Agent: Updates, notifications, shared information
class FamilyAgent {
  async execute(action, data, context) {
    const { clientId } = context;

    switch (action) {
      case 'sendFamilyUpdate':
        return this.sendFamilyUpdate(data, clientId);
      case 'notifyFamily':
        return this.notifyFamily(data, clientId);
      case 'listFamilyContacts':
        return this.listFamilyContacts(clientId);
      case 'shareDocument':
        return this.shareDocument(data, clientId);
      default:
        throw new Error(`Unknown family action: ${action}`);
    }
  }

  sendFamilyUpdate(data, clientId) {
    const client = db.clients.find(c => c.id === clientId);
    const contacts = client.familyContacts || [];

    const update = {
      id: `UPD${Date.now()}`,
      clientId,
      subject: data.subject,
      message: data.message,
      sentAt: new Date().toISOString(),
      recipients: contacts.map(c => c.email),
      status: 'sent'
    };

    return {
      updateId: update.id,
      recipients: contacts.map(c => c.name),
      message: `Family update sent to ${contacts.length} contact(s)`,
      status: 'sent'
    };
  }

  notifyFamily(data, clientId) {
    const client = db.clients.find(c => c.id === clientId);
    const contacts = client.familyContacts || [];

    return {
      notificationId: `NOTIF${Date.now()}`,
      type: data.notificationType,
      recipients: contacts,
      message: data.message,
      sentAt: new Date().toISOString()
    };
  }

  listFamilyContacts(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    return client.familyContacts || [];
  }

  shareDocument(data, clientId) {
    const client = db.clients.find(c => c.id === clientId);
    const contacts = client.familyContacts || [];

    return {
      shareId: `SHARE${Date.now()}`,
      documentId: data.documentId,
      sharedWith: contacts.map(c => c.email),
      message: `Document shared with ${contacts.length} family member(s)`,
      expiresAt: data.expiresAt || null
    };
  }
}

const aiAgent = new AIAgent();

// ==================== API ROUTES ====================

// Authentication
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;

  // Simplified auth for demo
  const roles = {
    'margaret@email.com': { type: 'client', id: 'C001', name: 'Margaret Chen' },
    'robert@email.com': { type: 'client', id: 'C002', name: 'Robert Williams' },
    'helen@email.com': { type: 'client', id: 'C003', name: 'Helen Martinez' },
    'sarah@cwin.com': { type: 'coordinator', id: 'COORD001', name: 'Sarah Anderson' },
    'james@cwin.com': { type: 'coordinator', id: 'COORD002', name: 'James Mitchell' },
    'emmanuel@cwin.com': { type: 'admin', id: 'ADMIN001', name: 'Dr. Emmanuel Chepkwony' }
  };

  const user = roles[email];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    success: true,
    token: `token_${user.id}`,
    user
  });
});

// AI Agent Requests
app.post('/api/ai/request', async (req, res) => {
  try {
    const { type, action, data } = req.body;
    const userId = req.headers['x-user-id'];
    const userType = req.headers['x-user-type'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const context = {
      userId,
      userType,
      clientId: userType === 'client' ? userId : data.clientId,
      coordinatorId: userType === 'coordinator' ? userId : null
    };

    const result = await aiAgent.processRequest(
      { type, action, data },
      context
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clients
app.get('/api/clients/:id', (req, res) => {
  const client = db.clients.find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

app.get('/api/clients', (req, res) => {
  res.json(db.clients);
});

// Appointments
app.get('/api/appointments', (req, res) => {
  const clientId = req.query.clientId;
  const appointments = clientId
    ? db.appointments.filter(a => a.clientId === clientId)
    : db.appointments;
  res.json(appointments);
});

app.post('/api/appointments', (req, res) => {
  const appointment = {
    id: `APT${Date.now()}`,
    ...req.body,
    status: 'pending_confirmation',
    reminderSent: false
  };
  db.appointments.push(appointment);
  res.status(201).json(appointment);
});

// Bills
app.get('/api/bills', (req, res) => {
  const clientId = req.query.clientId;
  const bills = clientId
    ? db.bills.filter(b => b.clientId === clientId)
    : db.bills;
  res.json(bills);
});

// Tasks
app.get('/api/tasks', (req, res) => {
  const clientId = req.query.clientId;
  const tasks = clientId
    ? db.tasks.filter(t => t.clientId === clientId)
    : db.tasks;
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const task = {
    id: `TSK${Date.now()}`,
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  db.tasks.push(task);
  res.status(201).json(task);
});

// Analytics
app.get('/api/analytics/client/:id', (req, res) => {
  const clientId = req.params.id;
  const client = db.clients.find(c => c.id === clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const appointments = db.appointments.filter(a => a.clientId === clientId);
  const bills = db.bills.filter(b => b.clientId === clientId);
  const tasks = db.tasks.filter(t => t.clientId === clientId);

  res.json({
    clientId,
    clientName: client.name,
    statistics: {
      totalAppointments: appointments.length,
      scheduledAppointments: appointments.filter(a => a.status === 'scheduled').length,
      totalBillingValue: bills.reduce((sum, b) => sum + b.amount, 0),
      unpaidAmount: bills.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + b.amount, 0),
      tasksCompleted: tasks.filter(t => t.status === 'completed').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length
    },
    recentActivity: {
      appointments: appointments.slice(-3),
      bills: bills.slice(-3),
      tasks: tasks.slice(-3)
    }
  });
});

// Admin Dashboard
app.get('/api/admin/dashboard', (req, res) => {
  const totalClients = db.clients.length;
  const activeClients = db.clients.filter(c => c.status === 'active').length;
  const totalBilling = db.bills.reduce((sum, b) => sum + b.amount, 0);
  const unpaidBilling = db.bills.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + b.amount, 0);

  res.json({
    overview: {
      totalClients,
      activeClients,
      totalBilling,
      unpaidBilling,
      monthlyRevenue: activeClients * 2200,
      coordinatorCount: db.coordinators.length
    },
    clients: db.clients.map(c => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      status: c.status,
      monthlyRevenue: c.tier === 'Comprehensive' ? 2200 : c.tier === 'Essentials' ? 1200 : 3800
    })),
    billingStatus: db.bills.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {}),
    trends: {
      appointmentsThisMonth: db.appointments.filter(a => {
        const apt = new Date(a.date);
        const now = new Date();
        return apt.getMonth() === now.getMonth();
      }).length,
      billsOverdue: db.bills.filter(b => b.status === 'unpaid' && new Date(b.dueDate) < new Date()).length
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CWIN LifeCycle Admin Platform running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log('\n=== AI Agent Capabilities ===');
  console.log('✓ Appointment Management (scheduling, confirmations, reminders)');
  console.log('✓ Billing Management (reconciliation, payments, insurance)');
  console.log('✓ Care Coordination (task management, provider coordination)');
  console.log('✓ Documentation (records, reporting, compliance)');
  console.log('✓ Family Communication (updates, notifications, sharing)');
});
