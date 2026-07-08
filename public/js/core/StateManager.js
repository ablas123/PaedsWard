// ================================================================
//  مدير الحالة (State Manager) – مع طابور مزامنة ذكي
// ================================================================
class StateManager {
  constructor() {
    this.store = localforage.createInstance({ name: 'PaedsWard', storeName: 'state' });
    this.state = {
      patients: [],
      tasks: [],
      handovers: [],
      clinicSlots: [],
      teamMembers: [],
      teamMessages: [],
      auditLog: [],
      currentRole: 'junior',
      currentUser: null,
      searchQuery: '',
      syncQueue: [],
      _version: '7.0.0'
    };
    this.syncInProgress = false;
    this.offlineMode = !navigator.onLine;
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
      this.state._version = '7.0.0';
      await this.store.setItem('state', this.state);
      bus.emit('stateSaved', this.state);
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
    this.state = merged;
    this.save();
  }

  get() { return this.state; }
  set(newState) { this.state = { ...this.state, ...newState }; this.save(); }
  update(key, value) { this.state[key] = value; this.save(); }

  // ─── الحصول على الـ Headers مع الصلاحيات ───
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-User-Role': this.state.currentRole || 'junior',
      'X-User-Name': this.state.currentUser?.name || 'جهاز محلي'
    };
  }

  // ─── إضافة عملية إلى طابور المزامنة ───
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

  // ─── تحديث المعرفات في جميع الحقول (للمزامنة) ───
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

  // ─── معالجة طابور المزامنة ───
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
            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`POST failed: ${response.status} ${errText}`);
            }
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
              // تحديث البيانات المحلية
              const localData = this.state[firstOp.collection] || [];
              const item = localData.find(item => item.id === currentId);
              if (item) {
                item.id = realId;
                // تحديث المراجع الأخرى
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
            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`${op.method} failed: ${response.status} ${errText}`);
            }
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

  _handleOnline() {
    this.offlineMode = false;
    bus.emit('networkOnline');
    this.processSyncQueue();
  }

  _handleOffline() {
    this.offlineMode = true;
    bus.emit('networkOffline');
  }
}

const stateManager = new StateManager();
window.stateManager = stateManager;