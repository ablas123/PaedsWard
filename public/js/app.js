// ================================================================
//  app.js – نقطة الانطلاق الرئيسية (مع مصادقة حقيقية)
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

// ─── معالج تسجيل الدخول ───
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  try {
    const user = await stateManager.loginUser(email, password);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('roleSelect').value = user.role;
    // تحديث زر الإدارة إذا كان المدير
    const adminBtn = document.getElementById('adminBtn');
    if (user.role === 'director') {
      adminBtn.classList.add('visible');
    } else {
      adminBtn.classList.remove('visible');
    }
    bus.emit('render');
    showToast(`👋 مرحباً ${user.name}`, 'success');
  } catch (e) {
    showToast(`⚠️ ${e.message}`, 'error');
  }
}
window.handleLogin = handleLogin;

// ─── لوحة إدارة المستخدمين (للمدير فقط) ───
function openUserManagement() {
  const state = stateManager.get();
  if (state.currentRole !== 'director') {
    showToast('⚠️ هذه اللوحة للمدير فقط', 'error');
    return;
  }
  openModal(`
    <h2>👑 إدارة المستخدمين</h2>
    <h3>إنشاء حساب جديد</h3>
    <label>الاسم الكامل *</label><input id="newUserName" placeholder="مثال: د. خالد">
    <label>البريد الإلكتروني *</label><input id="newUserEmail" type="email" placeholder="example@ward.com">
    <label>كلمة المرور *</label><input id="newUserPassword" type="password" placeholder="••••••••">
    <label>الدور</label>
    <select id="newUserRole" class="form-input">
      <option value="director">مدير</option>
      <option value="specialist">اختصاصي</option>
      <option value="deputy">نائب</option>
      <option value="general">عمومي</option>
      <option value="intern" selected>طبيب امتياز</option>
    </select>
    <button onclick="createUser()" class="block success" style="margin-top:8px;">✅ إنشاء حساب</button>
    <hr>
    <h3>المستخدمون الحاليون</h3>
    <div id="userList">
      ${state.teamMembers.map(m => `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid #e2e8f0;">${m.name} (${getRoleLabel(m.role)}) - ${m.email}</div>`).join('')}
    </div>
    <button class="secondary block" style="margin-top:12px;" onclick="closeModal()">إغلاق</button>
  `);
}
window.openUserManagement = openUserManagement;

async function createUser() {
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value.trim();
  const role = document.getElementById('newUserRole').value;
  if (!name || !email || !password || password.length < 4) {
    showToast('⚠️ جميع الحقول مطلوبة وكلمة المرور 4 أحرف على الأقل', 'error');
    return;
  }
  try {
    await stateManager.createUser(name, email, password, role);
    closeModal();
    showToast(`✅ تم إنشاء حساب ${name}`, 'success');
    // إعادة فتح اللوحة لتحديث القائمة
    setTimeout(openUserManagement, 500);
  } catch (e) {
    showToast(`⚠️ ${e.message}`, 'error');
  }
}

// ─── باقي الدوال (switchRole, searchGlobal, exportData, importData, إلخ) ───
// ... (كما هي في النسخة السابقة، لكن نضيف استدعاء syncToServer بعد التغييرات)

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
      state._version = '2.0.0';
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

// ─── تحديث حالة الاتصال ───
function updateSyncStatus(online) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (dot && label) {
    if (online) {
      dot.className = 'dot online';
      label.textContent = 'متصل';
    } else {
      dot.className = 'dot offline';
      label.textContent = 'محلي';
    }
  }
}
window.updateSyncStatus = updateSyncStatus;

// ─── تهيئة التطبيق ───
document.addEventListener('DOMContentLoaded', async () => {
  await stateManager.load();
  const state = stateManager.get();

  // بناء الهيكل
  const header = document.getElementById('appHeader');
  if (header) {
    header.innerHTML = `
      <div class="brand" onclick="bus.emit('switchTab', 'dashboard')">🏥 CoreWard <small>· ذكي</small></div>
      <div class="header-actions">
        <select id="roleSelect" onchange="switchRole(this.value)">
          <option value="director">👑 مدير</option>
          <option value="specialist">🩺 اختصاصي</option>
          <option value="deputy">👨‍⚕️ نائب</option>
          <option value="general">🧑‍⚕️ عمومي</option>
          <option value="intern">👨‍🎓 طبيب امتياز</option>
        </select>
        <button id="adminBtn" onclick="openUserManagement()" class="${state.currentRole === 'director' ? 'visible' : ''}">👑</button>
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

  // الأحداث
  bus.on('render', () => {});
  bus.on('stateSaved', () => { updateSyncStatus(navigator.onLine); });

  bus.on('networkOnline', () => {
    showToast('🔄 عاد الاتصال بالإنترنت، جاري المزامنة...', 'success');
    stateManager.processSyncQueue();
    stateManager.syncToServer();
  });

  bus.on('networkOffline', () => {
    showToast('⚠️ انقطع الاتصال بالإنترنت، سيتم حفظ البيانات محلياً', 'warning');
  });

  // تحديث الشارات
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

  // مزامنة دورية
  setInterval(() => {
    if (navigator.onLine) {
      stateManager.processSyncQueue();
      stateManager.syncToServer();
    }
  }, 30000);

  window.addEventListener('online', () => bus.emit('networkOnline'));
  window.addEventListener('offline', () => bus.emit('networkOffline'));

  requestNotificationPermission();

  console.log('🚀 CoreWard PRO جاهز!');
  console.log('👤 الدور:', state.currentRole);
  console.log('📦 الإصدار:', state._version);
  if (state.syncQueue && state.syncQueue.length > 0) {
    showToast(`🔄 يوجد ${state.syncQueue.length} عملية في طابور المزامنة`, 'warning', 5000);
    if (navigator.onLine) {
      setTimeout(() => stateManager.processSyncQueue(), 2000);
    }
  }

  bus.emit('render');
});