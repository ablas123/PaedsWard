// ================================================================
//  app.js – نقطة الانطلاق الرئيسية (Entry Point)
// ================================================================

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toISOString().split('T')[0]; }
function timeNow() { return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }); }

function getHeaders() {
  const state = stateManager.get();
  return {
    'Content-Type': 'application/json',
    'X-User-Role': state.currentRole || 'intern',
    'X-User-Name': state.currentUser?.name || 'جهاز محلي'
  };
}
window.getHeaders = getHeaders;

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) { console.warn('⚠️ Toast container غير موجود'); return; }
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
window.showToast = showToast;

function openModal(html) {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;
  content.innerHTML = html;
  modal.classList.remove('hidden');
}
window.openModal = openModal;

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('hidden');
}
window.closeModal = closeModal;

function closeModalOverlay(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}
window.closeModalOverlay = closeModalOverlay;

function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  try {
    const user = stateManager.loginUser(email, password);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('roleSelect').value = user.role;
    bus.emit('render');
    showToast(`👋 مرحباً ${user.name}`, 'success');
  } catch (e) {
    showToast(`⚠️ ${e.message}`, 'error');
  }
}
window.handleLogin = handleLogin;

function showRegisterForm() {
  openModal(`
    <h2>📝 إنشاء حساب جديد</h2>
    <label>الاسم الكامل *</label>
    <input id="regName" placeholder="مثال: د. أحمد">
    <label>البريد الإلكتروني *</label>
    <input id="regEmail" type="email" placeholder="example@ward.com">
    <label>كلمة المرور *</label>
    <input id="regPassword" type="password" placeholder="••••••••">
    <label>الدور</label>
    <select id="regRole" class="form-input">
      <option value="director">مدير</option>
      <option value="specialist">اختصاصي</option>
      <option value="deputy">نائب</option>
      <option value="general">عمومي</option>
      <option value="intern" selected>طبيب امتياز</option>
    </select>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button onclick="handleRegister()" class="success" style="flex:1;">✅ تسجيل</button>
      <button onclick="closeModal()" class="secondary">إلغاء</button>
    </div>
  `);
}
window.showRegisterForm = showRegisterForm;

function handleRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const role = document.getElementById('regRole').value;
  if (!name || !email || !password || password.length < 4) {
    showToast('⚠️ جميع الحقول مطلوبة وكلمة المرور 4 أحرف على الأقل', 'error');
    return;
  }
  try {
    const newUser = stateManager.registerUser(name, email, password, role);
    closeModal();
    showToast(`✅ تم إنشاء حساب ${newUser.name} بنجاح!`, 'success');
  } catch (e) {
    showToast(`⚠️ ${e.message}`, 'error');
  }
}
window.handleRegister = handleRegister;

function switchRole(role) {
  const state = stateManager.get();
  state.currentRole = role;
  if (state.currentUser) state.currentUser.role = role;
  stateManager.save();
  document.getElementById('roleSelect').value = role;
  bus.emit('roleChanged', role);
  bus.emit('render');
}
window.switchRole = switchRole;

function searchGlobal(query) {
  const state = stateManager.get();
  state.searchQuery = query.toLowerCase();
  stateManager.save();
  bus.emit('search', state.searchQuery);
}
window.searchGlobal = searchGlobal;

