// ================================================================
//  مدير الحالة (State Manager) – مع طابور مزامنة ذكي + تنبيهات
// ================================================================
class StateManager {
  constructor() {
    this.store = localforage.createInstance({ name: 'CoreWard', storeName: 'state' });
    this.state = {
      patients: [],
      tasks: [],
      handovers: [],
      clinicSlots: [],
      teamMembers: [],
      teamMessages: [],
      auditLog: [],
      alerts: [],
      currentRole: 'intern',
      currentUser: null,
      searchQuery: '',
      syncQueue: [],
      _version: '1.0.0'
    };
    this.syncInProgress = false;
    this.offlineMode = !navigator.onLine;
    this.notifications = [];
  }

  async load() {
    try {
      const saved = await this.store.getItem('state');
      if (saved) {
        if (saved._version !== this.state._version) {
          this._migrate(saved);
        } else {
          this.state = { ...this.state, ...saved };
        }
      }
      window.addEventListener('online', () => this._handleOnline());
      window.addEventListener('offline', () => this._handleOffline());
      bus.emit('stateLoaded', this.state);
      return this.state;
    } catch (e) {
      console.warn('⚠️ فشل تحميل الحالة:', e);
      return this.state;
    }
  }

  async save() {
    try {
      this.state._version = '1.0.0';
      await this.store.setItem('state', this.state);
      bus.emit('stateSaved', this.state);
      this._checkForAlerts();
      return true;
    } catch (e) {
      console.warn('⚠️ فشل حفظ الحالة:', e);
      return false;
    }
  }

  _migrate(oldState) {
    const merged = { ...this.state, ...oldState };
    if (!merged.syncQueue) merged.syncQueue = [];
    if (!merged.auditLog) merged.auditLog = [];
    if (!merged.alerts) merged.alerts = [];
    this.state = merged;
    this.save();
  }

