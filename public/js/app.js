// CoreWard - Application Entry Point
// Main app logic, routing, and initialization

class App {
  constructor() {
    this.currentTab = 'dashboard';
    this.components = {};
    this.init();
  }

  async init() {
    // Initialize state manager
    await window.stateManager.load();

    // Setup event listeners
    this.setupEventListeners();
    this.setupNetworkListeners();

    // Check if user is logged in
    const currentUser = window.stateManager.getCurrentUser();
    if (currentUser) {
      this.showApp();
      this.renderTabs();
      this.switchTab(this.currentTab);
    } else {
      this.showLogin();
    }
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', () => {
      this.handleLogout();
    });

    // Sync
    document.getElementById('btnSync').addEventListener('click', () => {
      this.handleSync();
    });

    // Export
    document.getElementById('btnExport').addEventListener('click', () => {
      window.stateManager.exportData();
    });

    // Import
    document.getElementById('btnImport').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleImport(e.target.files[0]);
      }
    });

    // Global search
    document.getElementById('globalSearch').addEventListener('input', (e) => {
      EventBus.emit('search', e.target.value.trim());
    });

    // Tab switching
    EventBus.on('switchTab', (tabId) => {
      this.switchTab(tabId);
    });

    // State events
    EventBus.on('stateLoaded', () => {
      this.updateUI();
    });
    EventBus.on('stateSaved', () => {
      // Nothing to do
    });
    EventBus.on('userLoggedIn', (user) => {
      this.showApp();
      this.renderTabs();
      this.showToast('تم تسجيل الدخول بنجاح!', 'success');
    });
    EventBus.on('userLoggedOut', () => {
      this.showLogin();
      this.showToast('تم تسجيل الخروج', 'info');
    });
    EventBus.on('networkOnline', () => {
      this.updateConnectionStatus(true);
    });
    EventBus.on('networkOffline', () => {
      this.updateConnectionStatus(false);
    });
    EventBus.on('stateChanged', (data) => {
      if (this.components[this.currentTab]) {
        this.components[this.currentTab].render();
      }
    });
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      window.stateManager.setOnline(true);
    });
    window.addEventListener('offline', () => {
      window.stateManager.setOnline(false);
    });
  }

  handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    if (!email || !password) {
      this.showError('يرجى إدخال البريد وكلمة المرور');
      return;
    }

    const btn = document.getElementById('loginBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    window.stateManager.loginUser(email, password)
      .then(() => {
        errorEl.style.display = 'none';
        btn.innerHTML = originalText;
        btn.disabled = false;
      })
      .catch(err => {
        console.error('Login failed:', err);
        this.showError(err.message || 'فشل تسجيل الدخول');
        btn.innerHTML = originalText;
        btn.disabled = false;
      });
  }

  handleLogout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      window.stateManager.logoutUser();
    }
  }

  handleSync() {
    const btn = document.getElementById('btnSync');
    const originalContent = btn.textContent;
    btn.textContent = '🔄';
    btn.disabled = true;

    window.stateManager.syncFullState()
      .then(() => {
        this.showToast('تمت المزامنة بنجاح!', 'success');
      })
      .catch(err => {
        console.error('Sync failed:', err);
        this.showToast('فشل المزامنة: ' + (err.message || ''), 'error');
      })
      .finally(() => {
        setTimeout(() => {
          btn.textContent = originalContent;
          btn.disabled = false;
        }, 1000);
      });
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
      console.error('Import failed:', err);
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
    let html = '';

    TABS.forEach(tab => {
      // Skip tabs without permission
      if (tab.permission && !hasPermission(window.stateManager.getCurrentUser().role, tab.permission)) {
        return;
      }
      const isActive = tab.id === this.currentTab;
      html += `
        <button class="nav-tab ${isActive ? 'active' : ''}" data-tab="${tab.id}">
          <div class="tab-icon">${tab.icon}</div>
          <div>${tab.label}</div>
        </button>
      `;
    });

    navEl.innerHTML = html;

    // Add click listeners
    navEl.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });
  }

  switchTab(tabId) {
    // Check permission
    const tab = TABS.find(t => t.id === tabId);
    if (tab && tab.permission && !hasPermission(window.stateManager.getCurrentUser().role, tab.permission)) {
      this.showToast('ليس لديك صلاحية الوصول إلى هذه الصفحة', 'error');
      return;
    }

    this.currentTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Load component if not loaded
    if (!this.components[tabId]) {
      this.loadComponent(tabId);
    }

    // Render component
    if (this.components[tabId]) {
      this.components[tabId].render();
    }

    // Update FAB visibility
    const fab = document.getElementById('fab');
    if (['ward', 'tasks', 'handover'].includes(tabId)) {
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
    switch (tabId) {
      case 'dashboard':
        this.components.dashboard = new Dashboard();
        break;
      case 'ward':
        this.components.ward = new WardComponent();
        break;
      case 'tasks':
        this.components.tasks = new TasksComponent();
        break;
      case 'clinic':
        this.components.clinic = new ClinicComponent();
        break;
      case 'team':
        this.components.team = new TeamComponent();
        break;
      case 'handover':
        this.components.handover = new SbarHandover();
        break;
      case 'audit':
        this.components.audit = new AuditLog();
        break;
      default:
        console.warn('Unknown tab:', tabId);
    }
  }

  updateConnectionStatus(isOnline) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    if (isOnline) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'متصل';
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'غير متصل';
    }
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
        if (toast.parentNode) {
          toast.parentNode.removeChild(tost);
        }
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

    document.getElementById('modalClose').onclick = () => {
      container.classList.remove('active');
      setTimeout(() => container.innerHTML = '', 300);
    };

    // Close on outside click
    container.onclick = (e) => {
      if (e.target === container) {
        container.classList.remove('active');
        setTimeout(() => container.innerHTML = '', 300);
      }
    };
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});