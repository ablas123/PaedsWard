// CoreWard - SBAR Handover Component
// Structured handover system

class SbarHandover {
  constructor() {
    this.container = document.getElementById('appMain');
    this.bindEvents();
  }

  bindEvents() {
    EventBus.on('stateChanged', () => this.render());
    EventBus.on('search', (query) => this.handleSearch(query));
  }

  render() {
    const handovers = window.stateManager.getHandovers();
    const sortedHandovers = handovers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    this.container.innerHTML = `
      <div class="section-header">
        <div class="section-title">📋 عمليات التسليم (${sortedHandovers.length})</div>
        ${hasPermission(window.stateManager.getCurrentUser().role, 'create_handovers') ? `
          <button class="btn btn-primary" onclick="window.app.components.handover.showCreateForm()">+ إنشاء</button>
        ` : ''}
      </div>
      ${sortedHandovers.length > 0 ? sortedHandovers.map(h => this.renderHandover(h)).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">لا توجد عمليات تسليم حالياً</div>
        </div>
      `}
    `;
  }

  renderHandover(handover) {
    const creator = window.stateManager.getUserById(handover.creatorId);
    const creatorName = creator ? creator.name : 'غير معروف';
    const acknowledged = handover.acknowledged ? 'تم التسليم' : 'لم يتم التسليم';
    const ackClass = handover.acknowledged ? 'success' : 'warning';
    
    return `
      <div class="sbar-card ${handover.urgent ? 'urgent' : ''}">
        <div class="sbar-section">
          <div class="sbar-label">👤 ${creatorName} - ${formatDateTime(handover.createdAt)}</div>
        </div>
        <div class="sbar-section">
          <div class="sbar-label">🚨 الحالة ${handover.urgent ? '(عاجل)' : ''}</div>
          <div class="sbar-text">${escapeHtml(handover.situation || '—')}</div>
        </div>
        <div class="sbar-section">
          <div class="sbar-label">📜 الخلفية</div>
          <div class="sbar-text">${escapeHtml(handover.background || '—')}</div>
        </div>
        <div class="sbar-section">
          <div class="sbar-label">🔍 التقييم</div>
          <div class="sbar-text">${escapeHtml(handover.assessment || '—')}</div>
        </div>
        <div class="sbar-section">
          <div class="sbar-label">📋 التوصيات</div>
          <div class="sbar-text">${escapeHtml(handover.recommendation || '—')}</div>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
          <div class="badge ${ackClass}">${acknowledged}</div>
          ${!handover.acknowledged ? `
            <button class="btn btn-sm btn-primary" onclick="window.app.components.handover.acknowledge('${handover.id}')">استلام</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  showCreateForm() {
    const form = `
      <div class="form-group">
        <label>الحالة (Situation)</label>
        <textarea id="sbarSituation" rows="3" required placeholder="ما الذي يحدث الآن؟"></textarea>
      </div>
      <div class="form-group">
        <label>الخلفية (Background)</label>
        <textarea id="sbarBackground" rows="3" required placeholder="المعلومات ذات الصلة بالحالة"></textarea>
      </div>
      <div class="form-group">
        <label>التقييم (Assessment)</label>
        <textarea id="sbarAssessment" rows="3" required placeholder="تحليلك للحالة"></textarea>
      </div>
      <div class="form-group">
        <label>التوصيات (Recommendation)</label>
        <textarea id="sbarRecommendation" rows="3" required placeholder="ما الذي يجب فعله؟"></textarea>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="sbarUrgent" /> عاجل (سيظهر بعلامة حمراء)
        </label>
      </div>
    `;

    window.app.showModal('إنشاء عملية تسليم جديدة', form, `
      <button class="btn btn-secondary" onclick="window.app.components.handover.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="window.app.components.handover.saveHandover()">حفظ التسليم</button>
    `);
  }

  async saveHandover() {
    try {
      const situation = document.getElementById('sbarSituation').value;
      const background = document.getElementById('sbarBackground').value;
      const assessment = document.getElementById('sbarAssessment').value;
      const recommendation = document.getElementById('sbarRecommendation').value;
      const urgent = document.getElementById('sbarUrgent').checked;

      if (!situation || !background || !assessment || !recommendation) {
        window.app.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }

      const handover = {
        situation,
        background,
        assessment,
        recommendation,
        urgent,
        acknowledged: false,
        creatorId: window.stateManager.getCurrentUser().id
      };

      await window.stateManager.addItem('handovers', handover);
      window.app.showToast('تم إنشاء عملية التسليم!', 'success');
      window.app.components.handover.closeModal();
    } catch (err) {
      console.error('Handover save error:', err);
      window.app.showToast('فشل الحفظ: ' + (err.message || ''), 'error');
    }
  }

  async acknowledge(id) {
    try {
      await window.stateManager.updateItem('handovers', id, { acknowledged: true });
      window.app.showToast('تم استلام عملية التسليم!', 'success');
    } catch (err) {
      console.error('Acknowledge error:', err);
      window.app.showToast('فشل الاستلام: ' + (err.message || ''), 'error');
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