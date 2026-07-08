// ================================================================
//  مكون التسليم SBAR
// ================================================================
class SbarHandover {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'handover';
    bus.on('switchTab', (tab) => {
      if (tab === this.tab) this.render();
    });
    bus.on('render', () => {
      if (this.tab === 'handover') this.render();
    });
    bus.on('stateChanged', () => this.render());
  }

  render() {
    const state = stateManager.get();
    const search = state.searchQuery || '';
    const filtered = state.handovers.filter(h =>
      h.situation.includes(search) || h.background.includes(search) ||
      h.assessment.includes(search) || h.recommendation.includes(search) ||
      (h.patientName && h.patientName.includes(search))
    );
    const sorted = [...filtered].sort((a, b) => {
      if (a.urgent && !a.acknowledged) return -1;
      if (b.urgent && !b.acknowledged) return 1;
      return 0;
    });

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">📝 التسليم (SBAR)</h2>
        ${this.hasPermission('create_handover') ? `<button class="small" onclick="sbar.showCreateForm()">➕ جديد</button>` : ''}
      </div>
    `;

    if (!sorted.length) {
      html += `<div class="empty-state"><div class="emoji">📄</div><p>${search ? 'لا توجد نتائج بحث' : 'لا يوجد تسليم'}</p></div>`;
    } else {
      sorted.forEach(h => {
        const isUrgent = h.urgent && !h.acknowledged;
        html += `
          <div class="card" style="border-right-color:${isUrgent ? 'var(--danger)' : 'var(--primary)'};">
            <div class="flex-between">
              <span class="title" style="font-size:13px;">${h.date} · ${h.author}</span>
              <div>
                ${isUrgent ? '<span class="urgent-badge" style="background:var(--danger);color:white;padding:1px 8px;border-radius:30px;font-size:10px;">🚨 عاجل</span>' : ''}
                ${h.acknowledged ? '<span class="done-badge" style="background:var(--success);color:white;padding:1px 8px;border-radius:30px;font-size:10px;">✓ تم الاستلام</span>' : ''}
              </div>
            </div>
            ${h.patientName ? `<div class="sub">👤 المريض: ${h.patientName}</div>` : ''}
            <div style="font-size:12px;margin-top:4px;">
              <div><b>S:</b> ${h.situation}</div>
              <div><b>B:</b> ${h.background}</div>
              <div><b>A:</b> ${h.assessment}</div>
              <div><b>R:</b> ${h.recommendation}</div>
            </div>
            ${!h.acknowledged ? `<div class="actions"><button class="small" onclick="sbar.acknowledge('${h.id}')">✓ استلام</button></div>` : ''}
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
      senior: ['view_all', 'manage_team', 'discharge', 'approve_plan', 'view_reports', 'create_task', 'view_patients', 'create_handover'],
      junior: ['admit', 'write_notes', 'complete_tasks', 'create_handover', 'view_patients', 'update_vitals'],
      nurse: ['update_vitals', 'view_patients', 'complete_tasks'],
      admin: ['manage_clinic', 'view_patients', 'send_alerts']
    };
    return ROLES[role] && ROLES[role].includes(perm);
  }

  showCreateForm() {
    const state = stateManager.get();
    const patients = state.patients.filter(p => p.status !== 'discharged');
    openModal(`
      <h2>📝 تسليم جديد (SBAR)</h2>
      <div style="margin-bottom:10px;background:#f8fafc;padding:8px;border-radius:8px;font-size:13px;color:var(--gray);">⚠️ جميع الحقول مطلوبة</div>
      <label>المريض</label>
      <select id="hoPatient" class="form-input">
        <option value="">اختر مريضاً (اختياري)</option>
        ${patients.map(p => `<option value="${p.id}">${p.name} (${p.diagnosis})</option>`).join('')}
      </select>
      <label>الموقف (S) *</label><input id="hoS" placeholder="ماذا يحدث؟">
      <label>الخلفية (B) *</label><input id="hoB" placeholder="التاريخ المرضي؟">
      <label>التقييم (A) *</label><input id="hoA" placeholder="التشخيص؟">
      <label>التوصية (R) *</label><input id="hoR" placeholder="ماذا نفعل؟">
      <label class="check-label" style="margin-top:4px;"><input type="checkbox" id="hoUrgent"> 🚨 عاجل</label>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button onclick="sbar.saveHandover()">حفظ</button>
        <button class="secondary" onclick="closeModal()">إلغاء</button>
      </div>
    `);
  }

  saveHandover() {
    const s = document.getElementById('hoS').value.trim();
    const b = document.getElementById('hoB').value.trim();
    const a = document.getElementById('hoA').value.trim();
    const r = document.getElementById('hoR').value.trim();
    const urgent = document.getElementById('hoUrgent').checked;
    const patientId = document.getElementById('hoPatient').value;

    if (!s || !b || !a || !r) {
      showToast('⚠️ جميع حقول SBAR مطلوبة', 'error');
      return;
    }

    const state = stateManager.get();
    const patient = state.patients.find(p => p.id === patientId);
    const newHandover = {
      id: 'temp_' + uid(),
      date: today(),
      author: getRoleLabel(state.currentRole),
      patientId: patientId || null,
      patientName: patient ? patient.name : null,
      situation: s,
      background: b,
      assessment: a,
      recommendation: r,
      urgent: urgent,
      acknowledged: false,
      updatedAt: Date.now()
    };

    state.handovers.push(newHandover);
    stateManager.save();
    stateManager.addToQueue('handovers', 'POST', newHandover, newHandover.id);

    closeModal();
    bus.emit('render');
    showToast('📝 تم حفظ التسليم', 'success');
  }

  acknowledge(id) {
    const state = stateManager.get();
    const h = state.handovers.find(handover => handover.id === id);
    if (!h) return;
    h.acknowledged = true;
    h.updatedAt = Date.now();
    stateManager.save();
    stateManager.addToQueue('handovers', 'PATCH', { acknowledged: true, updatedAt: h.updatedAt }, h.id);
    bus.emit('render');
    showToast('✅ تم استلام التسليم', 'success');
  }
}

const sbar = new SbarHandover();
window.sbar = sbar;