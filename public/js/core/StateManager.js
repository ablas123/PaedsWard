import EventBus from './EventBus.js';

/**
 * ==========================================================================
 * 🗄️ مدير الحالة المركزي والمزامنة (Application State Manager)
 * الاستراتيجية: Offline-First مع طابور مزامنة خلفي ذكي وحل التعارضات
 * ==========================================================================
 */
export class StateManager {
    constructor() {
        this.state = {
            patients: [],
            tasks: [],
            clinic: [],
            messages: [],
            auditLog: []
        };
        this.currentUserRole = 'senior'; // القيمة الافتراضية
        this.currentUserName = 'Dr. Mohammed'; 
        this.syncQueue = [];
        this.isOnline = navigator.onLine;

        this.init();
    }

    /**
     * التهيئة الأولية وإعداد مستمعي الشبكة وقاعدة البيانات المحلية
     */
    async init() {
        this.setupNetworkListeners();
        await this.loadLocalState();
        await this.fetchServerState();
    }

    /**
     * مراقبة حالة اتصال المتصفح بالإنترنت فواً
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            EventBus.emit('networkStatusChanged', true);
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            EventBus.emit('networkStatusChanged', false);
        });
    }

    /**
     * تحميل البيانات المحفوظة محلياً من IndexedDB لتسريع إقلاع التطبيق
     */
    async loadLocalState() {
        try {
            // كود محاكاة خفيف لـ IndexedDB للعمل بشكل مستقل وسريع
            const localData = localStorage.getItem('paedsward_local_db');
            if (localData) {
                this.state = JSON.parse(localData);
                EventBus.emit('stateRefreshed', this.state);
            }
        } catch (e) {
            console.error("🔴 خطأ أثناء تحميل مخزن البيانات المحلي:", e);
        }
    }

    /**
     * حفظ الحالة الحالية محلياً بشكل فوري
     */
    async saveLocalState() {
        localStorage.setItem('paedsward_local_db', JSON.stringify(this.state));
    }

    /**
     * جلب البيانات الأحدث من السيرفر وعمل دمج ذكي (Deep Merge) بناءً على التوقيت
     */
    async fetchServerState() {
        if (!this.isOnline) return;

        try {
            const res = await fetch('/api/data', {
                headers: this.getAuthHeaders()
            });
            if (!res.ok) throw new Error("صلاحيات غير كافية أو خطأ خادم");
            
            const serverData = await res.json();
            
            // دمج ذكي للبيانات الحالية والمستلمة مع احترام الأحدث زمنياً (updatedAt)
            this.mergeServerData(serverData);
            await this.saveLocalState();
            
            EventBus.emit('stateRefreshed', this.state);
        } catch (error) {
            console.warn("⚠️ لم نتمكن من تحديث الحالة من السيرفر، تم الاعتماد على النسخة المحلية مؤقتاً:", error.message);
        }
    }

    /**
     * دمج مصفوفات البيانات بالتأكد من الطوابع الزمنية للتحديثات
     */
    mergeServerData(serverData) {
        // تحديث مصفوفة المرضى بناءً على التوقيت الأحدث للأمان الطبي
        const patientMap = new Map(this.state.patients.map(p => [p.id, p]));
        
        serverData.patients.forEach(serverPatient => {
            const localPatient = patientMap.get(serverPatient.id);
            if (!localPatient || new Date(serverPatient.updatedAt) > new Date(localPatient.updatedAt)) {
                patientMap.set(serverPatient.id, serverPatient);
            }
        });

        this.state.patients = Array.from(patientMap.values());
        this.state.tasks = serverData.tasks || [];
        this.state.clinic = serverData.clinic || [];
        this.state.messages = serverData.messages || [];
        this.state.auditLog = serverData.auditLog || [];
    }

