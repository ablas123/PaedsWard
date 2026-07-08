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
      syncQueue: [], // طابور المزامنة الخلفي
      _version: '7.0.0'
    };
    this.syncInProgress = false;
    this.offlineMode = !navigator.onLine;
  }

  // ─── تحميل الحالة من IndexedDB ───
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
      // إعداد مستمع حالة الاتصال
      window.addEventListener('online', () => this._handleOnline());
      window.addEventListener('offline', () => this._handleOffline());
      bus.emit('stateLoaded', this.state);
      return this.state;
    } catch (e) {
      console.warn('⚠️ فشل تحميل الحالة:', e);
      return this.state;
    }
  }

  // ─── حفظ الحالة في IndexedDB ───
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

  // ─── ترقية البيانات (Migration) ───
  _migrate(oldState) {
    const merged = { ...this.state, ...oldState };
    if (!merged.syncQueue) merged.syncQueue = [];
    if (!merged.auditLog) merged.auditLog = [];
    this.state = merged;
    this.save();
  }

  // ─── دوال مساعدة ───
  get() { return this.state; }
  set(newState) { this.state = { ...this.state, ...newState }; this.save(); }
  update(key, value) { this.state[key] = value; this.save(); }

  // ─── إضافة عملية إلى طابور المزامنة ───
  addToQueue(collection, method, data, entityId) {
    const op = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      collection,
      method,
      data,
      entityId: entityId || data.id,
      timestamp: Date.now()
    };
    this.state.syncQueue.push(op);
    this.save();
    bus.emit('syncQueueUpdated', this.state.syncQueue);
    // إذا كان الاتصال متاحًا، حاول المزامنة فورًا
    if (navigator.onLine) this.processSyncQueue();
  }

  // ─── معالجة طابور المزامنة (مع دمج المعرفات المؤقتة) ───
  async processSyncQueue() {
    if (this.syncInProgress || !navigator.onLine) return;
    if (this.state.syncQueue.length === 0) return;

    this.syncInProgress = true;
    bus.emit('syncStarted');

    try {
      // تجميع العمليات حسب الكيان (entityId)
      const grouped = {};
      for (const op of this.state.syncQueue) {
        const key = `${op.collection}:${op.entityId}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(op);
      }

      for (const [key, operations] of Object.entries(grouped)) {
        // ترتيب العمليات حسب الوقت
        operations.sort((a, b) => a.timestamp - b.timestamp);

        const firstOp = operations[0];
        let currentId = firstOp.entityId;

        // إذا كانت أول عملية POST، نرسلها ونحصل على المعرف الحقيقي
        if (firstOp.method === 'POST') {
          try {
            const response = await fetch(`/api/${firstOp.collection}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-User-Role': this.state.currentRole,
                'X-User-Name': 'جهاز محلي'
              },
              body: JSON.stringify(firstOp.data)
            });
            if (!response.ok) throw new Error('POST failed');
            const result = await response.json();
            const realId = result.item.id || result.item._id;

            // تحديث جميع العمليات اللاحقة لهذا الكيان لاستخدام realId
            for (let i = 1; i < operations.length; i++) {
              const op = operations[i];
              if (op.entityId === currentId) {
                op.entityId = realId;
                op.url = op.url ? op.url.replace(currentId, realId) : undefined;
                if (op.data && op.data.id === currentId) {
                  op.data.id = realId;
                }
              }
            }
            currentId = realId;
          } catch (e) {
            console.error('Sync POST failed:', e);
            continue; // تخطي هذه المجموعة في هذه الدورة
          }
        }

        // الآن نرسل باقي العمليات (PUT, PATCH, DELETE) بالتسلسل مع المعرف الصحيح
        for (const op of operations) {
          if (op.method === 'POST') continue; // تم معالجته أعلاه
          try {
            const url = `/api/${op.collection}/${op.entityId}`;
            const options = {
              method: op.method,
              headers: {
                'Content-Type': 'application/json',
                'X-User-Role': this.state.currentRole,
                'X-User-Name': 'جهاز محلي'
              }
            };
            if (op.data && (op.method === 'PATCH' || op.method === 'PUT' || op.method === 'POST')) {
              options.body = JSON.stringify(op.data);
            }
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`${op.method} failed`);
          } catch (e) {
            console.error(`Sync ${op.method} failed:`, e);
            // نترك العملية في الطابور لإعادة المحاولة لاحقًا
            continue;
          }
        }

        // بعد نجاح كل العمليات، نزيلها من الطابور
        this.state.syncQueue = this.state.syncQueue.filter(op => {
          const k = `${op.collection}:${op.entityId}`;
          return k !== key;
        });
      }

      // حفظ التغييرات بعد المعالجة
      await this.save();
      bus.emit('syncCompleted', this.state.syncQueue);
    } catch (e) {
      console.error('❌ فشل معالجة طابور المزامنة:', e);
    } finally {
      this.syncInProgress = false;
      bus.emit('syncFinished');
    }
  }

  // ─── معالجة العودة للاتصال ───
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

// تصدير نسخة واحدة
const stateManager = new StateManager();
window.stateManager = stateManager;