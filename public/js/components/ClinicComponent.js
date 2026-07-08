// ================================================================
//  مكون العيادة (Clinic)
// ================================================================
class ClinicComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'clinic';
    bus.on('switchTab', (tab) => {
      if (tab === this.tab) this.render();
    });
    bus.on('render', () => {
      if (this.tab === 'clinic') this.render();
    });
    bus.on('stateChanged', () => this.render());
  }

  render() {
    const state = stateManager.get();
    const search = state.searchQuery || '';
    const slots = state.clinicSlots.filter(s =>
      s.patientName.includes(search) || s.reason.includes(search)
    );

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">🩺 العيادة</h2>
        ${this.hasPermission('manage_clinic') ? `<button class="small" onclick="clinic.showAddForm()">➕ إضافة</button>` : ''}
      </div>
    `;

    if (!slots.length) {
      html += `<div class="empty-state"><div class="emoji">📋</div><p>${search ? 'لا توجد نتائج بحث' : 'لا توجد مواعيد'}</p></div>`;
    } else {
      slots.forEach(s => {
        html += `
          <div class="card" style="border-right-color:${s.status === 'مكتمل' ? 'var(--success)' : 'var(--warning)'};">
            <div class="flex-between">
              <div>
                <div class="title">${s.patientName}</div>
                <div class="sub">⏰ ${s.time} · ${s.age} سنة · ${s.reason}</div>
              </div>
              <span class="status-badge ${s.status === 'مكتمل' ? 'completed' : 'waiting'}">${s.status}</span>
            </div>
            ${this.hasPermission('manage_clinic') ? `
              <div class="actions">
                <button class="small secondary" onclick="clinic.updateStatus('${s.id}','مكتمل')">✅ مكتمل</button>
                <button class="small danger" onclick="clinic.removeSlot('${s.id}')">🗑️</button>
              </div>
            ` : ''}
          </div>
        `;
      });
    }

    this.container.innerHTML = html;
  }

  hasPermission(perm) {
    const state = stateManager.get();
    const role = state.currentRole;
    const ROLES = {
      senior: ['view_all', 'manage_team', 'discharge', 'approve_plan', 'view_reports', 'create_task', 'view_patients'],
      junior: ['admit', 'write_notes', 'complete_tasks', 'create_handover', 'view_patients', 'update_vitals'],
      nurse: ['update_vitals', 'view_patients', 'complete_tasks'],
      admin: ['manage_clinic', 'view_patients', 'send_alerts']
    };
    return ROLES[role] && ROLES[role].includes(perm);
  }

  showAddForm() {
    openModal(`
      <h2>➕ إضافة موعد جديد</h2>
      <label>الوقت *</label><input id="clinicTime" type="time" value="${timeNow()}">
      <label>اسم المريض *</label><input id="clinicName" placeholder="مثال: فاطمة علي">
      <label>العمر *</label><input id="clinicAge" type="number" placeholder="4">
      <label>سبب الزيارة *</label><input id="clinicReason" placeholder="مثال: متابعة ربو">
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button onclick="clinic.saveSlot()">حفظ</button>
        <button class="secondary" onclick="closeModal()">إلغاء</button>
      </div>
    `);
  }

  saveSlot() {
    const time = document.getElementById('clinicTime').value;
    const name = document.getElementById('clinicName').value.trim();
    const age = parseInt(document.getElementById('clinicAge').value);
    const reason = document.getElementById('clinicReason').value.trim();

    if (!time || !name || isNaN(age) || age <= 0 || !reason) {
      showToast('⚠️ جميع الحقول مطلوبة', 'error');
      return;
    }

    const state = stateManager.get();
    const newSlot = {
      id: 'temp_' + uid(),
      time,
      patientName: name,
      age,
      reason,
      status: 'انتظار',
      updatedAt: Date.now()
    };

    state.clinicSlots.push(newSlot);
    stateManager.save();
    stateManager.addToQueue('clinicSlots', 'POST', newSlot, newSlot.id);

    closeModal();
    bus.emit('render');
    showToast('✅ تمت إضافة الموعد', 'success');
  }

  updateStatus(id, status) {
    const state = stateManager.get();
    const s = state.clinicSlots.find(slot => slot.id === id);
    if (!s) return;
    s.status = status;
    s.updatedAt = Date.now();
    stateManager.save();
    stateManager.addToQueue('clinicSlots', 'PATCH', { status, updatedAt: s.updatedAt }, s.id);
    bus.emit('render');
    showToast('✅ تم تحديث الحالة', 'success');
  }

  removeSlot(id) {
    if (!confirm('حذف هذا الموعد؟')) return;
    const state = stateManager.get();
    const s = state.clinicSlots.find(slot => slot.id === id);
    state.clinicSlots = state.clinicSlots.filter(slot => slot.id !== id);
    stateManager.save();
    if (s) stateManager.addToQueue('clinicSlots', 'DELETE', null, s.id);
    bus.emit('render');
    showToast('🗑️ تم حذف الموعد', 'warning');
  }
}

const clinic = new ClinicComponent();
window.clinic = clinic;