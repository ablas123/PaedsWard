// ================================================================
//  مدير الحالة (State Manager) – مع مزامنة فعالة ومصادقة
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
      _version: '2.0.0'
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
      this.state._version = '2.0.0';
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

  // ─── المصادقة ───
  async loginUser(email, password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'فشل تسجيل الدخول');
      }
      const data = await response.json();
      const user = data.user;
      this.state.currentUser = user;
      this.state.currentRole = user.role;
      // تحميل بيانات الحالة من الخادم
      await this.syncFullState();
      await this.save();
      return user;
    } catch (e) {
      throw new Error(e.message);
    }
  }

  async syncFullState() {
    try {
      const response = await fetch('/api/state', { headers: this.getHeaders() });
      if (!response.ok) throw new Error('فشل تحميل البيانات');
      const data = await response.json();
      // دمج البيانات من الخادم مع الحالة المحلية
      for (const key of ['patients', 'tasks', 'handovers', 'clinicSlots', 'teamMembers', 'teamMessages', 'auditLog', 'alerts']) {
        if (data[key]) {
          this.state[key] = data[key];
        }
      }
      await this.save();
      bus.emit('render');
    } catch (e) {
      console.warn('⚠️ فشل مزامنة البيانات:', e);
    }
  }

  // ─── مزامنة الذكية مع الخادم ───
  async syncToServer() {
    if (!this.state.currentUser) return;
    try {
      // جلب البيانات الكاملة من الخادم
      const response = await fetch('/api/state', { headers: this.getHeaders() });
      if (!response.ok) throw new Error('فشل تحميل البيانات');
      const data = await response.json();
      // دمج البيانات
      for (const key of ['patients', 'tasks', 'handovers', 'clinicSlots', 'teamMembers', 'teamMessages', 'auditLog', 'alerts']) {
        if (data[key]) {
          this.state[key] = data[key];
        }
      }
      await this.save();
      bus.emit('render');
      updateSyncStatus(true);
      showToast('🔄 تمت المزامنة مع الخادم', 'success');
    } catch (e) {
      console.warn('⚠️ فشل المزامنة:', e);
      updateSyncStatus(false);
    }
  }

  // ─── إضافة عنصر (مع مزامنة فورية) ───
  async addItem(collection, item) {
    try {
      const response = await fetch(`/api/${collection}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(item)
      });
      if (!response.ok) throw new Error('فشل الإضافة');
      const result = await response.json();
      const newItem = result.item;
      // تحديث الحالة المحلية
      if (!this.state[collection]) this.state[collection] = [];
      this.state[collection].push(newItem);
      await this.save();
      bus.emit('render');
      return newItem;
    } catch (e) {
      console.warn('⚠️ فشل الإضافة، سيتم إضافتها إلى الطابور:', e);
      // إضافة إلى طابور المزامنة
      this.addToQueue(collection, 'POST', item, item.id);
      return item;
    }
  }

  // ─── تحديث عنصر ───
  async updateItem(collection, id, updates) {
    try {
      const response = await fetch(`/api/${collection}/${id}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('فشل التحديث');
      const result = await response.json();
      const updatedItem = result.item;
      // تحديث الحالة المحلية
      const index = this.state[collection].findIndex(item => item.id === id);
      if (index !== -1) {
        this.state[collection][index] = updatedItem;
        await this.save();
        bus.emit('render');
      }
      return updatedItem;
    } catch (e) {
      console.warn('⚠️ فشل التحديث، سيتم إضافته إلى الطابور:', e);
      this.addToQueue(collection, 'PATCH', updates, id);
      return null;
    }
  }

  // ─── حذف عنصر ───
  async deleteItem(collection, id) {
    try {
      const response = await fetch(`/api/${collection}/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('فشل الحذف');
      // تحديث الحالة المحلية
      this.state[collection] = this.state[collection].filter(item => item.id !== id);
      await this.save();
      bus.emit('render');
      return true;
    } catch (e) {
      console.warn('⚠️ فشل الحذف، سيتم إضافته إلى الطابور:', e);
      this.addToQueue(collection, 'DELETE', null, id);
      return false;
    }
  }

  // ─── طابور المزامنة (للعمليات غير المتصلة) ───
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

  async processSyncQueue() {
    if (this.syncInProgress || !navigator.onLine) return;
    if (this.state.syncQueue.length === 0) return;

    this.syncInProgress = true;
    bus.emit('syncStarted');

    try {
      // نسخة من الطابور للمعالجة
      const queueCopy = [...this.state.syncQueue];
      this.state.syncQueue = [];

      for (const op of queueCopy) {
        try {
          let url = `/api/${op.collection}`;
          let options = {
            method: op.method,
            headers: this.getHeaders()
          };
          if (op.method === 'POST' || op.method === 'PATCH' || op.method === 'PUT') {
            options.body = JSON.stringify(op.data);
          }
          if (op.method === 'PATCH' || op.method === 'DELETE' || op.method === 'PUT') {
            url += `/${op.entityId}`;
          }
          const response = await fetch(url, options);
          if (!response.ok) throw new Error(`فشل ${op.method}`);
          // تحديث الحالة المحلية بعد النجاح
          if (op.method === 'POST' || op.method === 'PATCH') {
            const result = await response.json();
            const newItem = result.item || op.data;
            // تحديث في الحالة المحلية
            const collection = this.state[op.collection] || [];
            const index = collection.findIndex(item => item.id === op.entityId);
            if (index !== -1 && op.method === 'PATCH') {
              collection[index] = { ...collection[index], ...newItem };
            } else if (index === -1 && op.method === 'POST') {
              collection.push(newItem);
            }
            this.state[op.collection] = collection;
          } else if (op.method === 'DELETE') {
            this.state[op.collection] = this.state[op.collection].filter(item => item.id !== op.entityId);
          }
        } catch (e) {
          console.warn(`⚠️ فشل تنفيذ ${op.method} للعنصر ${op.entityId}:`, e);
          // إعادة العملية إلى الطابور
          this.state.syncQueue.push(op);
        }
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

  // ─── نظام التنبيهات ───
  _checkForAlerts() {
    // التنبيهات تُدار من الخادم، لكن نفحص محلياً أيضاً
    // سنقوم بجلب التنبيهات من الخادم عند المزامنة
  }

  addAlert(title, message, targetRole = null, targetIntern = null) {
    // إضافة تنبيه محلياً، سيتم مزامنته مع الخادم
    const alert = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      title,
      message,
      targetRole,
      targetIntern,
      read: false,
      createdAt: new Date().toISOString()
    };
    this.state.alerts.push(alert);
    this.save();
    bus.emit('alertAdded', { title, message });
    // إرسال إلى الخادم
    this.addItem('alerts', alert);
  }

  // ─── إدارة المستخدمين (للمدير) ───
  async createUser(name, email, password, role) {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, email, password, role })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'فشل إنشاء المستخدم');
      }
      const data = await response.json();
      // تحديث قائمة الفريق
      this.state.teamMembers.push(data.user);
      await this.save();
      bus.emit('render');
      return data.user;
    } catch (e) {
      throw new Error(e.message);
    }
  }

  _handleOnline() {
    this.offlineMode = false;
    bus.emit('networkOnline');
    this.processSyncQueue();
    this.syncToServer();
  }

  _handleOffline() {
    this.offlineMode = true;
    bus.emit('networkOffline');
  }
}

const stateManager = new StateManager();
window.stateManager = stateManager;