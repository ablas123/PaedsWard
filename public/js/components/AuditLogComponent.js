// CoreWard - Audit Log Component
// System audit trail and reports

class AuditLog {
  constructor() {
    this.container = document.getElementById('appMain');
    this.bindEvents();
  }

  bindEvents() {
    EventBus.on('stateChanged', () => this.render());
    EventBus.on('search', (query) => this.handleSearch(query));
  }

  render() {
    const log = window.stateManager.getAuditLog();
    const recentLog = log.slice(0, 50); // Last 50 entries

    // Statistics
    const patients = window.stateManager.getPatients();
    const tasks = window.stateManager.getTasks();
    const handovers = window.stateManager.getHandovers();
    
    const stats = {
      totalPatients: patients.length,
      activePatients: patients.filter(p => p.status !== 'discharged').length,
      pendingTasks: tasks.filter(t => !t.completed).length,
      handoversCount: handovers.length,
      usersCount: window.stateManager.getUsers().length
    };

    this.container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalPatients}</div>
          <div class="stat-label">إجمالي المرضى</div>
        </div>
        <div class="stat-card info">
          <div class="stat-value">${stats.activePatients}</div>
          <div class="stat-label">مرضى نشطون</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${stats.pendingTasks}</div>
          <div class="stat-label">مهام معلقة</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${stats.handoversCount}</div>
          <div class="stat-label">عمليات تسليم</div>
        </div>
      </div>

      <div class="section-header">
        <div class="section-title">📝 سجل النظام (آخر 50 عملية)</div>
        <button class="btn btn-secondary" onclick="window.app.components.audit.printReport()">طباعة التقرير</button>
      </div>
      ${recentLog.length > 0 ? recentLog.map(entry => this.renderLogEntry(entry)).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">لا توجد سجلات بعد</div>
        </div>
      `}
    `;
  }

  renderLogEntry(entry) {
    const iconMap = {
      'login': '🚪',
      'add_patients': '🛏️',
      'update_patients': '✏️',
      'delete_patients': '🗑️',
      'add_tasks': '✅',
      'update_tasks': '🔄',
      'add_handovers': '📋',
      'create_user': '👤',
      'delete_user': '❌'
    };
    
    const icon = iconMap[entry.action] || 'ℹ️';
    const actionText = this.getActionText(entry.action);
    
    return `
      <div class="audit-item">
        <div class="audit-icon">${icon}</div>
        <div class="audit-content">
          <div class="audit-action">${actionText}</div>
          <div class="audit-meta">
            <span>${entry.userName} (${getRoleLabel(entry.userRole)})</span>
            <span>•</span>
            <span>${formatDateTime(entry.timestamp)}</span>
          </div>
          <div class="text-muted text-sm mt-2">${escapeHtml(entry.details)}</div>
        </div>
      </div>
    `;
  }

  getActionText(action) {
    const map = {
      'login': 'تسجيل دخول',
      'add_patients': 'إضافة مريض',
      'update_patients': 'تحديث مريض',
      'delete_patients': 'حذف مريض',
      'add_tasks': 'إضافة مهمة',
      'update_tasks': 'تحديث مهمة',
      'add_handovers': 'إضافة تسليم',
      'create_user': 'إنشاء مستخدم',
      'delete_user': 'حذف مستخدم'
    };
    return map[action] || action;
  }

  printReport() {
    const printWindow = window.open('', '_blank');
    const log = window.stateManager.getAuditLog().slice(0, 100);
    
    let html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير سجل النظام - CoreWard</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 8px; text-align: right; border-bottom: 1px solid #ddd; }
          th { background-color: #f2f2f2; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #1a73e8; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CoreWard - تقرير سجل النظام</h1>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>الوقت</th>
              <th>المستخدم</th>
              <th>الإجراء</th>
              <th>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    log.forEach(entry => {
      html += `
        <tr>
          <td>${formatDateTime(entry.timestamp)}</td>
          <td>${entry.userName} (${getRoleLabel(entry.userRole)})</td>
          <td>${this.getActionText(entry.action)}</td>
          <td>${entry.details}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  handleSearch(query) {
    if (!query) return;
    // This will be handled by the main render
  }
}