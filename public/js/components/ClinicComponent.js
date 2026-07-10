// CoreWard - Clinic Component
// Appointment management for clinic

class ClinicComponent {
  constructor() {
    this.container = document.getElementById('appMain');
    this.bindEvents();
  }

  bindEvents() {
    EventBus.on('stateChanged', () => this.render());
    EventBus.on('search', (query) => this.handleSearch(query));
  }

  render() {
    const slots = window.stateManager.getClinicSlots();
    const sortedSlots = slots.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    if (sortedSlots.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏥</div>
          <div class="empty-state-text">لا توجد مواعيد حالياً</div>
          ${hasPermission(window.stateManager.getCurrentUser().role, 'manage_clinic') ? `
            <button class="btn btn-primary" onclick="window.app.components.clinic.showAddForm()">
              إضافة موعد جديد
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="section-header">
        <div class="section-title">📋 المواعيد القادمة</div>
        ${hasPermission(window.stateManager.getCurrentUser().role, 'manage_clinic') ? `
          <button class="btn btn-primary" onclick="window.app.components.clinic.showAddForm()">+ إضافة</button>
        ` : ''}
      </div>
      ${sortedSlots.map(slot => this.renderSlot(slot)).join('')}
    `;
  }

  renderSlot(slot) {
    const age = slot.age ? `${slot.age} سنة` : '—';
    const statusClass = slot.status === 'completed' ? 'success' : 'warning';
    const statusLabel = slot.status === 'completed' ? 'مكتمل' : 'بانتظار';

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(slot.patientName)}</div>
          <div class="badge ${statusClass}">${statusLabel}</div>
        </div>
        <div class="card-body">
          <div>العمر: ${age}</div>
          <div>السبب: ${escapeHtml(slot.reason || '—')}</div>
          <div>الموعد: ${formatDateTime(slot.dateTime)}</div>
        </div>
        <div class="card-footer">
          ${hasPermission(window.stateManager.getCurrentUser().role, 'manage_clinic') ? `
            <button class="btn btn-sm btn-ghost" onclick="window.app.components.clinic.updateStatus('${slot.id}', '${slot.status === 'waiting' ? 'completed' : 'waiting'}')">
              ${slot.status === 'waiting' ? 'تم' : 'إعادة'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="window.app.components.clinic.removeSlot('${slot.id}')">حذف</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  showAddForm() {
    const form = `
      <div class="form-row">
        <div class="form-group">
          <label>اسم المريض</label>
          <input type="text" id="slotName" required placeholder="أدخل الاسم الكامل" />
        </div>
        <div class="form-group">
          <label>العمر (سنة)</label>
          <input type="number" id="slotAge" min="0" step="0.1" required placeholder="مثال: 5.5" />
        </div>
      </div>
      <div class="form-group">
        <label>سبب الزيارة</label>
        <input type="text" id="slotReason" required placeholder="مثال: متابعة الربو" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>التاريخ</label>
          <input type="date" id="slotDate" required />
        </div>
        <div class="form-group">
          <label>الوقت</label>
          <input type="time" id="slotTime" required />
        </div>
      </div>
    `;

    window.app.showModal('إضافة موعد جديد', form, `
      <button class="btn btn-secondary" onclick="window.app.components.clinic.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="window.app.components.clinic.saveSlot()">حفظ الموعد</button>
    `);

    // Set default to next hour
    const now = new Date();
    now.setHours(now.getHours() + 1);
    document.getElementById('slotDate').valueAsDate = now;
    document.getElementById('slotTime').value = now.toTimeString().slice(0, 5);
  }

  async saveSlot() {
    try {
      const patientName = document.getElementById('slotName').value;
      const age = parseFloat(document.getElementById('slotAge').value);
      const reason = document.getElementById('slotReason').value;
      const date = document.getElementById('slotDate').value;
      const time = document.getElementById('slotTime').value;

      if (!patientName || !age || !reason || !date || !time) {
        window.app.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }

      const dateTime = new Date(`${date}T${time}`).toISOString();

      const slot = {
        patientName,
        age,
        reason,
        dateTime,
        status: 'waiting'
      };

      await window.stateManager.addItem('clinicSlots', slot);
      window.app.showToast('تم إضافة الموعد بنجاح!', 'success');
      window.app.components.clinic.closeModal();
    } catch (err) {
      console.error('Slot save error:', err);
      window.app.showToast('فشل الحفظ: ' + (err.message || ''), 'error');
    }
  }

  async updateStatus(id, status) {
    try {
      await window.stateManager.updateItem('clinicSlots', id, { status });
      window.app.showToast(`تم تغيير الحالة إلى ${status === 'completed' ? 'مكتمل' : 'بانتظار'}!`, 'success');
    } catch (err) {
      console.error('Status update error:', err);
      window.app.showToast('فشل التحديث: ' + (err.message || ''), 'error');
    }
  }

  async removeSlot(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الموعد؟')) return;

    try {
      await window.stateManager.deleteItem('clinicSlots', id);
      window.app.showToast('تم حذف الموعد!', 'success');
    } catch (err) {
      console.error('Slot delete error:', err);
      window.app.showToast('فشل الحذف: ' + (err.message || ''), 'error');
    }
  }

  closeModal() {
    document.getElementById('modalContainer').classList.remove('active');
    setTimeout(() => document.getElementById('modalContainer').innerHTML = '', 300);
  }

  handleSearch(query) {
    if (!query) return;
    // This will be handled by the main render
  }
}