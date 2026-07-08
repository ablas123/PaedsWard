// ================================================================
//  نقطة الانطلاق الرئيسية (App Entry)
// ================================================================

// ─── دوال مساعدة ───
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function timeNow() {
  return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function getRoleLabel(role) {
  const map = { senior: 'استشاري', junior: 'طبيب مبتدئ', nurse: 'ممرض', admin: 'إداري' };
  return map[role] || role;
}

// ─── عرض الرسائل التنبيهية (Toast) ───
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.warn('⚠️ Toast container غير موجود');
    return;
  }
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

// ─── فتح وإغلاق النافذة المنبثقة ───
function openModal(html) {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modalContent');
  content.innerHTML = html;
  modal.classList.remove('hidden');
}
window.openModal = openModal;

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}
window.closeModal = closeModal;

function closeModalOverlay(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}
window.closeModalOverlay = closeModalOverlay;

// ─── تبديل الأدوار ───
function switchRole(role) {
  const state = stateManager.get();
  state.currentRole = role;
  stateManager.save();
  document.getElementById('roleSelect').value = role;
  bus.emit('roleChanged', role);
  bus.emit('render');
}
window.switchRole = switchRole;

// ─── البحث العالمي ───
function searchGlobal(query) {
  bus.emit('search', query.toLowerCase());
}
window.searchGlobal = searchGlobal;

// ─── تصدير واستيراد البيانات ───
function exportData() {
  const state = stateManager.get();
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PaedsWard_Backup_${today()}.json`;
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
      if (data.syncQueue) state.syncQueue = data.syncQueue;
      state._version = '7.0.0';
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

// ─── إشعارات المتصفح ───
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ─── تهيئة التطبيق ───
document.addEventListener('DOMContentLoaded', async () => {
  // تحميل الحالة
  await stateManager.load();
  const state = stateManager.get();

  // بناء الهيكل الأساسي (Header)
  const header = document.getElementById('appHeader');
  header.innerHTML = `
    <div class="brand" onclick="bus.emit('switchTab', 'dashboard')">🏥 PaedsWard <small>· احترافي</small></div>
    <div class="header-actions">
      <select id="roleSelect" onchange="switchRole(this.value)">
        <option value="senior">👨‍⚕️ استشاري</option>
        <option value="junior">🧑‍⚕️ مبتدئ</option>
        <option value="nurse">👩‍⚕️ ممرض</option>
        <option value="admin">📋 إداري</option>
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

  // بناء شريط التبويبات (Navigation)
  const nav = document.getElementById('appNav');
  nav.innerHTML = `
    <div class="tab-bar">
      ${['dashboard','ward','clinic','tasks','team','handover','reports'].map(tab => `
        <div class="tab" data-tab="${tab}" onclick="bus.emit('switchTab', '${tab}')">
          <span class="tab-icon">${tab === 'dashboard' ? '📊' : tab === 'ward' ? '🏥' : tab === 'clinic' ? '🩺' : tab === 'tasks' ? '📋' : tab === 'team' ? '👥' : tab === 'handover' ? '📝' : '📊'}</span>
          <span>${tab === 'dashboard' ? 'الرئيسية' : tab === 'ward' ? 'الجناح' : tab === 'clinic' ? 'العيادة' : tab === 'tasks' ? 'المهام' : tab === 'team' ? 'الفريق' : tab === 'handover' ? 'التسليم' : 'التقارير'}</span>
          <span class="badge" id="badge_${tab}">0</span>
        </div>
      `).join('')}
    </div>
  `;

  // تسجيل الأحداث العامة
  bus.on('render', () => {
    // سيتم تنفيذ التصيير بواسطة المكونات
  });

  bus.on('stateSaved', () => {
    // تحديث حالة الاتصال
    const dot = document.getElementById('syncDot');
    const label = document.getElementById('syncLabel');
    if (navigator.onLine) {
      dot.className = 'dot online';
      label.textContent = 'متصل';
    } else {
      dot.className = 'dot offline';
      label.textContent = 'محلي';
    }
    // تحديث الشارات
    updateBadges();
  });

  // تحديث الشارات
  function updateBadges() {
    const state = stateManager.get();
    const pending = state.tasks.filter(t => !t.done && (t.assignee === state.currentRole || state.currentRole === 'senior')).length;
    const urgent = state.handovers.filter(h => h.urgent && !h.acknowledged).length;
    const unread = state.teamMessages.filter(m => !m.read).length;
    const badgeMap = { tasks: pending, handover: urgent, team: unread };
    Object.entries(badgeMap).forEach(([id, count]) => {
      const el = document.getElementById(`badge_${id}`);
      if (el) {
        el.style.display = count ? 'block' : 'none';
        el.textContent = count;
      }
    });
    // زر الإدارة
    const adminBtn = document.getElementById('adminBtn');
    if (state.currentRole === 'senior') {
      adminBtn.classList.add('visible');
    } else {
      adminBtn.classList.remove('visible');
    }
  }

  // طلب إذن الإشعارات
  requestNotificationPermission();

  // بدء المزامنة الدورية
  setInterval(() => {
    if (navigator.onLine) stateManager.processSyncQueue();
  }, 30000);

  // مراقبة حالة الشبكة
  window.addEventListener('online', () => {
    stateManager.processSyncQueue();
    showToast('🔄 عاد الاتصال بالإنترنت، جاري المزامنة...', 'success');
  });

  window.addEventListener('offline', () => {
    showToast('⚠️ انقطع الاتصال بالإنترنت، سيتم حفظ البيانات محلياً', 'warning');
  });

  // تشغيل المكونات
  bus.emit('appReady');
  bus.emit('render');

  console.log('🚀 PaedsWard PRO جاهز!');
  console.log('👤 الدور:', state.currentRole);
  console.log('📦 الإصدار:', state._version);
});