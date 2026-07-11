// CoreWard - Application Entry Point (Enhanced Debugging)

(function() {
  'use strict';

  console.log('[CoreWard] 🚀 App.js loading...');

  if (typeof EventBus === 'undefined' || !EventBus.emit) {
    console.error('[CoreWard] ❌ EventBus not loaded!');
    document.body.innerHTML = '<div style="padding:20px;color:red;text-align:center;"><h1>خطأ في تحميل EventBus</h1><p>يرجى إعادة تحميل الصفحة (Ctrl+F5)</p></div>';
    return;
  }

  console.log('[CoreWard] ✅ EventBus OK');

  class App {
    constructor() {
      this.currentTab = 'dashboard';
      this.components = {};
      this.alertCheckInterval = null;
      console.log('[CoreWard] 🔧 App constructor');
      this.init();
    }

    async init() {
      try {
        console.log('[CoreWard] 🔄 Initializing...');
        
        if (!window.stateManager) {
          throw new Error('StateManager not loaded');
        }
        
        await window.stateManager.load();
        console.log('[CoreWard] ✅ StateManager loaded');
        
        this.setupEventListeners();
        this.setupNetworkListeners();

        const currentUser = window.stateManager.getCurrentUser();
        console.log('[CoreWard] 👤 Current user:', currentUser ? currentUser.name : 'None');
        
        if (currentUser) {
          this.showApp();
          this.renderTabs();
          this.switchTab(this.currentTab);
          this.startAlertChecking();
        } else {
          this.showLogin();
        }
        console.log('[CoreWard] ✅ App initialized successfully');
      } catch (err) {
        console.error('[CoreWard] ❌ Init error:', err);
        document.body.innerHTML = '<div style="padding:20px;color:red;text-align:center;"><h1>خطأ في التهيئة</h1><p>' + err.message + '</p></div>';
      }
    }

    setupEventListeners() {
      var self = this;

      document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleLogin();
      });

      document.getElementById('btnLogout').addEventListener('click', function() { self.handleLogout(); });
      document.getElementById('btnSync').addEventListener('click', function() { self.handleSync(); });
      document.getElementById('btnExport').addEventListener('click', function() { self.handleExport(); });
      document.getElementById('btnImport').addEventListener('click', function() {
        document.getElementById('importFile').click();
      });
      document.getElementById('importFile').addEventListener('change', function(e) {
        if (e.target.files.length > 0) self.handleImport(e.target.files[0]);
      });

      document.getElementById('globalSearch').addEventListener('input', function(e) {
        EventBus.emit('search', e.target.value.trim());
      });

      EventBus.on('stateLoaded', function() { self.updateUI(); });
      EventBus.on('userLoggedIn', function(user) {
        console.log('[CoreWard] ✅ User logged in:', user.name);
        self.showApp();
        self.renderTabs();
        self.showToast('تم تسجيل الدخول بنجاح!', 'success');
        self.startAlertChecking();
      });
      EventBus.on('userLoggedOut', function() {
        self.showLogin();
        self.showToast('تم تسجيل الخروج', 'info');
        self.stopAlertChecking();
      });
      EventBus.on('networkOnline', function() { self.updateConnectionStatus(true); });
      EventBus.on('networkOffline', function() { self.updateConnectionStatus(false); });
      EventBus.on('stateChanged', function() {
        if (self.components[self.currentTab]) {
          self.components[self.currentTab].render();
        }
      });
    }

    setupNetworkListeners() {
      window.addEventListener('online', function() { window.stateManager.setOnline(true); });
      window.addEventListener('offline', function() { window.stateManager.setOnline(false); });
    }

    async handleLogin() {
      var email = document.getElementById('loginEmail').value;
      var password = document.getElementById('loginPassword').value;
      var errorEl = document.getElementById('loginError');
      var btn = document.getElementById('loginBtn');
      var originalText = btn.innerHTML;

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
      var btn = document.getElementById('btnSync');
      btn.disabled = true;
      try {
        await window.stateManager.syncFullState();
        await window.stateManager.processSyncQueue();
        this.showToast('تمت المزامنة بنجاح!', 'success');
      } catch (err) {
        this.showToast('فشل المزامنة: ' + (err.message || ''), 'error');
      } finally {
        setTimeout(function() { btn.disabled = false; }, 1000);
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
      var user = window.stateManager.getCurrentUser();
      if (user) {
        document.getElementById('userBadge').textContent = getRoleEmoji(user.role) + ' ' + user.name;
      }
    }

    renderTabs() {
      var navEl = document.getElementById('appNav');
      var currentUser = window.stateManager.getCurrentUser();
      var html = '';
      var self = this;

      TABS.forEach(function(tab) {
        if (tab.permission && !hasPermission(currentUser.role, tab.permission)) return;
        var isActive = tab.id === self.currentTab;
        var badgeHtml = '';

        if (tab.id === 'alerts') {
          var unreadCount = self.getUnreadAlertsCount();
          if (unreadCount > 0) {
            badgeHtml = '<div class="badge">' + unreadCount + '</div>';
          }
        }

        if (tab.id === 'tasks') {
          var pendingCount = self.getPendingTasksCount();
          if (pendingCount > 0) {
            badgeHtml = '<div class="badge">' + pendingCount + '</div>';
          }
        }

        html += '<button class="nav-tab ' + (isActive ? 'active' : '') + '" data-tab="' + tab.id + '">' +
          '<div class="tab-icon">' + tab.icon + '</div>' +
          '<div>' + tab.label + '</div>' +
          badgeHtml +
          '</button>';
      });

      navEl.innerHTML = html;
      navEl.querySelectorAll('.nav-tab').forEach(function(btn) {
        btn.addEventListener('click', function() {
          self.switchTab(btn.dataset.tab);
        });
      });
    }

    switchTab(tabId) {
      console.log('[CoreWard] 🔄 Switching to tab:', tabId);
      
      var tab = TABS.find(function(t) { return t.id === tabId; });
      var currentUser = window.stateManager.getCurrentUser();

      if (tab && tab.permission && !hasPermission(currentUser.role, tab.permission)) {
        this.showToast('ليس لديك صلاحية الوصول', 'error');
        return;
      }

      this.currentTab = tabId;
      document.querySelectorAll('.nav-tab').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      });

      if (!this.components[tabId]) {
        console.log('[CoreWard] 📦 Loading component:', tabId);
        this.loadComponent(tabId);
      }
      
      if (this.components[tabId]) {
        console.log('[CoreWard] 🎨 Rendering component:', tabId);
        this.components[tabId].render();
      } else {
        console.error('[CoreWard] ❌ Component not found:', tabId);
      }

      var fab = document.getElementById('fab');
      if (['ward', 'tasks', 'handover', 'clinic', 'users', 'alerts'].indexOf(tabId) !== -1) {
        var self = this;
        fab.style.display = 'block';
        fab.onclick = function() {
          if (self.components[tabId] && typeof self.components[tabId].showAddForm === 'function') {
            self.components[tabId].showAddForm();
          }
        };
      } else {
        fab.style.display = 'none';
      }

      EventBus.emit('switchTab', tabId);
    }

    loadComponent(tabId) {
      var componentMap = {
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

      var ComponentClass = componentMap[tabId];
      if (ComponentClass) {
        try {
          this.components[tabId] = new ComponentClass();
          console.log('[CoreWard] ✅ Component loaded:', tabId);
        } catch (err) {
          console.error('[CoreWard] ❌ Failed to load component:', tabId, err);
        }
      } else {
        console.warn('[CoreWard] ⚠️ Unknown tab:', tabId);
      }
    }

    updateConnectionStatus(isOnline) {
      var statusDot = document.getElementById('statusDot');
      var statusText = document.getElementById('statusText');
      statusDot.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
      statusText.textContent = isOnline ? 'متصل' : 'غير متصل';
    }

    showToast(message, type) {
      type = type || 'info';
      var container = document.getElementById('toastContainer');
      var toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = '<span>' + escapeHtml(message) + '</span>';
      container.appendChild(toast);

      setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(function() {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 3000);
    }

    showError(message) {
      var errorEl = document.getElementById('loginError');
      errorEl.textContent = escapeHtml(message);
      errorEl.style.display = 'block';
    }

    showModal(title, content, footer) {
      footer = footer || '';
      var container = document.getElementById('modalContainer');
      container.innerHTML = '<div class="modal">' +
        '<div class="modal-header">' +
        '<div class="modal-title">' + escapeHtml(title) + '</div>' +
        '<button class="modal-close" id="modalClose">✕</button>' +
        '</div>' +
        '<div class="modal-body">' + content + '</div>' +
        (footer ? '<div class="modal-footer">' + footer + '</div>' : '') +
        '</div>';
      container.classList.add('active');

      var closeModal = function() {
        container.classList.remove('active');
        setTimeout(function() { container.innerHTML = ''; }, 300);
      };

      document.getElementById('modalClose').onclick = closeModal;
      container.onclick = function(e) {
        if (e.target === container) closeModal();
      };
    }

    getUnreadAlertsCount() {
      var alerts = window.stateManager.getAlerts();
      var currentUser = window.stateManager.getCurrentUser();
      return alerts.filter(function(a) {
        if (a.read) return false;
        if (a.targetIntern && a.targetIntern !== currentUser.id) return false;
        if (a.targetRole && a.targetRole !== currentUser.role) return false;
        return true;
      }).length;
    }

    getPendingTasksCount() {
      var tasks = window.stateManager.getTasks();
      var currentUser = window.stateManager.getCurrentUser();
      return tasks.filter(function(t) {
        if (t.completed) return false;
        if (currentUser.role === 'intern' && t.assignee !== currentUser.id) return false;
        return true;
      }).length;
    }

    startAlertChecking() {
      this.stopAlertChecking();
      var self = this;
      this.alertCheckInterval = setInterval(function() {
        self.checkSmartAlerts();
        self.renderTabs();
      }, 60000);
    }

    stopAlertChecking() {
      if (this.alertCheckInterval) {
        clearInterval(this.alertCheckInterval);
        this.alertCheckInterval = null;
      }
    }

    checkSmartAlerts() {
      var currentUser = window.stateManager.getCurrentUser();
      if (!currentUser) return;

      var tasks = window.stateManager.getTasks();
      tasks.forEach(function(task) {
        if (task.completed || task.alertSent) return;
        if (!isTaskOverdue(task)) return;

        if (task.assignee === currentUser.id || currentUser.role === 'director') {
          task.alertSent = true;
          window.stateManager.addAlert(
            '⏰ مهمة متأخرة',
            'المهمة "' + task.description + '" متأخرة عن موعدها',
            null,
            task.assignee
          ).catch(function(err) {
            console.error('Alert creation failed:', err);
            task.alertSent = false;
          });
        }
      });

      var patients = window.stateManager.getPatients();
      patients.forEach(function(patient) {
        if (patient.status !== 'critical' || patient.criticalAlertSent) return;
        if (patient.status === 'discharged') return;

        patient.criticalAlertSent = true;
        window.stateManager.addAlert(
          '🚨 حالة حرجة',
          'المريض ' + patient.name + ' في حالة حرجة - السرير ' + (patient.bed || 'غير محدد'),
          null,
          null
        ).catch(function(err) {
          console.error('Critical alert failed:', err);
          patient.criticalAlertSent = false;
        });
      });

      this.renderTabs();
    }
  }

  window.app = new App();
  console.log('[CoreWard] ✅ App instance created');
})();