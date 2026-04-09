import React, { useState, useEffect, useRef } from 'react';
import { Calendar, FileText, DollarSign, Users, Settings, LogOut, Menu, X, Plus, Edit2, Trash2, CheckCircle, Clock, AlertCircle, Send, Filter, Download, Phone, Mail, Home, TrendingUp, Zap, Shield, Brain, BarChart3, Activity, Phone as CallIcon } from 'lucide-react';

// API Configuration
const API_BASE = 'http://localhost:5000/api';

const CWINLifeCycleAdminPlatform = () => {
  const [userType, setUserType] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  // Data states
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [bills, setBills] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (email, password, role) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });

      if (!response.ok) throw new Error('Login failed');

      const data = await response.json();
      setCurrentUser(data.user);
      setUserType(data.user.type);

      // Load initial data
      if (data.user.type === 'admin') {
        await loadAdminDashboard();
      } else if (data.user.type === 'client') {
        await loadClientData(data.user.id);
      } else if (data.user.type === 'coordinator') {
        await loadCoordinatorData(data.user.id);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadClientData = async (clientId) => {
    try {
      const [appointmentsRes, billsRes, tasksRes, clientRes] = await Promise.all([
        fetch(`${API_BASE}/appointments?clientId=${clientId}`),
        fetch(`${API_BASE}/bills?clientId=${clientId}`),
        fetch(`${API_BASE}/tasks?clientId=${clientId}`),
        fetch(`${API_BASE}/clients/${clientId}`)
      ]);

      const [appointmentsData, billsData, tasksData, clientData] = await Promise.all([
        appointmentsRes.json(),
        billsRes.json(),
        tasksRes.json(),
        clientRes.json()
      ]);

      setAppointments(appointmentsData);
      setBills(billsData);
      setTasks(tasksData);
      setClientDetails(clientData);
      setSelectedClient(clientId);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadAdminDashboard = async () => {
    try {
      const [dashboardRes, clientsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/dashboard`),
        fetch(`${API_BASE}/clients`)
      ]);

      const [dashboardData, clientsData] = await Promise.all([
        dashboardRes.json(),
        clientsRes.json()
      ]);

      setAdminStats(dashboardData);
      setClients(clientsData);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadCoordinatorData = async (coordinatorId) => {
    try {
      const clientsRes = await fetch(`${API_BASE}/clients`);
      const clientsData = await clientsRes.json();
      setClients(clientsData);
    } catch (err) {
      setError(err.message);
    }
  };

  const sendAIRequest = async (type, action, data) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-type': userType
        },
        body: JSON.stringify({ type, action, data, clientId: selectedClient || data.clientId })
      });

      if (!response.ok) throw new Error('AI request failed');
      const result = await response.json();
      
      // Reload data based on action
      if (type === 'appointment') await loadClientData(selectedClient);
      if (type === 'billing') await loadClientData(selectedClient);
      if (type === 'coordination') await loadClientData(selectedClient);

      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
    finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUserType(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  if (!userType) {
    return <LoginPage onLogin={handleLogin} loading={loading} error={error} />;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Sidebar */}
      <SideBar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userType={userType}
        handleLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto flex flex-col">
        <Header currentUser={currentUser} userType={userType} onAIClick={() => setShowAIAssistant(true)} />

        <div className="p-8 overflow-y-auto">
          {userType === 'client' && (
            <ClientDashboard
              client={clientDetails}
              appointments={appointments}
              bills={bills}
              tasks={tasks}
              sendAIRequest={sendAIRequest}
              loading={loading}
            />
          )}
          {userType === 'coordinator' && (
            <CoordinatorDashboard
              clients={clients}
              appointments={appointments}
              bills={bills}
              tasks={tasks}
              setSelectedClient={setSelectedClient}
              selectedClient={selectedClient}
              sendAIRequest={sendAIRequest}
              loading={loading}
            />
          )}
          {userType === 'admin' && adminStats && (
            <AdminDashboard
              stats={adminStats}
              clients={clients}
              sendAIRequest={sendAIRequest}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* AI Assistant */}
      {showAIAssistant && (
        <AIAssistant
          userType={userType}
          onClose={() => setShowAIAssistant(false)}
          sendAIRequest={sendAIRequest}
          clientId={selectedClient}
          loading={loading}
        />
      )}
    </div>
  );
};

const LoginPage = ({ onLogin, loading, error }) => {
  const [email, setEmail] = useState('margaret@email.com');
  const [password, setPassword] = useState('demo');

  const demoAccounts = [
    { email: 'margaret@email.com', password: 'demo', role: 'client', name: 'Margaret (Client)' },
    { email: 'sarah@cwin.com', password: 'demo', role: 'coordinator', name: 'Sarah (Coordinator)' },
    { email: 'emmanuel@cwin.com', password: 'demo', role: 'admin', name: 'Dr. Emmanuel (Admin)' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">CWIN</h1>
            <p className="text-gray-600">LifeCycle Admin Platform</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                onClick={() => onLogin(account.email, account.password, account.role)}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Logging in...' : account.name}
              </button>
            ))}
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">Demo credentials available above. All roles enabled.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SideBar = ({ sidebarOpen, setSidebarOpen, activeTab, setActiveTab, userType, handleLogout }) => {
  const getNavItems = (type) => {
    const baseItems = [{ id: 'dashboard', label: 'Dashboard', icon: <Home size={20} /> }];
    
    if (type === 'client') {
      return [
        ...baseItems,
        { id: 'appointments', label: 'Appointments', icon: <Calendar size={20} /> },
        { id: 'bills', label: 'Bills', icon: <DollarSign size={20} /> },
        { id: 'documents', label: 'Documents', icon: <FileText size={20} /> },
        { id: 'family', label: 'Family', icon: <Users size={20} /> }
      ];
    } else if (type === 'coordinator') {
      return [
        ...baseItems,
        { id: 'clients', label: 'My Clients', icon: <Users size={20} /> },
        { id: 'tasks', label: 'Tasks', icon: <Zap size={20} /> },
        { id: 'scheduling', label: 'Scheduling', icon: <Calendar size={20} /> },
        { id: 'reports', label: 'Reports', icon: <FileText size={20} /> }
      ];
    } else {
      return [
        ...baseItems,
        { id: 'analytics', label: 'Analytics', icon: <TrendingUp size={20} /> },
        { id: 'clients', label: 'Clients', icon: <Users size={20} /> },
        { id: 'team', label: 'Team', icon: <Shield size={20} /> },
        { id: 'billing', label: 'Billing', icon: <DollarSign size={20} /> },
        { id: 'settings', label: 'Settings', icon: <Settings size={20} /> }
      ];
    }
  };

  const navItems = getNavItems(userType);

  return (
    <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 text-white transition-all duration-300 shadow-2xl flex flex-col`}>
      <div className="p-4 flex items-center justify-between border-b border-blue-700">
        {sidebarOpen && <h1 className="text-xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">CWIN</h1>}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-blue-800 rounded">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <nav className="mt-8 space-y-2 px-3 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === item.id
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg'
                : 'hover:bg-blue-800'
            }`}
          >
            {item.icon}
            {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-blue-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-all"
        >
          <LogOut size={18} />
          {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

const Header = ({ currentUser, userType, onAIClick }) => {
  const roleNames = { client: 'Client', coordinator: 'Care Coordinator', admin: 'Administrator' };
  
  return (
    <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Welcome, {currentUser.name}</h2>
          <p className="text-gray-600 mt-1">{roleNames[userType]} • {new Date().toLocaleDateString()}</p>
        </div>
        <button
          onClick={onAIClick}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Brain size={20} /> AI Assistant
        </button>
      </div>
    </div>
  );
};

const ClientDashboard = ({ client, appointments, bills, tasks, sendAIRequest, loading }) => {
  if (!client) return <div className="text-center py-12">Loading client data...</div>;

  const unpaidBills = bills.filter(b => b.status === 'unpaid');
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={<Calendar />} label="Upcoming Appointments" value={appointments.length} color="from-blue-500 to-cyan-500" />
        <StatCard icon={<DollarSign />} label="Pending Bills" value={unpaidBills.length} color="from-orange-500 to-red-500" />
        <StatCard icon={<Clock />} label="Action Items" value={pendingTasks.length} color="from-purple-500 to-pink-500" />
        <StatCard icon={<CheckCircle />} label="Subscription" value={client.tier} color="from-green-500 to-emerald-500" />
      </div>

      {/* Appointments */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900">📅 Upcoming Appointments</h3>
          <button
            onClick={() => sendAIRequest('appointment', 'schedule', {})}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            + Schedule
          </button>
        </div>
        <div className="space-y-4">
          {appointments.map((apt) => (
            <div key={apt.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
              <div>
                <p className="font-semibold text-gray-900">{apt.provider}</p>
                <p className="text-sm text-gray-600">{apt.type} • {apt.date} at {apt.time}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${apt.status === 'scheduled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {apt.status === 'scheduled' ? '✓ Confirmed' : '⏳ Pending'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bills */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900">💳 Bills & Payments</h3>
          <button
            onClick={() => sendAIRequest('billing', 'reconcileBills', {})}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            Reconcile
          </button>
        </div>
        <div className="space-y-4">
          {bills.map((bill) => (
            <div key={bill.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{bill.vendor}</p>
                <p className="text-sm text-gray-600">Due: {bill.dueDate}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-gray-900">${bill.amount.toFixed(2)}</p>
                <p className={`text-xs font-semibold ${bill.status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
                  {bill.status === 'paid' ? '✓ Paid' : '⚠️ Unpaid'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CoordinatorDashboard = ({ clients, appointments, bills, tasks, setSelectedClient, selectedClient, sendAIRequest, loading }) => {
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium' });

  const handleAddTask = async () => {
    if (newTask.title.trim()) {
      await sendAIRequest('coordination', 'createTask', {
        title: newTask.title,
        priority: newTask.priority,
        dueDate: new Date().toISOString().split('T')[0],
        category: 'Coordination',
        clientId: selectedClient
      });
      setNewTask({ title: '', priority: 'medium' });
      setShowAddTask(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Client Selection */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">👥 Select Client</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedClient === client.id
                  ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-500 shadow-lg'
                  : 'bg-gray-50 border-gray-200 hover:border-blue-300'
              }`}
            >
              <p className="font-semibold text-gray-900">{client.name}</p>
              <p className="text-sm text-gray-600">{client.tier}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900">✓ Action Items</h3>
          <button
            onClick={() => setShowAddTask(!showAddTask)}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            + Add Task
          </button>
        </div>

        {showAddTask && (
          <div className="p-4 bg-purple-50 rounded-lg mb-6 border border-purple-200">
            <input
              type="text"
              placeholder="Task description..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full px-4 py-2 border border-purple-300 rounded-lg mb-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button
                onClick={handleAddTask}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{task.title}</p>
                <p className="text-sm text-gray-600">Due: {task.dueDate}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                task.priority === 'high' ? 'bg-red-100 text-red-800' :
                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ stats, clients, sendAIRequest, loading }) => {
  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={<Users />} label="Active Clients" value={stats.overview.activeClients} color="from-blue-500 to-cyan-500" />
        <StatCard icon={<TrendingUp />} label="Monthly Revenue" value={`$${(stats.overview.monthlyRevenue / 1000).toFixed(1)}K`} color="from-green-500 to-emerald-500" />
        <StatCard icon={<AlertCircle />} label="Unpaid Bills" value={`$${stats.overview.unpaidBilling.toFixed(0)}`} color="from-red-500 to-orange-500" />
      </div>

      {/* Client Management */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">👥 Client Management</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Tier</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Monthly Revenue</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50 transition-all">
                  <td className="py-4 px-4 font-semibold text-gray-900">{client.name}</td>
                  <td className="py-4 px-4 text-gray-600">{client.tier}</td>
                  <td className="py-4 px-4"><span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">🟢 Active</span></td>
                  <td className="py-4 px-4 font-semibold text-gray-900">
                    ${client.tier === 'Comprehensive' ? '2,200' : client.tier === 'Essentials' ? '1,200' : '3,800'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AIAssistant = ({ userType, onClose, sendAIRequest, clientId, loading }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '👋 Hi! I\'m your CWIN AI Assistant. I can help you with appointment scheduling, bill reconciliation, task management, provider coordination, and document organization. What can I help you with?' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (input.trim()) {
      const userMsg = input.trim();
      setMessages([...messages, { role: 'user', text: userMsg }]);
      setInput('');

      // Determine AI action based on input
      const lowerMsg = userMsg.toLowerCase();
      let aiAction = null;

      if (lowerMsg.includes('schedule') || lowerMsg.includes('appointment')) {
        aiAction = { type: 'appointment', action: 'schedule', data: { provider: 'TBD', date: new Date().toISOString().split('T')[0], time: '10:00', type: 'Checkup' } };
      } else if (lowerMsg.includes('bill') || lowerMsg.includes('payment')) {
        aiAction = { type: 'billing', action: 'listBills', data: {} };
      } else if (lowerMsg.includes('task') || lowerMsg.includes('todo')) {
        aiAction = { type: 'coordination', action: 'listTasks', data: {} };
      } else if (lowerMsg.includes('family') || lowerMsg.includes('update')) {
        aiAction = { type: 'family', action: 'listFamilyContacts', data: {} };
      } else if (lowerMsg.includes('document') || lowerMsg.includes('file')) {
        aiAction = { type: 'documentation', action: 'listDocuments', data: {} };
      }

      if (aiAction) {
        const result = await sendAIRequest(aiAction.type, aiAction.action, aiAction.data);
        if (result && result.success) {
          setMessages(prev => [...prev, { role: 'assistant', text: `✅ ${JSON.stringify(result.data).substring(0, 100)}...` }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: 'I can help with appointments, bills, tasks, family coordination, or documents. Could you be more specific?' }]);
      }
    }
  };

  return (
    <div className="fixed bottom-8 right-8 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col h-96 z-50">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-xl flex justify-between items-center">
        <h3 className="font-bold">🤖 AI Assistant</h3>
        <button onClick={onClose} className="p-1 hover:bg-white hover:bg-opacity-20 rounded"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-2 rounded-lg text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4 bg-white rounded-b-xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className={`bg-gradient-to-br ${color} text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold opacity-90">{label}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
      </div>
      <div className="p-3 bg-white bg-opacity-20 rounded-lg">{icon}</div>
    </div>
  </div>
);

export default CWINLifeCycleAdminPlatform;
