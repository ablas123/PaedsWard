// ================================================================
//  مكون الجناح (Ward) – مع سير العمل وإدارة المرضى
// ================================================================
class WardComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'ward';
    bus.on('switchTab', (tab) => {
      if (tab === this.tab) this.render();
    });
    bus.on('render', () => {
      if (this.tab === 'ward') this.render();
    });
    bus.on('stateChanged', () => this.render());
  }

  render() {
    const state = stateManager.get();
    const active = state.patients.filter(p => p.status !== 'discharged');
    const discharged = state.patients.filter(p => p.status === 'discharged');
    const search = state.searchQuery || '';

    // تطبيق البحث
    const filtered = active.filter(p =>
      p.name.includes(search) || p.diagnosis.includes(search) || p.bed.includes(search)
    );

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">🏥 الجناح</h2>
        ${this.hasPermission('admit') ? `<button class="small" onclick="ward.showAdmissionWizard()">➕ قبول</button>` : ''}
      </div>
      <div class="text-muted text-sm">👥 ${filtered.length} مريض نشط · ${discharged.length} مكتمل</div>
    `;

    if (!filtered.length) {
      html += `<div class="empty-state"><div class="emoji">🛏️</div><p>${search ? 'لا توجد نتائج بحث' : 'لا يوجد مرضى نشطين'}</p></div>`;
    } else {
      filtered.forEach(p => {
        const stage = p.workflowStage || 1;
        const stageLabels = ['الاستقبال', 'الخطة', 'التنفيذ', 'الخروج'];
        const stageClass = `stage${stage}`;
        const borderColor = stage === 3 ? 'var(--danger)' : stage === 2 ? 'var(--warning)' : 'var(--primary)';
        html += `
          <div class="card clickable" onclick="ward.viewPatient('${p.id}')" style="border-right-color:${borderColor};">
            <div class="flex-between">
              <div>
                <div class="title">${p.name} <span class="text-muted text-sm">(${p.age}س)</span></div>
                <div class="sub">${p.diagnosis} · سرير ${p.bed}</div>
              </div>
              <span class="status-badge ${stageClass}">${stageLabels[stage-1]}</span>
            </div>
            <div class="meta">
              <span>⚖️ ${p.weight}كجم</span>
              <span>🩺 ${p.vitals || '—'}</span>
            </div>
            <div class="actions">
              ${this.hasPermission('update_vitals') ? `<button class="small secondary" onclick="event.stopPropagation();ward.updateVitals('${p.id}')">📊 فحوصات</button>` : ''}
              ${this.hasPermission('write_notes') ? `<button class="small secondary" onclick="event.stopPropagation();ward.addNote('${p.id}')">📝 ملاحظة</button>` : ''}
              ${this.hasPermission('approve_plan') && stage < 4 ? `<button class="small secondary" onclick="event.stopPropagation();ward.advanceStage('${p.id}')">➡️ تقدم</button>` : ''}
              ${this.hasPermission('discharge') ? `<button class="small danger" onclick="event.stopPropagation();ward.dischargePatient('${p.id}')">⬆️ خروج</button>` : ''}
            </div>
          </div>
        `;
      });
    }

    if (discharged.length) {
      html += `<details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:600;color:var(--gray);font-size:12px;">✅ مكتمل (${discharged.length})</summary>`;
      discharged.forEach(p => {
        html += `<div class="card" style="border-right-color:var(--gray);opacity:0.6;">
          <div class="flex-between"><span class="title" style="font-size:13px;">${p.name}</span><span class="status-badge discharged">مكتمل</span></div>
          <div class="sub">${p.diagnosis} · ${p.age}س</div>
        </div>`;
      });
      html += `</details>`;
    }

    this.container.innerHTML = html;
  }

  hasPermission(perm) {
    const state = stateManager.get();
    const role = state.currentRole;
    const ROLES = {
      senior: ['view_all', 'manage_team', 'discharge', 'approve_plan', 'view_reports', 'create_task', 'view_patients', 'admit', 'write_notes', 'update_vitals'],
      junior: ['admit', 'write_notes', 'complete_tasks', 'create_handover', 'view_patients', 'update_vitals'],
      nurse: ['update_vitals', 'view_patients', 'complete_tasks'],
      admin: ['manage_clinic', 'view_patients', 'send_alerts']
    };
    return ROLES[role] && ROLES[role].includes(perm);
  }

  // ─── قبول مريض (Wizard) ───
  showAdmissionWizard() {
    let wizardData = {};
    let step = 1;
    const render = (s) => {
      let html = `
        <h2>➕ قبول مريض جديد</h2>
        <div class="wizard-progress">
          ${[1,2,3].map(st => `
            <div class="step-indicator">
              <div class="step-circle ${st===s?'active':st<s?'done':''}">${st<s?'✓':st}</div>
              <div class="step-label">${st===1?'أساسية':st===2?'سريرية':'تاريخ'}</div>
            </div>
          `).join('')}
        </div>
        <div class="wizard-step ${s===1?'active':''}" data-step="1">
          <label>الاسم *</label><input id="admName" value="${wizardData.name||''}" placeholder="مثال: نور الهاشمي">
          <div class="form-row">
            <div><label>العمر (سنة) *</label><input id="admAge" type="number" value="${wizardData.age||''}" placeholder="3"></div>
            <div><label>الوزن (كجم) *</label><input id="admWeight" type="number" step="0.1" value="${wizardData.weight||''}" placeholder="14"></div>
          </div>
          <div class="form-row">
            <div><label>الطول (سم)</label><input id="admHeight" type="number" step="0.1" value="${wizardData.height||''}" placeholder="95"></div>
            <div><label>السرير *</label><input id="admBed" value="${wizardData.bed||''}" placeholder="مثال: PICU-2"></div>
          </div>
          <button onclick="ward.wizardNext(1)" class="block">التالي →</button>
        </div>
        <div class="wizard-step ${s===2?'active':''}" data-step="2">
          <label>التشخيص *</label><input id="admDiagnosis" value="${wizardData.diagnosis||''}" placeholder="مثال: التهاب القصيبات">
          <label>مصدر الدخول</label>
          <select id="admSource" class="form-input">
            <option value="ER">الطوارئ</option>
            <option value="OPD">العيادة</option>
            <option value="Transfer">تحويل</option>
          </select>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button onclick="ward.wizardPrev(2)" class="secondary">← السابق</button>
            <button onclick="ward.wizardNext(2)" class="block" style="flex:1;">التالي →</button>
          </div>
        </div>
        <div class="wizard-step ${s===3?'active':''}" data-step="3">
          <label>التاريخ المرضي والفحص</label>
          <textarea id="admHistory" placeholder="الملاحظات السريرية...">${wizardData.history||''}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button onclick="ward.wizardPrev(3)" class="secondary">← السابق</button>
            <button onclick="ward.wizardSubmit()" class="success" style="flex:1;">✅ قبول</button>
          </div>
        </div>
      `;
      openModal(html);
    };

    this.wizardNext = (s) => {
      if (s === 1) {
        wizardData.name = document.getElementById('admName')?.value || '';
        wizardData.age = document.getElementById('admAge')?.value || '';
        wizardData.weight = document.getElementById('admWeight')?.value || '';
        wizardData.height = document.getElementById('admHeight')?.value || '';
        wizardData.bed = document.getElementById('admBed')?.value || '';
        if (!wizardData.name || !wizardData.age || !wizardData.weight || !wizardData.bed) {
          showToast('⚠️ الحقول المطلوبة يجب تعبئتها', 'error');
          return;
        }
      } else if (s === 2) {
        wizardData.diagnosis = document.getElementById('admDiagnosis')?.value || '';
        wizardData.source = document.getElementById('admSource')?.value || 'ER';
        if (!wizardData.diagnosis) {
          showToast('⚠️ التشخيص مطلوب', 'error');
          return;
        }
      }
      render(s + 1);
    };

    this.wizardPrev = (s) => {
      if (s === 2) {
        wizardData.diagnosis = document.getElementById('admDiagnosis')?.value || '';
        wizardData.source = document.getElementById('admSource')?.value || 'ER';
      } else if (s === 3) {
        wizardData.history = document.getElementById('admHistory')?.value || '';
      }
      render(s - 1);
    };

    this.wizardSubmit = () => {
      wizardData.history = document.getElementById('admHistory')?.value || '';
      const { name, age, weight, height, bed, diagnosis, source, history } = wizardData;
      if (!name || isNaN(parseFloat(age)) || parseFloat(age) <= 0 || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0 || !bed || !diagnosis) {
        showToast('⚠️ جميع الحقول المطلوبة يجب تعبئتها بشكل صحيح', 'error');
        return;
      }
      const id = 'temp_' + uid();
      const newPatient = {
        id,
        name,
        age: parseFloat(age),
        weight: parseFloat(weight),
        height: parseFloat(height) || null,
        bed,
        diagnosis,
        status: 'admitted',
        vitals: '',
        fluids: '',
        meds: '',
        notes: history || '',
        admissionDate: today(),
        dischargeDate: null,
        source,
        workflowStage: 1,
        dischargeChecklist: { summary: false, meds: false, followUp: false, education: false, signature: false },
        vitalsHistory: [],
        updatedAt: Date.now()
      };

      const state = stateManager.get();
      state.patients.push(newPatient);
      stateManager.save();

      // إضافة إلى طابور المزامنة
      stateManager.addToQueue('patients', 'POST', newPatient, id);

      // إضافة مهمة تلقائية
      const taskId = 'temp_' + uid();
      const newTask = {
        id: taskId,
        text: `تقييم كامل لـ ${name}`,
        priority: 'high',
        assignee: 'junior',
        done: false,
        createdAt: today(),
        dueDate: today(),
        dueTime: timeNow(),
        reminded: false,
        updatedAt: Date.now()
      };
      state.tasks.push(newTask);
      stateManager.addToQueue('tasks', 'POST', newTask, taskId);
      stateManager.save();

      closeModal();
      bus.emit('render');
      showToast(`✅ تم قبول ${name}`, 'success');
    };

    render(1);
  }

  // ─── عرض تفاصيل المريض ───
  viewPatient(id) {
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    const stageLabels = ['الاستقبال والتقييم', 'وضع الخطة العلاجية', 'التنفيذ والمتابعة', 'الخروج والمتابعة'];
    const stageEmojis = ['📥', '📋', '⚕️', '🚪'];
    let html = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <button class="small secondary" onclick="closeModal()">← رجوع</button>
        <h2 style="margin:0;">${p.name}</h2>
        <span class="text-muted text-sm">${p.age}س · ${p.weight}كجم</span>
      </div>
      <div class="workflow-progress">
        ${[1,2,3,4].map(s => `
          <div class="workflow-step">
            <div class="step-circle ${s === p.workflowStage ? 'active' : s < p.workflowStage ? 'done' : ''}">${s < p.workflowStage ? '✓' : s}</div>
            <div class="step-label">${stageEmojis[s-1]} ${stageLabels[s-1].split(' ')[0]}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;">
        <div><b>التشخيص</b><br>${p.diagnosis}</div>
        <div><b>السرير</b><br>${p.bed}</div>
        <div><b>الفحوصات</b><br>${p.vitals || '—'}</div>
        <div><b>الأدوية</b><br>${p.meds || '—'}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">
        ${this.hasPermission('update_vitals') ? `<button class="small secondary" onclick="ward.updateVitals('${p.id}');closeModal();">📊 فحوصات</button>` : ''}
        ${this.hasPermission('write_notes') ? `<button class="small secondary" onclick="ward.addNote('${p.id}');closeModal();">📝 ملاحظة</button>` : ''}
        ${this.hasPermission('approve_plan') && p.workflowStage < 4 ? `<button class="small secondary" onclick="ward.advanceStage('${p.id}');closeModal();">➡️ تقدم</button>` : ''}
        ${this.hasPermission('discharge') ? `<button class="small danger" onclick="ward.dischargePatient('${p.id}');closeModal();">⬆️ خروج</button>` : ''}
      </div>
      <div class="card" style="margin-top:8px;border-right-color:var(--gray);">
        <div class="title">📝 الملاحظات</div>
        <div style="font-size:13px;max-height:120px;overflow-y:auto;">${p.notes || 'لا توجد ملاحظات'}</div>
      </div>
    `;
    openModal(html);
  }

  // ─── تقدم المرحلة ───
  advanceStage(id) {
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    if (p.workflowStage >= 4) {
      showToast('⚠️ المريض في المرحلة النهائية', 'warning');
      return;
    }
    p.workflowStage = (p.workflowStage || 1) + 1;
    p.updatedAt = Date.now();
    stateManager.save();
    // إضافة إلى طابور المزامنة
    stateManager.addToQueue('patients', 'PATCH', { workflowStage: p.workflowStage, updatedAt: p.updatedAt }, p.id);
    bus.emit('render');
    showToast(`✅ تم تقدم ${p.name} إلى المرحلة ${p.workflowStage}`, 'success');
  }

  // ─── تحديث الفحوصات ───
  updateVitals(id) {
    const val = prompt('أدخل الفحوصات (مثال: T:37.5 HR:130 SpO₂:96%):');
    if (val === null) return;
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    if (!p.vitalsHistory) p.vitalsHistory = [];
    p.vitalsHistory.push({ timestamp: new Date().toISOString(), vitals: val });
    p.vitals = val;
    p.updatedAt = Date.now();
    stateManager.save();
    stateManager.addToQueue('patients', 'PATCH', { vitals: val, vitalsHistory: p.vitalsHistory, updatedAt: p.updatedAt }, p.id);
    bus.emit('render');
    showToast('✅ تم تحديث الفحوصات', 'success');
  }

  // ─── إضافة ملاحظة ───
  addNote(id) {
    const note = prompt('أضف ملاحظة سريرية:');
    if (!note) return;
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    p.notes = (p.notes || '') + '\n' + today() + ' ' + timeNow() + ': ' + note;
    p.updatedAt = Date.now();
    stateManager.save();
    stateManager.addToQueue('patients', 'PATCH', { notes: p.notes, updatedAt: p.updatedAt }, p.id);
    bus.emit('render');
    showToast('📝 تم إضافة الملاحظة', 'success');
  }

  // ─── خروج المريض ───
  dischargePatient(id) {
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    if (p.workflowStage < 4) {
      showToast('⚠️ يجب إكمال جميع مراحل سير العمل قبل الخروج', 'error');
      return;
    }
    openModal(`
      <h2>📋 خروج المريض: ${p.name}</h2>
      <div style="margin:12px 0;background:#f8fafc;padding:12px;border-radius:8px;">
        <p style="font-size:13px;color:#475569;">يرجى التأكد من استكمال جميع البنود</p>
      </div>
      <div style="margin:10px 0;">
        <label class="check-label"><input type="checkbox" id="dcSummary" ${p.dischargeChecklist?.summary?'checked':''}> ✅ ملخص الخروج</label>
        <label class="check-label"><input type="checkbox" id="dcMeds" ${p.dischargeChecklist?.meds?'checked':''}> ✅ شرح الأدوية</label>
        <label class="check-label"><input type="checkbox" id="dcFollow" ${p.dischargeChecklist?.followUp?'checked':''}> ✅ موعد المتابعة</label>
        <label class="check-label"><input type="checkbox" id="dcEducation" ${p.dischargeChecklist?.education?'checked':''}> ✅ تثقيف المريض</label>
        <label class="check-label"><input type="checkbox" id="dcSignature" ${p.dischargeChecklist?.signature?'checked':''}> ✅ توقيع الطبيب</label>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="ward.saveDischargeChecklist('${p.id}')" class="secondary small">💾 حفظ</button>
        <button onclick="ward.finalizeDischarge('${p.id}')" class="success" style="flex:1;">✍️ تأكيد الخروج</button>
      </div>
    `);
  }

  saveDischargeChecklist(id) {
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    p.dischargeChecklist = {
      summary: document.getElementById('dcSummary').checked,
      meds: document.getElementById('dcMeds').checked,
      followUp: document.getElementById('dcFollow').checked,
      education: document.getElementById('dcEducation').checked,
      signature: document.getElementById('dcSignature').checked
    };
    p.updatedAt = Date.now();
    stateManager.save();
    stateManager.addToQueue('patients', 'PATCH', { dischargeChecklist: p.dischargeChecklist, updatedAt: p.updatedAt }, p.id);
    showToast('✅ تم حفظ قائمة التدقيق', 'success');
  }

  finalizeDischarge(id) {
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    const allChecked = ['dcSummary','dcMeds','dcFollow','dcEducation','dcSignature'].every(el => document.getElementById(el).checked);
    if (!allChecked) {
      showToast('⚠️ يجب استكمال جميع بنود القائمة', 'error');
      return;
    }
    if (!confirm(`تأكيد خروج ${p.name}؟`)) return;
    p.status = 'discharged';
    p.dischargeDate = today();
    p.updatedAt = Date.now();
    stateManager.save();
    stateManager.addToQueue('patients', 'PATCH', { status: p.status, dischargeDate: p.dischargeDate, updatedAt: p.updatedAt }, p.id);
    closeModal();
    bus.emit('render');
    showToast(`⬆️ تم خروج ${p.name}`, 'success');
  }
}

// تهيئة المكون
const ward = new WardComponent();
window.ward = ward;