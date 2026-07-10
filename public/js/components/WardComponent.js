// CoreWard - Ward Component
// Patient management and ward view

class WardComponent {
  constructor() {
    this.container = document.getElementById('appMain');
    this.bindEvents();
  }

  bindEvents() {
    EventBus.on('stateChanged', () => this.render());
    EventBus.on('search', (query) => this.handleSearch(query));
  }

  render() {
    const patients = window.stateManager.getPatients();
    const currentUser = window.stateManager.getCurrentUser();
    const filteredPatients = this.filterPatientsByRole(patients, currentUser.role);

    if (filteredPatients.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛏️</div>
          <div class="empty-state-text">لا توجد مرضى حالياً</div>
          <button class="btn btn-primary" onclick="window.app.components.ward.showAdmissionForm()">
            إضافة مريض جديد
          </button>
        </div>
      `;
      return;
    }

    // Group by status
    const stable = filteredPatients.filter(p => p.status === 'stable');
    const followup = filteredPatients.filter(p => p.status === 'followup');
    const critical = filteredPatients.filter(p => p.status === 'critical');

    let html = '';

    if (critical.length > 0) {
      html += `<h3 class="section-title">🚨 الحالات الحرجة (${critical.length})</h3>`;
      html += critical.map(p => this.renderPatientCard(p)).join('');
    }

    if (followup.length > 0) {
      html += `<h3 class="section-title">👁️ تحت المراقبة (${followup.length})</h3>`;
      html += followup.map(p => this.renderPatientCard(p)).join('');
    }

    if (stable.length > 0) {
      html += `<h3 class="section-title">✅ مستقر (${stable.length})</h3>`;
      html += stable.map(p => this.renderPatientCard(p)).join('');
    }

    this.container.innerHTML = html;
  }

  filterPatientsByRole(patients, role) {
    if (role === 'intern') {
      const currentUser = window.stateManager.getCurrentUser();
      return patients.filter(p => p.assignedIntern === currentUser.id);
    }
    return patients;
  }

  renderPatientCard(patient) {
    const status = PATIENT_STATUS[patient.status] || PATIENT_STATUS.stable;
    const age = patient.age ? `${patient.age} سنة` : '—';
    const bed = patient.bed ? `سرير ${patient.bed}` : '—';
    const vitals = patient.vitals || {};
    const latestVital = vitals.hr ? `نبض: ${vitals.hr}` : '—';

    return `
      <div class="card clickable ${status.class}" onclick="window.app.components.ward.viewPatient('${patient.id}')">
        <div class="card-header">
          <div class="card-title">${escapeHtml(patient.name)}</div>
          <div class="badge ${status.class}">${status.label}</div>
        </div>
        <div class="card-body">
          <div>العمر: ${age}</div>
          <div>التشخيص: ${escapeHtml(patient.diagnosis || '—')}</div>
          <div>السرير: ${bed}</div>
          <div>العلامات الحيوية: ${latestVital}</div>
        </div>
        <div class="card-footer">
          <div>${formatDate(patient.createdAt)}</div>
          <div>${timeAgo(patient.updatedAt)}</div>
        </div>
      </div>
    `;
  }

  showAdmissionForm() {
    const step1 = `
      <div class="stepper">
        <div class="step active"><div class="step-circle">1</div><div class="step-label">المعلومات الأساسية</div></div>
        <div class="step"><div class="step-circle">2</div><div class="step-label">البيانات السريرية</div></div>
        <div class="step"><div class="step-circle">3</div><div class="step-label">التاريخ المرضي</div></div>
      </div>
      <div class="form-group">
        <label>الاسم الكامل</label>
        <input type="text" id="admitName" required placeholder="أدخل الاسم الكامل" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>العمر (سنة)</label>
          <input type="number" id="admitAge" min="0" step="0.1" required placeholder="مثال: 5.5" />
        </div>
        <div class="form-group">
          <label>الجنس</label>
          <select id="admitGender" required>
            <option value="">اختر...</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>رقم السرير</label>
        <input type="text" id="admitBed" placeholder="مثال: A12" />
      </div>
    `;

    window.app.showModal('إدخال مريض جديد - الخطوة 1', step1, `
      <button class="btn btn-secondary" onclick="window.app.components.ward.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="window.app.components.ward.nextStep()">التالي</button>
    `);
  }

  nextStep() {
    // Validate step 1
    const name = document.getElementById('admitName')?.value;
    const age = document.getElementById('admitAge')?.value;
    if (!name || !age) {
      window.app.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    const step2 = `
      <div class="stepper">
        <div class="step done"><div class="step-circle">✓</div><div class="step-label">المعلومات الأساسية</div></div>
        <div class="step active"><div class="step-circle">2</div><div class="step-label">البيانات السريرية</div></div>
        <div class="step"><div class="step-circle">3</div><div class="step-label">التاريخ المرضي</div></div>
      </div>
      <div class="form-group">
        <label>التشخيص الأولي</label>
        <input type="text" id="admitDiagnosis" required placeholder="مثال: التهاب رئوي" />
      </div>
      <div class="form-group">
        <label>الأعراض</label>
        <textarea id="admitSymptoms" rows="3" placeholder="صف الأعراض..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>النبض (نبضة/د)</label>
          <input type="number" id="admitHr" min="0" placeholder="مثال: 120" />
        </div>
        <div class="form-group">
          <label>التشبع (%)</label>
          <input type="number" id="admitSpo2" min="0" max="100" placeholder="مثال: 98" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>الحرارة (°م)</label>
          <input type="number" id="admitTemp" min="0" step="0.1" placeholder="مثال: 37.2" />
        </div>
        <div class="form-group">
          <label>التنفس (نَفَس/د)</label>
          <input type="number" id="admitRr" min="0" placeholder="مثال: 24" />
        </div>
      </div>
    `;

    window.app.showModal('إدخال مريض جديد - الخطوة 2', step2, `
      <button class="btn btn-secondary" onclick="window.app.components.ward.showAdmissionForm()">السابق</button>
      <button class="btn btn-primary" onclick="window.app.components.ward.nextStep2()">التالي</button>
    `);
  }

  nextStep2() {
    const diagnosis = document.getElementById('admitDiagnosis')?.value;
    if (!diagnosis) {
      window.app.showToast('يرجى إدخال التشخيص', 'error');
      return;
    }

    const step3 = `
      <div class="stepper">
        <div class="step done"><div class="step-circle">✓</div><div class="step-label">المعلومات الأساسية</div></div>
        <div class="step done"><div class="step-circle">✓</div><div class="step-label">البيانات السريرية</div></div>
        <div class="step active"><div class="step-circle">3</div><div class="step-label">التاريخ المرضي</div></div>
      </div>
      <div class="form-group">
        <label>الأدوية الحالية</label>
        <textarea id="admitMeds" rows="3" placeholder="أدوية المريض الحالية..."></textarea>
      </div>
      <div class="form-group">
        <label>الحساسيات</label>
        <textarea id="admitAllergies" rows="2" placeholder="حساسيات دوائية أو غذائية..."></textarea>
      </div>
      <div class="form-group">
        <label>الأمراض المزمنة</label>
        <textarea id="admitChronic" rows="2" placeholder="أمراض مزمنة مثل السكري، الربو..."></textarea>
      </div>
      <div class="form-group">
        <label>ملاحظات إضافية</label>
        <textarea id="admitNotes" rows="2" placeholder="أي ملاحظات أخرى..."></textarea>
      </div>
    `;

    window.app.showModal('إدخال مريض جديد - الخطوة 3', step3, `
      <button class="btn btn-secondary" onclick="window.app.components.ward.nextStep()">السابق</button>
      <button class="btn btn-success" onclick="window.app.components.ward.submitAdmission()">إكمال الإدخال</button>
    `);
  }

  async submitAdmission() {
    try {
      const name = document.getElementById('admitName').value;
      const age = parseFloat(document.getElementById('admitAge').value);
      const gender = document.getElementById('admitGender').value;
      const bed = document.getElementById('admitBed').value;
      const diagnosis = document.getElementById('admitDiagnosis').value;
      const symptoms = document.getElementById('admitSymptoms').value;
      const meds = document.getElementById('admitMeds').value;
      const allergies = document.getElementById('admitAllergies').value;
      const chronic = document.getElementById('admitChronic').value;
      const notes = document.getElementById('admitNotes').value;

      // Vitals
      const vitals = {};
      const hr = document.getElementById('admitHr').value;
      const spo2 = document.getElementById('admitSpo2').value;
      const temp = document.getElementById('admitTemp').value;
      const rr = document.getElementById('admitRr').value;
      
      if (hr) vitals.hr = parseInt(hr);
      if (spo2) vitals.spo2 = parseInt(spo2);
      if (temp) vitals.temp = parseFloat(temp);
      if (rr) vitals.rr = parseInt(rr);

      // Assign intern if current user is intern
      const currentUser = window.stateManager.getCurrentUser();
      const assignedIntern = currentUser.role === 'intern' ? currentUser.id : null;

      const patient = {
        name,
        age,
        gender,
        bed,
        diagnosis,
        symptoms,
        meds: meds || '',
        allergies: allergies || '',
        chronic: chronic || '',
        notes: notes || '',
        status: 'stable',
        vitals,
        assignedIntern,
        soap: []
      };

      await window.stateManager.addItem('patients', patient);
      window.app.showToast('تم إدخال المريض بنجاح!', 'success');
      window.app.components.ward.closeModal();
    } catch (err) {
      console.error('Admission error:', err);
      window.app.showToast('فشل إدخال المريض: ' + (err.message || ''), 'error');
    }
  }

  closeModal() {
    document.getElementById('modalContainer').classList.remove('active');
    setTimeout(() => document.getElementById('modalContainer').innerHTML = '', 300);
  }

  viewPatient(id) {
    const patient = window.stateManager.getPatientById(id);
    if (!patient) return;

    const status = PATIENT_STATUS[patient.status] || PATIENT_STATUS.stable;
    const age = patient.age ? `${patient.age} سنة` : '—';
    const bed = patient.bed ? `سرير ${patient.bed}` : '—';
    const vitals = patient.vitals || {};
    const assignedIntern = patient.assignedIntern ? 
      (window.stateManager.getUserById(patient.assignedIntern)?.name || 'غير معروف') : 'غير مخصص';

    let tabsHtml = `
      <div class="tabs">
        <button class="tab active" data-tab="overview">نظرة عامة</button>
        <button class="tab" data-tab="vitals">العلامات الحيوية</button>
        <button class="tab" data-tab="meds">الأدوية</button>
        <button class="tab" data-tab="notes">الملاحظات</button>
        <button class="tab" data-tab="soap">SOAP</button>
        <button class="tab" data-tab="discharge">الخروج</button>
      </div>
    `;

    let contentHtml = this.renderPatientOverview(patient);

    window.app.showModal(
      `مريض: ${escapeHtml(patient.name)}`,
      `<div class="snapshot-header">
        <div class="snapshot-name">${escapeHtml(patient.name)}</div>
        <div class="snapshot-meta">
          <span>العمر: ${age}</span>
          <span>الجنس: ${patient.gender || '—'}</span>
          <span>السرير: ${bed}</span>
          <span class="badge ${status.class}">${status.label}</span>
        </div>
      </div>
      ${tabsHtml}
      <div id="patientContent">${contentHtml}</div>`,
      `<button class="btn btn-secondary" onclick="window.app.components.ward.closeModal()">إغلاق</button>`
    );

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        let content = '';
        switch (tabId) {
          case 'overview': content = this.renderPatientOverview(patient); break;
          case 'vitals': content = this.renderPatientVitals(patient); break;
          case 'meds': content = this.renderPatientMeds(patient); break;
          case 'notes': content = this.renderPatientNotes(patient); break;
          case 'soap': content = this.renderPatientSoap(patient); break;
          case 'discharge': content = this.renderPatientDischarge(patient); break;
        }
        document.getElementById('patientContent').innerHTML = content;
      });
    });
  }

  renderPatientOverview(patient) {
    const assignedIntern = patient.assignedIntern ? 
      (window.stateManager.getUserById(patient.assignedIntern)?.name || 'غير معروف') : 'غير مخصص';
    
    return `
      <div class="card">
        <div class="card-title">معلومات أساسية</div>
        <div class="card-body">
          <div><strong>التشخيص:</strong> ${escapeHtml(patient.diagnosis || '—')}</div>
          <div><strong>الأعراض:</strong> ${escapeHtml(patient.symptoms || '—')}</div>
          <div><strong>الأدوية الحالية:</strong> ${escapeHtml(patient.meds || '—')}</div>
          <div><strong>الحساسيات:</strong> ${escapeHtml(patient.allergies || '—')}</div>
          <div><strong>الأمراض المزمنة:</strong> ${escapeHtml(patient.chronic || '—')}</div>
          <div><strong>المتدرب المخصص:</strong> ${assignedIntern}</div>
        </div>
      </div>
    `;
  }

  renderPatientVitals(patient) {
    const vitals = patient.vitals || {};
    const warnings = analyzeVitals(vitals);
    
    let vitalsHtml = '';
    Object.keys(VITALS_RANGES).forEach(key => {
      const range = VITALS_RANGES[key];
      const value = vitals[key];
      if (value !== undefined) {
        const isWarning = warnings.some(w => w.vital === key);
        vitalsHtml += `
          <div class="vital-item ${isWarning ? 'danger' : ''}">
            <div class="vital-value">${value} ${range.unit}</div>
            <div class="vital-label">${range.label}</div>
          </div>
        `;
      }
    });

    return `
      ${warnings.length > 0 ? `
        <div class="card danger">
          <div class="card-title">⚠️ تحذيرات</div>
          <div class="card-body">
            ${warnings.map(w => `<div>${w.message}</div>`).join('<br>')}
          </div>
        </div>
      ` : ''}
      <div class="vitals-grid">
        ${vitalsHtml || '<div class="empty-state" style="padding:20px;">لا توجد علامات حيوية مسجلة</div>'}
      </div>
      <button class="btn btn-primary mt-3" onclick="window.app.components.ward.updateVitals('${patient.id}')">تحديث العلامات الحيوية</button>
    `;
  }

  updateVitals(id) {
    const patient = window.stateManager.getPatientById(id);
    if (!patient) return;

    const vitals = patient.vitals || {};
    const form = `
      <div class="form-row">
        <div class="form-group">
          <label>النبض (نبضة/د)</label>
          <input type="number" id="updateHr" value="${vitals.hr || ''}" min="0" placeholder="مثال: 120" />
        </div>
        <div class="form-group">
          <label>التشبع (%)</label>
          <input type="number" id="updateSpo2" value="${vitals.spo2 || ''}" min="0" max="100" placeholder="مثال: 98" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>الحرارة (°م)</label>
          <input type="number" id="updateTemp" value="${vitals.temp || ''}" min="0" step="0.1" placeholder="مثال: 37.2" />
        </div>
        <div class="form-group">
          <label>التنفس (نَفَس/د)</label>
          <input type="number" id="updateRr" value="${vitals.rr || ''}" min="0" placeholder="مثال: 24" />
        </div>
      </div>
      <div class="form-group">
        <label>الضغط (mmHg)</label>
        <input type="text" id="updateBp" value="${vitals.bp || ''}" placeholder="مثال: 120/80" />
      </div>
    `;

    window.app.showModal('تحديث العلامات الحيوية', form, `
      <button class="btn btn-secondary" onclick="window.app.components.ward.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="window.app.components.ward.saveVitals('${id}')">حفظ</button>
    `);
  }

  async saveVitals(id) {
    try {
      const vitals = {};
      const hr = document.getElementById('updateHr').value;
      const spo2 = document.getElementById('updateSpo2').value;
      const temp = document.getElementById('updateTemp').value;
      const rr = document.getElementById('updateRr').value;
      const bp = document.getElementById('updateBp').value;
      
      if (hr) vitals.hr = parseInt(hr);
      if (spo2) vitals.spo2 = parseInt(spo2);
      if (temp) vitals.temp = parseFloat(temp);
      if (rr) vitals.rr = parseInt(rr);
      if (bp) vitals.bp = bp;

      await window.stateManager.updateItem('patients', id, { vitals });
      window.app.showToast('تم تحديث العلامات الحيوية!', 'success');
      window.app.components.ward.closeModal();
    } catch (err) {
      console.error('Vitals update error:', err);
      window.app.showToast('فشل التحديث: ' + (err.message || ''), 'error');
    }
  }

  renderPatientMeds(patient) {
    return `
      <div class="form-group">
        <label>الأدوية الحالية</label>
        <textarea id="editMeds" rows="6" placeholder="أدوية المريض الحالية...">${escapeHtml(patient.meds || '')}</textarea>
      </div>
      <button class="btn btn-primary" onclick="window.app.components.ward.saveMeds('${patient.id}')">حفظ الأدوية</button>
    `;
  }

  async saveMeds(id) {
    try {
      const meds = document.getElementById('editMeds').value;
      await window.stateManager.updateItem('patients', id, { meds });
      window.app.showToast('تم حفظ الأدوية!', 'success');
    } catch (err) {
      console.error('Meds save error:', err);
      window.app.showToast('فشل الحفظ: ' + (err.message || ''), 'error');
    }
  }

  renderPatientNotes(patient) {
    const currentUser = window.stateManager.getCurrentUser();
    const addNoteForm = hasPermission(currentUser.role, 'write_notes') ? `
      <div class="form-group mb-3">
        <label>إضافة ملاحظة جديدة</label>
        <textarea id="newNote" rows="3" placeholder="اكتب ملاحظتك هنا..."></textarea>
        <button class="btn btn-primary mt-2" onclick="window.app.components.ward.addNote('${patient.id}')">إضافة ملاحظة</button>
      </div>
    ` : '';

    const notes = patient.notes || [];
    const notesHtml = notes.length > 0 ? notes.map(note => `
      <div class="timeline-item">
        <div class="timeline-date">${formatDateTime(note.timestamp)}</div>
        <div class="timeline-content">
          <div class="timeline-author">${note.authorName || 'غير معروف'}</div>
          <div>${escapeHtml(note.text)}</div>
        </div>
      </div>
    `).join('') : '<div class="empty-state" style="padding:20px;">لا توجد ملاحظات</div>';

    return `
      ${addNoteForm}
      <div class="timeline">
        ${notesHtml}
      </div>
    `;
  }

  async addNote(id) {
    try {
      const text = document.getElementById('newNote').value;
      if (!text.trim()) {
        window.app.showToast('يرجى كتابة ملاحظة', 'error');
        return;
      }

      const currentUser = window.stateManager.getCurrentUser();
      const note = {
        text: text.trim(),
        timestamp: new Date().toISOString(),
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorRole: currentUser.role
      };

      const patient = window.stateManager.getPatientById(id);
      const notes = [...(patient.notes || []), note];
      await window.stateManager.updateItem('patients', id, { notes });
      window.app.showToast('تمت إضافة الملاحظة!', 'success');
      document.getElementById('newNote').value = '';
    } catch (err) {
      console.error('Note add error:', err);
      window.app.showToast('فشل الإضافة: ' + (err.message || ''), 'error');
    }
  }

  renderPatientSoap(patient) {
    const currentUser = window.stateManager.getCurrentUser();
    const addSoapForm = hasPermission(currentUser.role, 'write_notes') ? `
      <div class="form-group mb-3">
        <label>Subjective (شكوى المريض)</label>
        <textarea id="soapS" rows="2" placeholder="ما الذي يشعر به المريض؟"></textarea>
      </div>
      <div class="form-group mb-3">
        <label>Objective (الملاحظات الموضوعية)</label>
        <textarea id="soapO" rows="2" placeholder="العلامات الحيوية، الفحص السريري..."></textarea>
      </div>
      <div class="form-group mb-3">
        <label>Assessment (التقييم)</label>
        <textarea id="soapA" rows="2" placeholder="تحليل الحالة والتشخيص"></textarea>
      </div>
      <div class="form-group mb-3">
        <label>Plan (الخطة)</label>
        <textarea id="soapP" rows="2" placeholder="الإجراءات التالية، الأدوية..."></textarea>
      </div>
      <button class="btn btn-primary" onclick="window.app.components.ward.addSoap('${patient.id}')">حفظ SOAP</button>
    ` : '';

    const soapEntries = patient.soap || [];
    const soapHtml = soapEntries.length > 0 ? soapEntries.map(entry => `
      <div class="card mb-3">
        <div class="card-header">
          <div class="card-title">SOAP - ${formatDateTime(entry.timestamp)}</div>
          <div class="card-subtitle">${entry.authorName || 'غير معروف'}</div>
        </div>
        <div class="card-body">
          <div><strong>S:</strong> ${escapeHtml(entry.S || '—')}</div>
          <div><strong>O:</strong> ${escapeHtml(entry.O || '—')}</div>
          <div><strong>A:</strong> ${escapeHtml(entry.A || '—')}</div>
          <div><strong>P:</strong> ${escapeHtml(entry.P || '—')}</div>
        </div>
      </div>
    `).reverse().join('') : '<div class="empty-state" style="padding:20px;">لا توجد سجلات SOAP</div>';

    return `
      ${addSoapForm}
      ${soapHtml}
    `;
  }

  async addSoap(id) {
    try {
      const S = document.getElementById('soapS').value;
      const O = document.getElementById('soapO').value;
      const A = document.getElementById('soapA').value;
      const P = document.getElementById('soapP').value;
      
      if (!S && !O && !A && !P) {
        window.app.showToast('يرجى ملء أحد الحقول', 'error');
        return;
      }

      const currentUser = window.stateManager.getCurrentUser();
      const entry = {
        S: S.trim(),
        O: O.trim(),
        A: A.trim(),
        P: P.trim(),
        timestamp: new Date().toISOString(),
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorRole: currentUser.role
      };

      const patient = window.stateManager.getPatientById(id);
      const soap = [...(patient.soap || []), entry];
      await window.stateManager.updateItem('patients', id, { soap });
      window.app.showToast('تم حفظ SOAP!', 'success');
      
      // Clear form
      document.getElementById('soapS').value = '';
      document.getElementById('soapO').value = '';
      document.getElementById('soapA').value = '';
      document.getElementById('soapP').value = '';
    } catch (err) {
      console.error('SOAP add error:', err);
      window.app.showToast('فشل الحفظ: ' + (err.message || ''), 'error');
    }
  }

  renderPatientDischarge(patient) {
    if (patient.status === 'discharged') {
      return `
        <div class="card success">
          <div class="card-title">✅ تم خروج المريض</div>
          <div class="card-body">
            تم خروج هذا المريض في ${formatDateTime(patient.dischargeDate)}
          </div>
        </div>
      `;
    }

    const checklist = DISCHARGE_CHECKLIST.map((item, idx) => `
      <li class="checklist-item">
        <input type="checkbox" id="check${idx}" />
        <label for="check${idx}">${item}</label>
      </li>
    `).join('');

    return `
      <div class="card warning">
        <div class="card-title">📋 قائمة التحقق من الخروج</div>
        <div class="card-body">
          <p>يرجى التأكد من إكمال جميع البنود قبل خروج المريض:</p>
          <ul class="checklist">
            ${checklist}
          </ul>
          <button class="btn btn-danger mt-3" onclick="window.app.components.ward.confirmDischarge('${patient.id}')">تأكيد الخروج</button>
        </div>
      </div>
    `;
  }

  async confirmDischarge(id) {
    // Check if all checkboxes are checked
    const checkboxes = document.querySelectorAll('#patientContent input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    if (!allChecked) {
      window.app.showToast('يرجى التحقق من جميع البنود قبل الخروج', 'error');
      return;
    }

    if (!confirm('هل أنت متأكد من خروج المريض؟')) return;

    try {
      await window.stateManager.updateItem('patients', id, {
        status: 'discharged',
        dischargeDate: new Date().toISOString()
      });
      window.app.showToast('تم خروج المريض بنجاح!', 'success');
      window.app.components.ward.closeModal();
    } catch (err) {
      console.error('Discharge error:', err);
      window.app.showToast('فشل الخروج: ' + (err.message || ''), 'error');
    }
  }

  handleSearch(query) {
    if (!query) return;
    // This will be handled by the main render
  }
}