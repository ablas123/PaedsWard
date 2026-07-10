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
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${userAlerts.length}</div>
          <div class="stat-label">إجمالي التنبيهات</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${unreadCount}</div>
          <div class="stat-label">غير مقروءة</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${userAlerts.length - unreadCount}</div>
          <div class="stat-label">مقروءة</div>
        </div>
        <div class="stat-card info">
          <div class="stat-value">${alerts.filter(a => !a.targetIntern && !a.targetRole).length}</div>
          <div class="stat-label">عامة</div>
        </div>
      </div>

      <div class="section-header">
        <div class="section-title">🔔 التنبيهات</div>
        <div class="flex gap-2">
          ${unreadCount > 0 ? `
            <button class="btn btn-sm btn-secondary" onclick="window.app.components.alerts.markAllRead()">✓ تحديد الكل كمقروء</button>
          ` : ''}
          ${hasPermission(currentUser.role, 'add_alert') ? `
            <button class="btn btn-sm btn-primary" onclick="window.app.components.alerts.showAddForm()">+ تنبيه جديد</button>
          ` : ''}
        </div>
      </div>

      ${userAlerts.length > 0 ? userAlerts.map(alert => this.renderAlert(alert)).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">🔔</div>
          <div class="empty-state-text">لا توجد تنبيهات</div>
        </div>
      `}
    `;
  }

  renderAlert(alert) {
    const isUrgent = alert.title && (alert.title.includes('🚨') || alert.title.includes('⏰'));
    const cardClass = alert.read ? '' : (isUrgent ? 'critical' : 'info');
    
    return `
      <div class="card ${cardClass}">
        <div class="card-header">
          <div class="card-title">${escapeHtml(alert.title)}</div>
          <div class="badge ${alert.read ? 'badge-gray' : 'badge-primary'}">
            ${alert.read ? '✓ مقروء' : '● جديد'}
          </div>
        </div>
        <div class="card-body">
          <div>${escapeHtml(alert.message)}</div>
          <div class="text-muted text-sm mt-2">
            ${formatDateTime(alert.createdAt)} • ${timeAgo(alert.createdAt)}
          </div>
        </div>
        ${!alert.read ? `
          <div class="card-footer">
            <button class="btn btn-sm btn-primary" onclick="window.app.components.alerts.markRead('${alert.id}')">✓ تحديد كمقروء</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  showAddForm() {
    const users = window.stateManager.getUsers();
    const currentUser = window.stateManager.getCurrentUser();
    
    const roleOptions = Object.keys(ROLES)
      .filter(r => r !== currentUser.role)
      .map(role => `<option value="role:${role}">${getRoleEmoji(role)} جميع ${getRoleLabel(role)}</option>`)
      .join('');

    const userOptions = users
      .filter(u => u.id !== currentUser.id)
      .map(u => `<option value="user:${u.id}">${getRoleEmoji(u.role)} ${u.name}</option>`)
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
        <label>إرسال إلى</label>
        <select id="alertTarget">
          <option value="all">📢 الجميع</option>
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
      const title = document.getElementById('alertTitle').value.trim();
      const message = document.getElementById('alertMessage').value.trim();
      const target = document.getElementById('alertTarget').value;

      if (!title || !message) {
        window.app.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }

      let targetRole = null;
      let targetIntern = null;

      if (target.startsWith('role:')) {
        targetRole = target.substring(5);
      } else if (target.startsWith('user:')) {
        targetIntern = target.substring(5);
      }
      // 'all' means both null

      await window.stateManager.addAlert(title, message, targetRole, targetIntern);
      window.app.showToast('تم إرسال التنبيه!', 'success');
      this.closeModal();
    } catch (err) {
      console.error('Alert save error:', err);
      window.app.showToast('فشل الإرسال: ' + (err.message || ''), 'error');
    }
  }

  async markRead(id) {
    try {
      await window.stateManager.updateItem('alerts', id, { read: true });
      window.app.showToast('تم تحديد التنبيه كمقروء!', 'success');
      // Re-render to update badge
      window.app.renderTabs();
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

      window.app.showToast(`تم تحديد ${unreadAlerts.length} تنبيه(ات) كمقروءة!`, 'success');
      window.app.renderTabs();
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