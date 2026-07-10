// CoreWard - Application Entry Point (Fixed + Enhanced)

class App {
  constructor() {
    this.currentTab = 'dashboard';
    this.components = {};
    this.alertCheckInterval = null;
    this.init();
  }

  async init() {
    await window.stateManager.load();
    this.setupEventListeners();
    this.setupNetworkListeners();

    const currentUser = window.stateManager.getCurrentUser();
    if (currentUser) {
      this.showApp();
      this.renderTabs();
      this.switchTab(this.currentTab);
      this.startAlertChecking();
    } else {
      this.showLogin();
    }
  }

  setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('btnLogout').addEventListener('click', () => this.handleLogout());
    document.getElementById('btnSync').addEventListener('click', () => this.handleSync());
    document.getElementById('btnExport').addEventListener('click', () => this.handleExport());
    document.getElementById('btnImport').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.handleImport(e.target.files[0]);
    });

    document.getElementById('globalSearch').addEventListener('input', (e) => {
      EventBus.emit('search', e.target.value.trim());
    });

    EventBus.on('switchTab', (tabId) => this.switchTab(tabId));
    EventBus.on('stateLoaded', () => this.updateUI());
    EventBus.on('userLoggedIn', (user) => {
      this.showApp();
      this.renderTabs();
      this.showToast('تم تسجيل الدخول بنجاح!', 'success');
      this.startAlertChecking();
    });
    EventBus.on('userLoggedOut', () => {
      this.showLogin();
      this.showToast('تم تسجيل الخروج', 'info');
      this.stopAlertChecking();
    });
    EventBus.on('networkOnline', () => this.updateConnectionStatus(true));
    EventBus.on('networkOffline', () => this.updateConnectionStatus(false));
    EventBus.on('stateChanged', () => {
      if (this.components[this.currentTab]) {
        this.components[this.currentTab].render();
      }
    });
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => window.stateManager.setOnline(true));
    window.addEventListener('offline', () => window.stateManager.setOnline(false));
  }

  async handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    const originalText = btn.innerHTML;

    if (!email || !password) {
      this.showError('يرجى إدخال البريد وكلمة المرور');
      return;
    }

    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
      await window.stateManager.loginUser(email, password);
      errorEl.style.display = 'none';
    } catch (err) {
      console.error('Login failed:', err);
      this.showError(err.message || 'فشل تسجيل الدخول');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  handleLogout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      window.stateManager.logoutUser();
    }
  }

  async handleSync() {
    const btn = document.getElementById('btnSync');
    btn.disabled = true;
    try {
      await window.stateManager.syncFullState();
      await window.stateManager.processSyncQueue();
      this.showToast('تمت المزامنة بنجاح!', 'success');
    } catch (err) {
      this.showToast('فشل المزامنة: ' + (err.message || ''), 'error');
    } finally {
      setTimeout(() => btn.disabled = false, 1000);
    }
  }

  handleExport() {
    try {
      window.stateManager.exportData();
      this.showToast('تم تصدير البيانات بنجاح!', 'success');
    } catch (err) {
      this.showToast('فشل التصدير: ' + (err.message || ''), 'error');
    }
  }

  async handleImport(file) {
    if (!file.name.endsWith('.json')) {
      this.showToast('يرجى اختيار ملف JSON صالح', 'error');
      return;
    }
    try {
      await window.stateManager.importData(file);
      this.showToast('تم استيراد البيانات بنجاح!', 'success');
      if (this.components[this.currentTab]) {
        this.components[this.currentTab].render();
      }
    } catch (err) {
      this.showToast('فشل الاستيراد: ' + (err.message || ''), 'error');
    }
  }

  showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }

  showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this.updateUI();
  }

  updateUI() {
    const user = window.stateManager.getCurrentUser();
    if (user) {
      document.getElementById('userBadge').textContent = `${getRoleEmoji(user.role)} ${user.name}`;
    }
  }

  renderTabs() {
    const navEl = document.getElementById('appNav');
    const currentUser = window.stateManager.getCurrentUser();
    let html = '';

    TABS.forEach(tab => {
      if (tab.permission && !hasPermission(currentUser.role, tab.permission)) return;
      const isActive = tab.id === this.currentTab;
      let badgeHtml = '';
      
      // Add badge for alerts tab
      if (tab.id === 'alerts') {
        const unreadCount = this.getUnreadAlertsCount();
        if (unreadCount > 0) {
          badgeHtml = `<div class="badge">${unreadCount}</div>`;
        }
      }
      
      // Add badge for tasks tab
      if (tab.id === 'tasks') {
        const pendingCount = this.getPendingTasksCount();
        if (pendingCount > 0) {
          badgeHtml = `<div class="badge">${pendingCount}</div>`;
        }
      }

      html += `
        <button class="nav-tab ${isActive ? 'active' : ''}" data-tab="${tab.id}">
          <div class="tab-icon">${tab.icon}</div>
          <div>${tab.label}</div>
          ${badgeHtml}
        </button>
      `;
    });

    navEl.innerHTML = html;
    navEl.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
  }

  switchTab(tabId) {
    const tab = TABS.find(t => t.id === tabId);
    const currentUser = window.stateManager.getCurrentUser();
    
    if (tab && tab.permission && !hasPermission(currentUser.role, tab.permission)) {
      this.showToast('ليس لديك صلاحية الوصول إلى هذه الصفحة', 'error');
      return;
    }

    this.currentTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    if (!this.components[tabId]) this.loadComponent(tabId);
    if (this.components[tabId]) this.components[tabId].render();

    const fab = document.getElementById('fab');
    if (['ward', 'tasks', 'handover', 'clinic', 'users', 'alerts'].includes(tabId)) {
      fab.style.display = 'block';
      fab.onclick = () => {
        if (this.components[tabId] && typeof this.components[tabId].showAddForm === 'function') {
          this.components[tabId].showAddForm();
        }
      };
    } else {
      fab.style.display = 'none';
    }

    EventBus.emit('switchTab', tabId);
  }

  loadComponent(tabId) {
    const componentMap = {
      'dashboard': Dashboard,
      'ward': WardComponent,
      'tasks': TasksComponent,
      'clinic': ClinicComponent,
      'team': TeamComponent,
      'handover': SbarHandover,
      'audit': AuditLog,
      'users': UserManagement,
      'alerts': SmartAlerts
    };
    
    const ComponentClass = componentMap[tabId];
    if (ComponentClass) {
      this.components[tabId] = new ComponentClass();
    } else {
      console.warn('Unknown tab:', tabId);
    }
  }

  updateConnectionStatus(isOnline) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    statusText.textContent = isOnline ? 'متصل' : 'غير متصل';
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast); // FIXED: was 'tost'
      }, 300);
    }, 3000);
  }

  showError(message) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = escapeHtml(message);
    errorEl.style.display = 'block';
  }

  showModal(title, content, footer = '') {
    const container = document.getElementById('modalContainer');
    container.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${escapeHtml(title)}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;
    container.classList.add('active');

    const closeModal = () => {
      container.classList.remove('active');
      setTimeout(() => container.innerHTML = '', 300);
    };

    document.getElementById('modalClose').onclick = closeModal;
    container.onclick = (e) => {
      if (e.target === container) closeModal();
    };
  }

  getUnreadAlertsCount() {
    const alerts = window.stateManager.getAlerts();
    const currentUser = window.stateManager.getCurrentUser();
    return alerts.filter(a => {
      if (a.read) return false;
      if (a.targetIntern && a.targetIntern !== currentUser.id) return false;
      if (a.targetRole && a.targetRole !== currentUser.role) return false;
      return true;
    }).length;
  }

  getPendingTasksCount() {
    const tasks = window.stateManager.getTasks();
    const currentUser = window.stateManager.getCurrentUser();
    return tasks.filter(t => {
      if (t.completed) return false;
      if (currentUser.role === 'intern' && t.assignee !== currentUser.id) return false;
      return true;
    }).length;
  }

  startAlertChecking() {
    this.stopAlertChecking();
    this.alertCheckInterval = setInterval(() => {
      this.checkSmartAlerts();
      this.renderTabs(); // Update badges
    }, 60000); // Check every minute
  }

  stopAlertChecking() {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }
  }

  checkSmartAlerts() {
    const currentUser = window.stateManager.getCurrentUser();
    if (!currentUser) return;

    // Check overdue tasks
    const tasks = window.stateManager.getTasks();
    tasks.forEach(task => {
      if (task.completed || task.alertSent) return;
      if (isTaskOverdue(task)) {
        if (task.assignee === currentUser.id || currentUser.role === 'director') {
          window.stateManager.addAlert(
            '⏰ مهمة متأخرة',
            `المهمة "${task.description}" متأخرة عن موعدها`,
            null,
            task.assignee
          );
          task.alertSent = true;
        }
      }
    });

    // Check critical patients
    const patients = window.stateManager.getPatients();
    patients.forEach(patient => {
      if (patient.status === 'critical' && !patient.alertSent) {
        window.stateManager.addAlert(
          '🚨 حالة حرجة',
          `المريض ${patient.name} في حالة حرجة`,
          null,
          null
        );
        patient.alertSent = true;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});