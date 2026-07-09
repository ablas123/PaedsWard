// ================================================================
//  مكون الجناح (Ward) – مع تفاعل حقيقي مع الخادم
// ================================================================
class WardComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'ward';
    this.searchQuery = '';
    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'ward') this.render(); });
    bus.on('stateChanged', () => this.render());
    bus.on('search', (q) => { this.searchQuery = q; this.render(); });
  }

  render() {
    const state = stateManager.get();
    const role = state.currentRole;
    let patients = state.patients.filter(p => p.status !== 'discharged');
    if (this.searchQuery) {
      patients = patients.filter(p => p.name.includes(this.searchQuery) || p.diagnosis.includes(this.searchQuery) || p.bed.includes(this.searchQuery));
    }

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">🏥 الجناح</h2>
        ${hasPermission(role, 'admit') ? `<button class="small" onclick="ward.showAdmissionForm()">➕ قبول</button>` : ''}
      </div>
      <div class="text-muted text-sm">👥 ${patients.length} مريض نشط</div>
    `;

    if (!patients.length) {
      html += `<div class="empty-state"><div class="emoji">🛏️</div><p>${this.searchQuery ? 'لا توجد نتائج بحث' : 'لا يوجد مرضى نشطين'}</p></div>`;
    } else {
      patients.forEach(p => {
        const statusMap = { critical: 'حرج', followup: 'متابعة', stable: 'مستقر' };
        const statusLabel = statusMap[p.patientStatus] || 'مستقر';
        const statusClass = p.patientStatus === 'critical' ? 'critical' : p.patientStatus === 'followup' ? 'followup' : 'stable';
        html += `
          <div class="card clickable" onclick="ward.viewPatient('${p.id}')" style="border-right-color:${p.patientStatus === 'critical' ? 'var(--danger)' : p.patientStatus === 'followup' ? 'var(--warning)' : 'var(--primary)'};">
            <div class="flex-between">
              <div><div class="title">${p.name} <span class="text-muted text-sm">(${p.age}س)</span></div>
              <div class="sub">${p.diagnosis} · سرير ${p.bed}</div></div>
              <span class="status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <div class="meta"><span>⚖️ ${p.weight}كجم</span><span>🩺 ${p.vitals || '—'}</span></div>
            <div class="sub">👨‍⚕️ طبيب الامتياز: ${p.assignedIntern || 'غير معين'}</div>
            <div class="actions">
              ${hasPermission(role, 'update_vitals') ? `<button class="small secondary" onclick="ward.updateVitals('${p.id}')">📊 فحوصات</button>` : ''}
              ${hasPermission(role, 'write_notes') ? `<button class="small secondary" onclick="ward.addNote('${p.id}')">📝 ملاحظة</button>` : ''}
              ${hasPermission(role, 'discharge') ? `<button class="small danger" onclick="ward.dischargePatient('${p.id}')">⬆️ خروج</button>` : ''}
              ${hasPermission(role, 'add_alert') ? `<button class="small secondary" onclick="ward.addAlert('${p.id}')">🔔 تنبيه</button>` : ''}
            </div>
          </div>
        `;
      });
    }
    this.container.innerHTML = html;
  }

  showAdmissionForm() {
    openModal(`
      <h2>➕ قبول مريض جديد</h2>
      <label>الاسم *</label><input id="admName" placeholder="مثال: نور الهاشمي">
      <div class="form-row"><div><label>العمر (سنة) *</label><input id="admAge" type="number" placeholder="3"></div><div><label>الوزن (كجم) *</label><input id="admWeight" type="number" step="0.1" placeholder="14"></div></div>
      <div class="form-row"><div><label>الطول (سم)</label><input id="admHeight" type="number" step="0.1" placeholder="95"></div><div><label>السرير *</label><input id="admBed" placeholder="PICU-2"></div></div>
      <label>التشخيص *</label><input id="admDiagnosis" placeholder="التهاب القصيبات">
      <label>طبيب الامتياز المسؤول</label>
      <select id="admIntern" class="form-input">
        <option value="">اختر طبيب امتياز</option>
        ${stateManager.get().teamMembers.filter(m => m.role === 'intern').map(m => `<option value="${m.email}">${m.name}</option>`).join('')}
      </select>
      <label>التاريخ المرضي</label><textarea id="admHistory" placeholder="الملاحظات..."></textarea>
      <div style="display:flex;gap:8px;margin-top:10px;"><button onclick="ward.submitAdmission()">قبول</button><button class="secondary" onclick="closeModal()">إلغاء</button></div>
    `);
  }

  async submitAdmission() {
    const name = document.getElementById('admName').value.trim();
    const age = parseFloat(document.getElementById('admAge').value);
    const weight = parseFloat(document.getElementById('admWeight').value);
    const height = parseFloat(document.getElementById('admHeight').value) || null;
    const bed = document.getElementById('admBed').value.trim();
    const diagnosis = document.getElementById('admDiagnosis').value.trim();
    const assignedIntern = document.getElementById('admIntern').value;
    const history = document.getElementById('admHistory').value.trim();

    if (!name || isNaN(age) || age <= 0 || isNaN(weight) || weight <= 0 || !bed || !diagnosis) {
      showToast('⚠️ جميع الحقول المطلوبة يجب تعبئتها', 'error');
      return;
    }

    const newPatient = {
      id: 'temp_' + uid(),
      name, age, weight, height, bed, diagnosis,
      status: 'admitted',
      patientStatus: 'stable',
      assignedIntern: assignedIntern || null,
      vitals: '',
      notes: history || '',
      admissionDate: today(),
      dischargeDate: null,
      history: { chiefComplaint: '', hpi: '', past: '', birth: '', development: '', immunization: '', nutrition: '', familySocial: '' },
      examination: { general: '', vitals: '', chest: '', cvs: '', abdo: '', ent: '', neuro: '', growth: '' },
      investigations: [],
      summary: { diagnosis: '', dd: '', problemList: '', managementPlan: '', dischargeSummary: '' },
      soap: [],
      updatedAt: Date.now()
    };

    // إضافة عبر StateManager (مزامنة مع الخادم)
    const result = await stateManager.addItem('patients', newPatient);
    if (result && result.id) {
      // تنبيه للطبيب الامتياز
      if (assignedIntern) {
        stateManager.addAlert(
          `مريض جديد: ${name}`,
          `تم قبول ${name} تحت متابعتك. التشخيص: ${diagnosis}`,
          'intern',
          assignedIntern
        );
      }
      closeModal();
      bus.emit('render');
      showToast(`✅ تم قبول ${name}`, 'success');
    } else {
      // إذا فشل الإضافة، سيتم إضافتها إلى الطابور
      closeModal();
      showToast(`✅ تم قبول ${name} (سيتم المزامنة عند عودة الاتصال)`, 'success');
    }
  }

  viewPatient(id) {
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;

    const statusMap = { critical: '🔴 حرج', followup: '🟡 متابعة', stable: '🟢 مستقر' };
    let html = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <button class="small secondary" onclick="closeModal()">← رجوع</button>
        <h2 style="margin:0;">${p.name}</h2>
        <span class="text-muted text-sm">${p.age}س · ${p.weight}كجم</span>
        <span class="status-badge ${p.patientStatus}">${statusMap[p.patientStatus] || '🟢 مستقر'}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;">
        <div><b>التشخيص</b><br>${p.diagnosis}</div>
        <div><b>السرير</b><br>${p.bed}</div>
        <div><b>الفحوصات</b><br>${p.vitals || '—'}</div>
        <div><b>طبيب الامتياز</b><br>${p.assignedIntern || 'غير معين'}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0;">
        <button class="small secondary" onclick="ward.showSoapForm('${p.id}')">📝 إضافة SOAP</button>
        <button class="small secondary" onclick="ward.showHistoryForm('${p.id}')">📋 السيرة المرضية</button>
        <button class="small secondary" onclick="ward.showExamForm('${p.id}')">🩺 الفحص السريري</button>
        <button class="small secondary" onclick="ward.showInvestForm('${p.id}')">🔬 التحاليل</button>
        <button class="small secondary" onclick="ward.showSummaryForm('${p.id}')">📄 الملخص</button>
      </div>
      <div class="card" style="border-right-color:var(--gray);">
        <div class="title">📝 المتابعات (SOAP)</div>
        ${p.soap && p.soap.length ? p.soap.slice().reverse().map(s =>
          `<div style="font-size:12px;border-bottom:1px solid #e2e8f0;padding:6px 0;">
            <span class="text-muted">${new Date(s.date).toLocaleString()}</span>
            <span class="role-tag">${s.author}</span>
            <div><b>S:</b> ${s.subjective}</div>
            <div><b>O:</b> ${s.objective}</div>
            <div><b>A:</b> ${s.assessment}</div>
            <div><b>P:</b> ${s.plan}</div>
          </div>`
        ).join('') : '<div class="text-muted">لا توجد متابعات</div>'}
      </div>
    `;
    openModal(html);
  }

  // ─── دوال SOAP ───
  showSoapForm(id) {
    openModal(`
      <h2>📝 إضافة متابعة SOAP</h2>
      <label>Subjective (الشكوى) *</label><textarea id="soapS" placeholder="ما يشكو منه المريض؟"></textarea>
      <label>Objective (الفحوصات) *</label><textarea id="soapO" placeholder="العلامات الحيوية والفحص"></textarea>
      <label>Assessment (التقييم) *</label><textarea id="soapA" placeholder="التشخيص أو التقييم"></textarea>
      <label>Plan (الخطة) *</label><textarea id="soapP" placeholder="الخطة العلاجية"></textarea>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button onclick="ward.saveSoap('${id}')">حفظ</button>
        <button class="secondary" onclick="closeModal()">إلغاء</button>
      </div>
    `);
  }

  async saveSoap(id) {
    const s = document.getElementById('soapS').value.trim();
    const o = document.getElementById('soapO').value.trim();
    const a = document.getElementById('soapA').value.trim();
    const p = document.getElementById('soapP').value.trim();
    if (!s || !o || !a || !p) { showToast('⚠️ جميع الحقول مطلوبة', 'error'); return; }

    const state = stateManager.get();
    const patient = state.patients.find(pt => pt.id === id);
    if (!patient) return;

    if (!patient.soap) patient.soap = [];
    patient.soap.push({
      date: new Date().toISOString(),
      author: state.currentUser?.name || getRoleLabel(state.currentRole),
      subjective: s,
      objective: o,
      assessment: a,
      plan: p
    });
    patient.updatedAt = Date.now();

    // تحديث عبر StateManager
    await stateManager.updateItem('patients', id, { soap: patient.soap, updatedAt: patient.updatedAt });
    closeModal();
    bus.emit('render');
    showToast('✅ تم حفظ المتابعة', 'success');
  }

  showHistoryForm(id) { /* نموذج للسيرة المرضية */ }
  showExamForm(id) { /* نموذج للفحص السريري */ }
  showInvestForm(id) { /* نموذج للتحاليل */ }
  showSummaryForm(id) { /* نموذج للملخص */ }

  // ─── تحديث الفحوصات ───
  async updateVitals(id) {
    const val = prompt('أدخل الفحوصات (مثال: T:37.5 HR:130 SpO₂:96%):');
    if (val === null) return;
    await stateManager.updateItem('patients', id, { vitals: val, updatedAt: Date.now() });
    bus.emit('render');
    showToast('✅ تم تحديث الفحوصات', 'success');
  }

  async addNote(id) {
    const note = prompt('أضف ملاحظة:');
    if (!note) return;
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    p.notes = (p.notes || '') + '\n' + today() + ' ' + timeNow() + ': ' + note;
    p.updatedAt = Date.now();
    await stateManager.updateItem('patients', id, { notes: p.notes, updatedAt: p.updatedAt });
    bus.emit('render');
    showToast('📝 تم إضافة الملاحظة', 'success');
  }

  addAlert(id) {
    const message = prompt('أدخل تنبيهاً لهذا المريض:');
    if (!message) return;
    const state = stateManager.get();
    const p = state.patients.find(pt => pt.id === id);
    if (!p) return;
    stateManager.addAlert(
      `تنبيه للمريض ${p.name}`,
      message,
      'intern',
      p.assignedIntern
    );
    showToast('✅ تم إرسال التنبيه', 'success');
  }

  async dischargePatient(id) {
    if (!confirm('تأكيد خروج المريض؟')) return;
    await stateManager.updateItem('patients', id, { status: 'discharged', dischargeDate: today(), updatedAt: Date.now() });
    bus.emit('render');
    showToast(`⬆️ تم خروج المريض`, 'success');
  }
}

const ward = new WardComponent();
window.ward = ward;