  get() { return this.state; }
  set(newState) { this.state = { ...this.state, ...newState }; this.save(); }
  update(key, value) { this.state[key] = value; this.save(); }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-User-Role': this.state.currentRole || 'intern',
      'X-User-Name': this.state.currentUser?.name || 'جهاز محلي'
    };
  }

  // ─── طابور المزامنة ───
  addToQueue(collection, method, data, entityId) {
    const op = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      collection,
      method,
      data: data ? JSON.parse(JSON.stringify(data)) : null,
      entityId: entityId || data?.id || null,
      timestamp: Date.now()
    };
    this.state.syncQueue.push(op);
    this.save();
    bus.emit('syncQueueUpdated', this.state.syncQueue);
    if (navigator.onLine) this.processSyncQueue();
  }

  _updateAllEntityIds(obj, oldId, newId) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (obj[key] === oldId) {
        obj[key] = newId;
      } else if (Array.isArray(obj[key])) {
        obj[key] = obj[key].map(item => item === oldId ? newId : item);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this._updateAllEntityIds(obj[key], oldId, newId);
      }
    }
  }

  async processSyncQueue() {
    if (this.syncInProgress || !navigator.onLine) return;
    if (this.state.syncQueue.length === 0) return;

    this.syncInProgress = true;
    bus.emit('syncStarted');

    try {
      const grouped = {};
      for (const op of this.state.syncQueue) {
        const key = `${op.collection}:${op.entityId}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(op);
      }

      for (const [key, operations] of Object.entries(grouped)) {
        operations.sort((a, b) => a.timestamp - b.timestamp);
        const firstOp = operations[0];
        let currentId = firstOp.entityId;
        const headers = this.getHeaders();

        if (firstOp.method === 'POST') {
          try {
            const url = `/api/${firstOp.collection}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(firstOp.data)
            });
            if (!response.ok) throw new Error(`POST failed: ${response.status}`);
            const result = await response.json();
            const realId = result.item?.id || result.id || result._id;

            if (realId && realId !== currentId) {
              for (let i = 1; i < operations.length; i++) {
                const op = operations[i];
                if (op.entityId === currentId) {
                  op.entityId = realId;
                  if (op.data) this._updateAllEntityIds(op.data, currentId, realId);
                }
              }
              const localData = this.state[firstOp.collection] || [];
              const item = localData.find(item => item.id === currentId);
              if (item) {
                item.id = realId;
                for (const [coll, items] of Object.entries(this.state)) {
                  if (Array.isArray(items)) {
                    for (const ref of items) {
                      if (ref.patientId === currentId) ref.patientId = realId;
                      if (ref.patientId === currentId) ref.patientId = realId;
                    }
                  }
                }
                this.save();
              }
              currentId = realId;
            }
          } catch (e) {
            console.error('Sync POST failed:', e);
            continue;
          }
        }

        for (const op of operations) {
          if (op.method === 'POST') continue;
          try {
            const url = `/api/${op.collection}/${op.entityId}`;
            const options = {
              method: op.method,
              headers: this.getHeaders()
            };
            if (op.data && (op.method === 'PATCH' || op.method === 'PUT' || op.method === 'POST')) {
              options.body = JSON.stringify(op.data);
            }
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`${op.method} failed: ${response.status}`);
          } catch (e) {
            console.error(`Sync ${op.method} failed:`, e);
            continue;
          }
        }

        this.state.syncQueue = this.state.syncQueue.filter(op => {
          const k = `${op.collection}:${op.entityId}`;
          return k !== key;
        });
      }

      await this.save();
      bus.emit('syncCompleted', this.state.syncQueue);
    } catch (e) {
      console.error('❌ فشل معالجة طابور المزامنة:', e);
    } finally {
      this.syncInProgress = false;
      bus.emit('syncFinished');
    }
  }

  // ─── نظام التنبيهات الذكية ───
  _checkForAlerts() {
    const state = this.state;
    const now = new Date();
    const alerts = [];

    // 1. المهام المتأخرة
    state.tasks.filter(t => !t.done).forEach(t => {
      if (t.dueDate && t.dueTime) {
        const dueDateTime = new Date(`${t.dueDate}T${t.dueTime}`);
        const diffMin = (dueDateTime - now) / 60000;
        if (diffMin < 0) {
          alerts.push({
            type: 'danger',
            title: '⏰ مهمة متأخرة',
            message: `${t.text} (مستحقة منذ ${Math.abs(Math.round(diffMin))} دقيقة)`,
            taskId: t.id
          });
        } else if (diffMin <= 30) {
          alerts.push({
            type: 'warning',
            title: '🕐 مهمة مستحقة قريباً',
            message: `${t.text} (مستحقة خلال ${Math.round(diffMin)} دقيقة)`,
            taskId: t.id
          });
        }
      }
    });

    // 2. المرضى بحالة حرجة
    state.patients.filter(p => p.patientStatus === 'critical' && p.status !== 'discharged').forEach(p => {
      alerts.push({
        type: 'danger',
        title: '🚨 مريض بحالة حرجة',
        message: `${p.name} (${p.diagnosis}) - سرير ${p.bed}`,
        patientId: p.id
      });
    });

    // 3. تسليمات عاجلة غير مقروءة
    state.handovers.filter(h => h.urgent && !h.acknowledged).forEach(h => {
      alerts.push({
        type: 'warning',
        title: '📝 تسليم عاجل غير مقروء',
        message: `من ${h.author}: ${h.situation}`,
        handoverId: h.id
      });
    });

    // 4. تنبيهات داخلية (من General إلى Intern)
    state.alerts.filter(a => !a.read).forEach(a => {
      // تحقق من الصلاحية: إذا كان المستخدم الحالي Intern، يرى تنبيهات مرضاه فقط
      if (this.state.currentRole === 'intern' && a.targetIntern && a.targetIntern !== this.state.currentUser?.email) {
        return;
      }
      alerts.push({
        type: 'info',
        title: `📌 ${a.title}`,
        message: a.message,
        alertId: a.id
      });
    });

    if (alerts.length > 0) {
      bus.emit('alerts', alerts);
      this.notifications = alerts;
    } else {
      this.notifications = [];
    }
  }

  // ─── إضافة تنبيه داخلي ───
  addAlert(title, message, targetRole = null, targetIntern = null) {
    this.state.alerts.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      title,
      message,
      targetRole,
      targetIntern,
      read: false,
      createdAt: new Date().toISOString()
    });
    this.save();
    bus.emit('alertAdded', { title, message });
    this._checkForAlerts();
  }

  // ─── إدارة المستخدمين ───
  getUsers() {
    try {
      const data = localStorage.getItem('coreward_users');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  saveUsers(users) {
    localStorage.setItem('coreward_users', JSON.stringify(users));
  }

  registerUser(name, email, password, role) {
    const users = this.getUsers();
    if (users.find(u => u.email === email)) {
      throw new Error('البريد الإلكتروني مستخدم بالفعل');
    }
    const newUser = {
      name,
      email,
      password: btoa(password),
      role: role || 'intern',
      active: true
    };
    users.push(newUser);
    this.saveUsers(users);
    return newUser;
  }

  loginUser(email, password) {
    const users = this.getUsers();
    const user = users.find(u => u.email === email && atob(u.password) === password);
    if (!user) throw new Error('البريد أو كلمة المرور غير صحيحة');
    if (!user.active) throw new Error('الحساب غير مفعل');
    this.state.currentUser = { email: user.email, name: user.name, role: user.role };
    this.state.currentRole = user.role;
    this.save();
    return user;
  }

  _handleOnline() {
    this.offlineMode = false;
    bus.emit('networkOnline');
    this.processSyncQueue();
    this._checkForAlerts();
  }

  _handleOffline() {
    this.offlineMode = true;
    bus.emit('networkOffline');
  }
}

const stateManager = new StateManager();
window.stateManager = stateManager;