function exportData() {
  const state = stateManager.get();
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CoreWard_Backup_${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 تم تصدير البيانات بنجاح', 'success');
}
window.exportData = exportData;

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const state = stateManager.get();
      if (data.patients) state.patients = data.patients;
      if (data.tasks) state.tasks = data.tasks;
      if (data.handovers) state.handovers = data.handovers;
      if (data.clinicSlots) state.clinicSlots = data.clinicSlots;
      if (data.teamMessages) state.teamMessages = data.teamMessages;
      if (data.teamMembers) state.teamMembers = data.teamMembers;
      if (data.auditLog) state.auditLog = data.auditLog;
      if (data.alerts) state.alerts = data.alerts;
      if (data.syncQueue) state.syncQueue = data.syncQueue;
      state._version = '1.0.0';
      await stateManager.save();
      bus.emit('render');
      showToast('✅ تم استيراد البيانات بنجاح', 'success');
    } catch (err) {
      showToast('⚠️ ملف غير صالح', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
window.importData = importData;

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await stateManager.load();
  const state = stateManager.get();

  const header = document.getElementById('appHeader');
  if (header) {
    header.innerHTML = `
      <div class="brand" onclick="bus.emit('switchTab', 'dashboard')">🏥 CoreWard <small>· ذكي</small></div>
      <div class="header-actions">
        <select id="roleSelect" onchange="switchRole(this.value)">
          <option value="director">👨‍⚕️ مدير</option>
          <option value="specialist">🩺 اختصاصي</option>
          <option value="deputy">👨‍⚕️ نائب</option>
          <option value="general">🧑‍⚕️ عمومي</option>
          <option value="intern">👨‍🎓 طبيب امتياز</option>
        </select>
        <button id="adminBtn" onclick="bus.emit('openAdmin')">🔑</button>
        <button onclick="exportData()" title="تصدير">📤</button>
        <button onclick="document.getElementById('importFile').click()" title="استيراد">📥</button>
        <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">
        <span class="sync-status">
          <span class="dot ${navigator.onLine ? 'online' : 'offline'}" id="syncDot"></span>
          <span id="syncLabel">${navigator.onLine ? 'متصل' : 'محلي'}</span>
        </span>
      </div>
    `;
    document.getElementById('roleSelect').value = state.currentRole;
  }

  const nav = document.getElementById('appNav');
  if (nav) {
    nav.innerHTML = `
      <div class="tab-bar">
        ${TABS.map(tab => `
          <div class="tab" data-tab="${tab.id}" onclick="bus.emit('switchTab', '${tab.id}')">
            <span class="tab-icon">${tab.icon}</span>
            <span>${tab.label}</span>
            <span class="badge" id="badge_${tab.id}">0</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  bus.on('render', () => {});
  bus.on('stateSaved', () => {
    const dot = document.getElementById('syncDot');
    const label = document.getElementById('syncLabel');
    if (dot && label) {
      if (navigator.onLine) {
        dot.className = 'dot online';
        label.textContent = 'متصل';
      } else {
        dot.className = 'dot offline';
        label.textContent = 'محلي';
      }
    }
    updateBadges();
  });

  bus.on('networkOnline', () => {
    showToast('🔄 عاد الاتصال بالإنترنت، جاري المزامنة...', 'success');
    stateManager.processSyncQueue();
  });

  bus.on('networkOffline', () => {
    showToast('⚠️ انقطع الاتصال بالإنترنت، سيتم حفظ البيانات محلياً', 'warning');
  });

  bus.on('alerts', (alerts) => {
    alerts.forEach(alert => {
      const type = alert.type === 'danger' ? 'error' : 'warning';
      showToast(`🚨 ${alert.title}: ${alert.message}`, type, 5000);
    });
  });

  function updateBadges() {
    const state = stateManager.get();
    const pending = state.tasks.filter(t => !t.done && (t.assignee === state.currentRole || state.currentRole === 'director')).length;
    const urgent = state.handovers.filter(h => h.urgent && !h.acknowledged).length;
    const unreadAlerts = state.alerts.filter(a => !a.read).length;
    const badgeMap = { tasks: pending, handover: urgent, team: unreadAlerts };
    Object.entries(badgeMap).forEach(([id, count]) => {
      const el = document.getElementById(`badge_${id}`);
      if (el) {
        el.style.display = count ? 'block' : 'none';
        el.textContent = count;
      }
    });
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
      adminBtn.classList.toggle('visible', state.currentRole === 'director');
    }
  }

  let currentTab = 'dashboard';
  bus.on('switchTab', (tab) => {
    if (currentTab === tab) return;
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    updateBadges();
    bus.emit('render');
  });

  setTimeout(() => {
    const firstTab = document.querySelector('.tab[data-tab="dashboard"]');
    if (firstTab) firstTab.classList.add('active');
    bus.emit('switchTab', 'dashboard');
  }, 100);

  setInterval(() => {
    if (navigator.onLine) stateManager.processSyncQueue();
  }, 30000);

  window.addEventListener('online', () => bus.emit('networkOnline'));
  window.addEventListener('offline', () => bus.emit('networkOffline'));

  requestNotificationPermission();

  setInterval(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const state = stateManager.get();
    const now = new Date();
    state.tasks.filter(t => !t.done && !t.reminded).forEach(t => {
      if (t.dueDate && t.dueTime) {
        const dueDateTime = new Date(`${t.dueDate}T${t.dueTime}`);
        const diffMin = (dueDateTime - now) / 60000;
        if (diffMin > 0 && diffMin <= 30) {
          new Notification('⏰ تذكير بمهمة', {
            body: `${t.text} (مستحقة خلال ${Math.round(diffMin)} دقيقة)`,
            icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%231a73e8"/%3E%3Ctext x="50" y="65" font-size="40" text-anchor="middle" fill="white"%3E%2B%3C/text%3E%3C/svg%3E'
          });
          t.reminded = true;
          stateManager.save();
        }
      }
    });
  }, 60000);

  console.log('🚀 CoreWard جاهز!');
  console.log('👤 الدور:', state.currentRole);
  console.log('📦 الإصدار:', state._version);
  console.log('👥 المرضى:', state.patients.length);
  console.log('📋 المهام:', state.tasks.length);

  if (state.syncQueue && state.syncQueue.length > 0) {
    showToast(`🔄 يوجد ${state.syncQueue.length} عملية في طابور المزامنة`, 'warning', 5000);
    if (navigator.onLine) {
      setTimeout(() => stateManager.processSyncQueue(), 2000);
    }
  }

  stateManager._checkForAlerts();
  bus.emit('render');
});