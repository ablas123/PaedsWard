// CoreWard - Smart Alerts Component

class SmartAlerts {
  constructor() {
    this.container = document.getElementById('appMain');
    this.bindEvents();
  }

  bindEvents() {
    EventBus.on('stateChanged', () => this.render());
  }

  render() {
    const alerts = window.stateManager.getAlerts();
    const currentUser = window.stateManager.getCurrentUser();
    
    // Filter alerts for current user
    const userAlerts = alerts.filter(a => {
      if (a.targetIntern && a.targetIntern !== currentUser.id) return false;
      if (a.targetRole && a.targetRole !== currentUser.role) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const unreadCount = userAlerts.filter(a => !a.read).length;

    this.container.innerHTML = `
      <div class="section-header">
        <div class="section-title">🔔 التنبيهات (${userAlerts.length})</div>
        ${hasPermission(currentUser.role, 'add_alert') ? `
          <button class="btn btn-primary" onclick="window.app.components.alerts.showAddForm()">+ تنبيه جديد</button>
        ` : ''}
      </div>
      
      ${unreadCount > 0 ? `
        <div class="card info mb-3">
          <div class="card-body">
            <strong>📬 لديك ${unreadCount} تنبيه(ات) غير مقروءة</strong>
            <button class="btn btn-sm btn-primary" style="margin-right:10px;" onclick="window.app.components.alerts.markAllRead()">تحديد الكل كمقروء</button>
          </div>
        </div>
      ` : ''}

      ${userAlerts.length > 0 ? userAlerts.map(alert => this.renderAlert(alert)).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">🔔</div>
          <div class="empty-state-text">لا توجد تنبيهات</div>
        </div>
      `}
    `;
  }

  renderAlert(alert) {
    const readClass = alert.read ? '' : 'info';
    
    return `
      <div class="card ${readClass}">
        <div class="card-header">
          <div class="card-title">${escapeHtml(alert.title)}</div>
          <div class="badge ${alert.read ? 'badge-gray' : 'badge-primary'}">
            ${alert.read ? 'مقروء' : 'جديد'}
          </div>
        </div>
        <div class="card-body">
          <div>${escapeHtml(alert.message)}</div>
          <div class="text-muted text-sm mt-2">${formatDateTime(alert.createdAt)}</div>
        </div>
        ${!alert.read ? `
          <div class="card-footer">
            <button class="btn btn-sm btn-primary" onclick="window.app.components.alerts.markRead('${alert.id}')">تحديد كمقروء</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  showAddForm() {
    const users = window.stateManager.getUsers();
    const currentUser = window.stateManager.getCurrentUser();
    
    const roleOptions = Object.keys(ROLES).map(role => 
      `<option value="${role}">${getRoleEmoji(role)} ${getRoleLabel(role)}</option>`
    ).join('');

    const userOptions = users
      .filter(u => u.id !== currentUser.id)
      .map(u => `<option value="${u.id}">${getRoleEmoji(u.role)} ${u.name}</option>`)
      .join('');

    const form = `
      <div class="form-group">
        <label>عنوان التنبيه</label>
        <input type="text" id="alertTitle" required placeholder="مثال: حالة حرجة" />
      </div>
      <div class="form-group">
        <label>الرسالة</label>
        <textarea id="alertMessage" rows="3" required placeholder="تفاصيل التنبيه..."></textarea>
      </div>
      <div class="form-group">
        <label>إرسال إلى (اختياري)</label>
        <select id="alertTarget">
          <option value="">الكل</option>
          <optgroup label="حسب الدور">
            ${roleOptions}
          </optgroup>
          <optgroup label="حسب المستخدم">
            ${userOptions}
          </optgroup>
        </select>
      </div>
    `;

    window.app.showModal('إنشاء تنبيه جديد', form, `
      <button class="btn btn-secondary" onclick="window.app.components.alerts.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="window.app.components.alerts.saveAlert()">إرسال</button>
    `);
  }

  async saveAlert() {
    try {
      const title = document.getElementById('alertTitle').value;
      const message = document.getElementById('alertMessage').value;
      const target = document.getElementById('alertTarget').value;

      if (!title || !message) {
        window.app.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }

      let targetRole = null;
      let targetIntern = null;

      if (target) {
        if (ROLES[target]) {
          targetRole = target;
        } else {
          targetIntern = target;
        }
      }

      await window.stateManager.addAlert(title, message, targetRole, targetIntern);
      window.app.showToast('تم إرسال التنبيه!', 'success');
      window.app.components.alerts.closeModal();
    } catch (err) {
      console.error('Alert save error:', err);
      window.app.showToast('فشل الإرسال: ' + (err.message || ''), 'error');
    }
  }

  async markRead(id) {
    try {
      await window.stateManager.updateItem('alerts', id, { read: true });
      window.app.showToast('تم تحديد التنبيه كمقروء!', 'success');
    } catch (err) {
      console.error('Mark read error:', err);
      window.app.showToast('فشل التحديث: ' + (err.message || ''), 'error');
    }
  }

  async markAllRead() {
    try {
      const alerts = window.stateManager.getAlerts();
      const currentUser = window.stateManager.getCurrentUser();
      
      const unreadAlerts = alerts.filter(a => {
        if (a.read) return false;
        if (a.targetIntern && a.targetIntern !== currentUser.id) return false;
        if (a.targetRole && a.targetRole !== currentUser.role) return false;
        return true;
      });

      for (const alert of unreadAlerts) {
        await window.stateManager.updateItem('alerts', alert.id, { read: true });
      }

      window.app.showToast('تم تحديد جميع التنبيهات كمقروءة!', 'success');
    } catch (err) {
      console.error('Mark all read error:', err);
      window.app.showToast('فشل التحديث: ' + (err.message || ''), 'error');
    }
  }

  closeModal() {
    document.getElementById('modalContainer').classList.remove('active');
    setTimeout(() => document.getElementById('modalContainer').innerHTML = '', 300);
  }
}