    /**
     * إنشاء الـ Headers الموحدة المطلوبة لحماية وتحقق العمليات في السيرفر
     */
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'x-user-role': this.currentUserRole,
            'x-user-name': this.currentUserName
        };
    }

    /**
     * تغيير دور المستخدم الحالي ديناميكياً وإعادة فلترة الصلاحيات
     */
    setRole(role) {
        this.currentUserRole = role;
        EventBus.emit('roleChanged', role);
        this.fetchServerState(); // إعادة التحديث للتحقق من الصلاحيات والبيانات المقيدة
    }

    // ================================================================
    // ⚙️ عمليات تعديل الحالة ومزامنتها الجزئية (CRUD Methods)
    // ================================================================

    /**
     * إضافة مريض جديد عبر نموذج القبول (Admission Wizard)
     */
    async addPatient(patientData) {
        const tempId = 'pat_temp_' + Date.now();
        const newPatient = {
            ...patientData,
            id: tempId,
            stage: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // التحديث المحلي الفوري (Optimistic UI)
        this.state.patients.push(newPatient);
        await this.saveLocalState();
        EventBus.emit('patientAdded', newPatient);

        // المزامنة مع الخادم الخلفي
        if (this.isOnline) {
            try {
                const res = await fetch('/api/patients', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(patientData)
                });
                const savedPatient = await res.json();
                
                // استبدال المعرف المؤقت بالمعرف الحقيقي القادم من السيرفر
                this.state.patients = this.state.patients.filter(p => p.id !== tempId);
                this.state.patients.push(savedPatient);
                await this.saveLocalState();
                EventBus.emit('stateRefreshed', this.state);
            } catch (err) {
                this.pushToSyncQueue('POST', '/api/patients', patientData, tempId);
            }
        } else {
            this.pushToSyncQueue('POST', '/api/patients', patientData, tempId);
        }
    }

    /**
     * تحديث جزئي حذر ومؤمن لبيانات مريض (تعديل خطة، علامات حيوية، أو تغيير مرحلة)
     */
    async patchPatient(patientId, updatedFields) {
        const index = this.state.patients.findIndex(p => p.id === patientId);
        if (index === -1) return;

        // تحديث محلي فوري مع وسم زمن التعديل
        this.state.patients[index] = {
            ...this.state.patients[index],
            ...updatedFields,
            updatedAt: new Date().toISOString()
        };
        await this.saveLocalState();
        EventBus.emit('patientUpdated', this.state.patients[index]);

        // المزامنة الخارجية الجزئية بطلب PATCH لتقليل حجم حزم البيانات
        const endpoint = `/api/patients/${patientId}`;
        if (this.isOnline) {
            try {
                const res = await fetch(endpoint, {
                    method: 'PATCH',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(updatedFields)
                });
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || "خطأ أمني بالسيرفر");
                }
                const currentData = await res.json();
                this.state.patients[index] = currentData;
                await this.saveLocalState();
            } catch (err) {
                EventBus.emit('operationFailed', err.message);
                // إذا كان الخطأ انقطاع شبكة نحفظ في الطابور، أما لو كان خطأ صلاحية نلغي التحديث
                if (err.message.includes("network") || !this.isOnline) {
                    this.pushToSyncQueue('PATCH', endpoint, updatedFields);
                } else {
                    await this.fetchServerState(); // تراجع وإعادة مزامنة لمنع تلوث البيانات
                }
            }
        } else {
            this.pushToSyncQueue('PATCH', endpoint, updatedFields);
        }
    }

    /**
     * إضافة عامة للمجموعات الأخرى (مهام، رسائل، مواعيد)
     */
    async addGenericItem(collection, itemData) {
        if (!this.state[collection]) this.state[collection] = [];
        
        const tempId = 'temp_' + Date.now();
        const newItem = { ...itemData, id: tempId, createdAt: new Date().toISOString() };
        
        this.state[collection].unshift(newItem);
        await this.saveLocalState();
        EventBus.emit('collectionUpdated', { collection, data: this.state[collection] });

        if (this.isOnline) {
            try {
                const res = await fetch(`/api/${collection}`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(itemData)
                });
                const saved = await res.json();
                this.state[collection] = this.state[collection].filter(i => i.id !== tempId);
                this.state[collection].unshift(saved);
                await this.saveLocalState();
                EventBus.emit('collectionUpdated', { collection, data: this.state[collection] });
            } catch (e) {
                this.pushToSyncQueue('POST', `/api/${collection}`, itemData, tempId, collection);
            }
        } else {
            this.pushToSyncQueue('POST', `/api/${collection}`, itemData, tempId, collection);
        }
    }

    // ================================================================
    // 🔄 معالجة طابور وضع عدم الاتصال بالإنترنت (Offline Queue Sync)
    // ================================================================

    pushToSyncQueue(method, url, body, tempId = null, collection = null) {
        this.syncQueue.push({ method, url, body, tempId, collection });
        localStorage.setItem('paedsward_sync_queue', JSON.stringify(this.syncQueue));
    }

    async processSyncQueue() {
        const storedQueue = localStorage.getItem('paedsward_sync_queue');
        if (storedQueue) this.syncQueue = JSON.parse(storedQueue);

        if (this.syncQueue.length === 0 || !this.isOnline) return;

        console.log(`🔄 جاري معالجة ورفع عدد (${this.syncQueue.length}) من العمليات المخزنة أوفلاين...`);

        while (this.syncQueue.length > 0) {
            const item = this.syncQueue[0];
            try {
                const res = await fetch(item.url, {
                    method: item.method,
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(item.body)
                });
                
                if (res.ok) {
                    this.syncQueue.shift(); // إزالتها من الطابور فور النجاح
                    localStorage.setItem('paedsward_sync_queue', JSON.stringify(this.syncQueue));
                } else {
                    break; // التوقف مؤقتاً في حال وجود مشكلة سيرفر تمنع استمرار التدفق
                }
            } catch (e) {
                break; // انقطاع الشبكة مجدداً
            }
        }

        await this.fetchServerState(); // تحديث شامل ونهائي بعد معالجة الطابور كلياً
    }
}

// تصدير نسخة واحدة موحدة من مدير الحالة لتنسيق كامل النظام (Singleton Engine)
const globalStateManager = new StateManager();
export default globalStateManager;