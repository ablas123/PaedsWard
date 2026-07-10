// CoreWard - StateManager
// Central state management with IndexedDB + Server Sync

class StateManager {
  constructor() {
    this.state = {
      currentUser: null,
      patients: [],
      tasks: [],
      handovers: [],
      clinicSlots: [],
      teamMembers: [],
      teamMessages: [],
      auditLog: [],
      alerts: [],
      users: []
    };
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.dbName = 'CoreWardDB';
    this.dbStoreName = 'appState';
    this.db = null;
    this.syncTimer = null;
    this.syncIntervalMs = 30000; // 30 seconds
  }

  // ============ IndexedDB Setup ============
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.dbStoreName)) {
          db.createObjectStore(this.dbStoreName, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
      };
    });
  }

  async saveToIndexedDB(key, value) {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.dbStoreName, 'readwrite');
      const store = tx.objectStore(this.dbStoreName);
      const request = store.put({ key, value, updatedAt: new Date().toISOString() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadFromIndexedDB(key) {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.dbStoreName, 'readonly');
      const store = tx.objectStore(this.dbStoreName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSyncQueueToIndexedDB() {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      store.clear();
      this.syncQueue.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadSyncQueueFromIndexedDB() {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const request = store.getAll();
      request.onsuccess = () => {
        this.syncQueue = request.result || [];
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============ Load & Save ============
  async load() {
    try {
      await this.initDB();
      const savedState = await this.loadFromIndexedDB('state');
      if (savedState) {
        this.state = { ...this.state, ...savedState };
      }
      await this.loadSyncQueueFromIndexedDB();
      EventBus.emit('stateLoaded', this.state);
      return this.state;
    } catch (err) {
      console.error('[StateManager] Load error:', err);
      return this.state;
    }
  }

  async save() {
    try {
      await this.saveToIndexedDB('state', this.state);
      EventBus.emit('stateSaved', this.state);
      return true;
    } catch (err) {
      console.error('[StateManager] Save error:', err);
      return false;
    }
  }

  // ============ Authentication ============
  async loginUser(email, password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      this.state.currentUser = data.user;
      await this.save();

      // Load full state after login
      await this.syncFullState();
      this.startAutoSync();

      EventBus.emit('userLoggedIn', data.user);
      return data.user;
    } catch (err) {
      console.error('[StateManager] Login error:', err);
      throw err;
    }
  }

  async logoutUser() {
    this.stopAutoSync();
    this.state.currentUser = null;
    await this.save();
    EventBus.emit('userLoggedOut');
  }

  getCurrentUser() {
    return this.state.currentUser;
  }

  // ============ CRUD Operations ============
  async addItem(collection, item) {
    if (!this.state[collection]) {
      throw new Error(`Invalid collection: ${collection}`);
    }

    const now = new Date().toISOString();
    const newItem = {
      ...item,
      id: item.id || generateId(collection.slice(0, 3)),
      createdAt: now,
      updatedAt: now,
      createdBy: this.state.currentUser?.id
    };

    // Add to local state immediately (optimistic)
    this.state[collection].push(newItem);
    await this.save();
    EventBus.emit('stateChanged', { collection, action: 'add', item: newItem });

    // Queue for sync
    if (this.isOnline && this.state.currentUser) {
      this._syncAdd(collection, newItem);
    } else {
      this._queueSync({ collection, action: 'add', item: newItem });
    }

    return newItem;
  }

  async updateItem(collection, id, updates) {
    if (!this.state[collection]) {
      throw new Error(`Invalid collection: ${collection}`);
    }

    const idx = this.state[collection].findIndex(x => x.id === id);
    if (idx === -1) throw new Error(`Item not found: ${id}`);

    const now = new Date().toISOString();
    const updated = {
      ...this.state[collection][idx],
      ...updates,
      id: id, // prevent id override
      updatedAt: now,
      updatedBy: this.state.currentUser?.id
    };

    this.state[collection][idx] = updated;
    await this.save();
    EventBus.emit('stateChanged', { collection, action: 'update', item: updated });

    if (this.isOnline && this.state.currentUser) {
      this._syncUpdate(collection, id, updated);
    } else {
      this._queueSync({ collection, action: 'update', id, updates: updated });
    }

    return updated;
  }

  async deleteItem(collection, id) {
    if (!this.state[collection]) {
      throw new Error(`Invalid collection: ${collection}`);
    }

    const idx = this.state[collection].findIndex(x => x.id === id);
    if (idx === -1) throw new Error(`Item not found: ${id}`);

    const deleted = this.state[collection][idx];
    this.state[collection].splice(idx, 1);
    await this.save();
    EventBus.emit('stateChanged', { collection, action: 'delete', item: deleted });

    if (this.isOnline && this.state.currentUser) {
      this._syncDelete(collection, id);
    } else {
      this._queueSync({ collection, action: 'delete', id });
    }

    return deleted;
  }

  // ============ Server Sync ============
  async _syncAdd(collection, item) {
    try {
      const response = await this._apiCall('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ collection, action: 'add', item })
      });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      if (data.result && data.result.id !== item.id) {
        // Server assigned different ID
        const idx = this.state[collection].findIndex(x => x.id === item.id);
        if (idx !== -1) {
          this.state[collection][idx].id = data.result.id;
          await this.save();
        }
      }
    } catch (err) {
      console.error('[StateManager] Sync add error:', err);
      this._queueSync({ collection, action: 'add', item });
    }
  }

  async _syncUpdate(collection, id, updates) {
    try {
      const response = await this._apiCall('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ collection, action: 'update', id, updates })
      });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      // Server wins if newer
      if (data.result && data.result.updatedAt !== updates.updatedAt) {
        const idx = this.state[collection].findIndex(x => x.id === id);
        if (idx !== -1) {
          this.state[collection][idx] = data.result;
          await this.save();
          EventBus.emit('stateChanged', { collection, action: 'update', item: data.result });
        }
      }
    } catch (err) {
      console.error('[StateManager] Sync update error:', err);
      this._queueSync({ collection, action: 'update', id, updates });
    }
  }

  async _syncDelete(collection, id) {
    try {
      const response = await this._apiCall('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ collection, action: 'delete', id })
      });
      if (!response.ok) throw new Error('Sync failed');
    } catch (err) {
      console.error('[StateManager] Sync delete error:', err);
      this._queueSync({ collection, action: 'delete', id });
    }
  }

  async _apiCall(url, options = {}) {
    const user = this.state.currentUser;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (user) {
      headers['x-user-id'] = user.id;
      headers['x-user-role'] = user.role;
    }
    return fetch(url, { ...options, headers });
  }

  // ============ Sync Queue ============
  _queueSync(operation) {
    const entry = {
      id: generateId('sq'),
      timestamp: new Date().toISOString(),
      ...operation
    };
    this.syncQueue.push(entry);
    this.saveSyncQueueToIndexedDB();
  }

  async processSyncQueue() {
    if (this.syncQueue.length === 0) return;
    if (!this.isOnline || !this.state.currentUser) return;

    console.log(`[StateManager] Processing ${this.syncQueue.length} queued sync operations`);
    const queue = [...this.syncQueue];
    this.syncQueue = [];

    for (const op of queue) {
      try {
        if (op.action === 'add') await this._syncAdd(op.collection, op.item);
        else if (op.action === 'update') await this._syncUpdate(op.collection, op.id, op.updates);
        else if (op.action === 'delete') await this._syncDelete(op.collection, op.id);
      } catch (err) {
        console.error('[StateManager] Queue processing error:', err);
        this._queueSync(op); // Re-queue on failure
      }
    }
  }

  async syncFullState() {
    if (!this.isOnline || !this.state.currentUser) return;

    try {
      const response = await this._apiCall('/api/state');
      if (!response.ok) throw new Error('Failed to fetch state');
      const serverState = await response.json();

      // Merge: server wins if newer
      ['patients', 'tasks', 'handovers', 'clinicSlots', 'teamMembers', 'teamMessages', 'auditLog', 'alerts', 'users'].forEach(collection => {
        const serverItems = serverState[collection] || [];
        const localItems = this.state[collection] || [];

        const merged = new Map();
        localItems.forEach(item => merged.set(item.id, item));
        serverItems.forEach(serverItem => {
          const localItem = merged.get(serverItem.id);
          if (!localItem) {
            merged.set(serverItem.id, serverItem);
          } else {
            const serverTime = new Date(serverItem.updatedAt || 0).getTime();
            const localTime = new Date(localItem.updatedAt || 0).getTime();
            if (serverTime >= localTime) {
              merged.set(serverItem.id, serverItem);
            }
          }
        });
        this.state[collection] = Array.from(merged.values());
      });

      await this.save();
      EventBus.emit('stateChanged', { collection: 'all', action: 'sync' });
      console.log('[StateManager] Full state synced');
    } catch (err) {
      console.error('[StateManager] Full sync error:', err);
    }
  }

  // ============ Auto Sync ============
  startAutoSync() {
    this.stopAutoSync();
    this.syncTimer = setInterval(() => {
      this.processSyncQueue();
    }, this.syncIntervalMs);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // ============ Network Status ============
  setOnline(online) {
    const wasOffline = !this.isOnline;
    this.isOnline = online;
    EventBus.emit(online ? 'networkOnline' : 'networkOffline');
    if (wasOffline && online) {
      // Came back online - sync
      setTimeout(() => {
        this.processSyncQueue();
        this.syncFullState();
      }, 1000);
    }
  }

  // ============ Alerts ============
  async addAlert(title, message, targetRole, targetIntern) {
    return this.addItem('alerts', {
      title,
      message,
      targetRole: targetRole || null,
      targetIntern: targetIntern || null,
      read: false,
      createdAt: new Date().toISOString()
    });
  }

  // ============ Helpers ============
  getPatients() { return this.state.patients || []; }
  getTasks() { return this.state.tasks || []; }
  getHandovers() { return this.state.handovers || []; }
  getClinicSlots() { return this.state.clinicSlots || []; }
  getTeamMessages() { return this.state.teamMessages || []; }
  getAuditLog() { return this.state.auditLog || []; }
  getAlerts() { return this.state.alerts || []; }
  getUsers() { return this.state.users || []; }

  getPatientById(id) {
    return this.state.patients.find(p => p.id === id);
  }

  getUserById(id) {
    return this.state.users.find(u => u.id === id);
  }

  // ============ Export/Import ============
  exportData() {
    const data = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      state: this.state
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coreward-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.state) throw new Error('Invalid backup file');
          this.state = { ...this.state, ...data.state };
          await this.save();
          EventBus.emit('stateChanged', { collection: 'all', action: 'import' });
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}

// Global singleton
window.stateManager = new StateManager();