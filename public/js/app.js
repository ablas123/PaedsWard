// ================================================================
//  app.js – نقطة الانطلاق الرئيسية (Entry Point)
//  يربط جميع المكونات ويدير دورة حياة التطبيق
// ================================================================

// ─── دوال مساعدة عامة ───
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

function getRoleEmoji(role) {
  const map = { senior: '👨‍⚕️', junior: '🧑‍⚕️', nurse: '👩‍⚕️', admin: '📋' };
  return map[role] || '👤';
}

// ─── عرض الرسائل التنبيهية (Toast) ───
function showToast(message, type = 'info', duration = 3500) {
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

// ─── فتح وإغلاق النافذة المنبثقة (Modal) ───
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
  const state = stateManager.get();
  state.searchQuery = query.toLowerCase();
  stateManager.save();
  bus.emit('search', state.searchQuery);
}
window.searchGlobal = searchGlobal;

// ─── تصدير البيانات ───
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

// ─── استيراد البيانات ───
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

// ─── طلب إذن الإشعارات ───
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ─── تهيئة التطبيق ───
document.addEventListener('DOMContentLoaded', async () => {
  // 1. تحميل الحالة
  await stateManager.load();
  const state = stateManager.get();

  // 2. بناء الهيكل الأساسي (Header)
  const header = document.getElementById('appHeader');
  if (header) {
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
  }

  // 3. بناء شريط التبويبات (Navigation)
  const nav = document.getElementById('appNav');
  if (nav) {
    const tabs = [
      { id: 'dashboard', icon: '📊', label: 'الرئيسية' },
      { id: 'ward', icon: '🏥', label: 'الجناح' },
      { id: 'clinic', icon: '🩺', label: 'العيادة' },
      { id: 'tasks', icon: '📋', label: 'المهام' },
      { id: 'team', icon: '👥', label: 'الفريق' },
      { id: 'handover', icon: '📝', label: 'التسليم' },
      { id: 'reports', icon: '📊', label: 'التقارير' }
    ];
    nav.innerHTML = `
      <div class="tab-bar">
        ${tabs.map(tab => `
          <div class="tab" data-tab="${tab.id}" onclick="bus.emit('switchTab', '${tab.id}')">
            <span class="tab-icon">${tab.icon}</span>
            <span>${tab.label}</span>
            <span class="badge" id="badge_${tab.id}">0</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 4. تسجيل الأحداث العامة
  bus.on('render', () => {
    // يتم التعامل معه بواسطة المكونات
  });

  bus.on('stateSaved', () => {
    // تحديث حالة الاتصال
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

  // 5. تحديث الشارات (Badges)
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
    if (adminBtn) {
      if (state.currentRole === 'senior') {
        adminBtn.classList.add('visible');
      } else {
        adminBtn.classList.remove('visible');
      }
    }
  }

  // 6. تهيئة المكونات (components)
  // جميع المكونات قد تم تعريفها مسبقاً في ملفاتها الخاصة
  // ونقوم فقط بتفعيلها عبر الأحداث

  // تعيين التبويب الافتراضي
  let currentTab = 'dashboard';

  bus.on('switchTab', (tab) => {
    if (currentTab === tab) return;
    currentTab = tab;
    // تحديث التبويبات النشطة
    document.querySelectorAll('.tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    // تحديث البادجات
    updateBadges();
    // تشغيل التصيير لكل مكون حسب تبويبه
    bus.emit('render');
  });

  // تعيين التبويب النشط عند التحميل
  setTimeout(() => {
    const firstTab = document.querySelector('.tab[data-tab="dashboard"]');
    if (firstTab) firstTab.classList.add('active');
    bus.emit('switchTab', 'dashboard');
  }, 100);

  // 7. بدء المزامنة الدورية
  setInterval(() => {
    if (navigator.onLine) stateManager.processSyncQueue();
  }, 30000);

  // 8. مراقبة حالة الشبكة
  window.addEventListener('online', () => {
    bus.emit('networkOnline');
  });

  window.addEventListener('offline', () => {
    bus.emit('networkOffline');
  });

  // 9. طلب إذن الإشعارات
  requestNotificationPermission();

  // 10. إشعارات المهام (كل دقيقة)
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

  // 11. إظهار رسالة الترحيب
  console.log('🚀 PaedsWard PRO جاهز!');
  console.log('👤 الدور:', state.currentRole);
  console.log('📦 الإصدار:', state._version);
  console.log('👥 المرضى:', state.patients.length);
  console.log('📋 المهام:', state.tasks.length);

  // 12. تنبيه إذا كان هناك طابور مزامنة معلق
  if (state.syncQueue && state.syncQueue.length > 0) {
    showToast(`🔄 يوجد ${state.syncQueue.length} عملية في طابور المزامنة`, 'warning', 5000);
    if (navigator.onLine) {
      setTimeout(() => stateManager.processSyncQueue(), 2000);
    }
  }

  // 13. التصيير الأولي
  bus.emit('render');
}); 