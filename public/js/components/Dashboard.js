// CoreWard - Dashboard Component (Fixed: null check)

class Dashboard {
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
    const tasks = window.stateManager.getTasks();
    const handovers = window.stateManager.getHandovers();
    const currentUser = window.stateManager.getCurrentUser();

    const filteredPatients = this.filterPatientsByRole(patients, currentUser.role);
    const filteredTasks = this.filterTasksByRole(tasks, currentUser.role);

    const activePatients = filteredPatients.filter(p => p.status !== 'discharged').length;
    const criticalPatients = filteredPatients.filter(p => p.status === 'critical').length;
    const pendingTasks = filteredTasks.filter(t => !t.completed).length;
    const urgentHandovers = handovers.filter(h => h.urgent).length;
    const totalPatients = filteredPatients.length;

    const upcomingTasks = filteredTasks
      .filter(t => !t.completed && t.dueDate) // FIXED: Added null check
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 3);

    const statusCounts = {
      stable: filteredPatients.filter(p => p.status === 'stable').length,
      followup: filteredPatients.filter(p => p.status === 'followup').length,
      critical: filteredPatients.filter(p => p.status === 'critical').length
    };

    this.container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalPatients}</div>
          <div class="stat-label">إجمالي المرضى</div>
        </div>
        <div class="stat-card info">
          <div class="stat-value">${activePatients}</div>
          <div class="stat-label">مرضى نشطون</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">${criticalPatients}</div>
          <div class="stat-label">حالات حرجة</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${pendingTasks}</div>
          <div class="stat-label">مهام معلقة</div>
        </div>
      </div>

      <div class="section-header">
        <div class="section-title">📊 توزيع المرضى</div>
      </div>
      <div class="card">
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">مستقر (${statusCounts.stable})</div>
            <div style="background:var(--success);height:20px;border-radius:10px;width:${this.calcPercentage(statusCounts.stable, totalPatients)}%;"></div>
          </div>
          <div style="flex:1;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">تحت المراقبة (${statusCounts.followup})</div>
            <div style="background:var(--warning);height:20px;border-radius:10px;width:${this.calcPercentage(statusCounts.followup, totalPatients)}%;"></div>
          </div>
          <div style="flex:1;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">حرج (${statusCounts.critical})</div>
            <div style="background:var(--danger);height:20px;border-radius:10px;width:${this.calcPercentage(statusCounts.critical, totalPatients)}%;"></div>
          </div>
        </div>
      </div>

      ${upcomingTasks.length > 0 ? `
        <div class="section-header">
          <div class="section-title">✅ المهام القادمة</div>
        </div>
        ${upcomingTasks.map(task => this.renderTaskCard(task)).join('')}
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-text">لا توجد مهام قادمة</div>
        </div>
      `}
    `;
  }

  filterPatientsByRole(patients, role) {
    if (role === 'intern') {
      const currentUser = window.stateManager.getCurrentUser();
      return patients.filter(p => p.assignedIntern === currentUser.id);
    }
    return patients;
  }

  filterTasksByRole(tasks, role) {
    if (role === 'intern') {
      const currentUser = window.stateManager.getCurrentUser();
      return tasks.filter(t => t.assignee === currentUser.id);
    }
    return tasks;
  }

  calcPercentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  renderTaskCard(task) {
    const user = window.stateManager.getUserById(task.assignee);
    const assigneeName = user ? user.name : 'غير معروف';
    const isOverdue = isTaskOverdue(task);
    const isDueSoon = isTaskDueSoon(task);
    
    let statusClass = '';
    let statusText = '';
    if (isOverdue) {
      statusClass = 'task-overdue';
      statusText = 'متأخر';
    } else if (isDueSoon) {
      statusClass = 'task-soon';
      statusText = 'قريب';
    }

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(task.description)}</div>
          ${statusText ? `<div class="badge badge-critical">${statusText}</div>` : ''}
        </div>
        <div class="card-body">
          <div>الموعد: ${formatDateTime(task.dueDate)}</div>
          <div>المكلف: ${assigneeName}</div>
          <div>الأولوية: ${TASK_PRIORITY[task.priority]?.label || task.priority}</div>
        </div>
      </div>
    `;
  }

  handleSearch(query) {
    if (!query) return;
    const patients = window.stateManager.getPatients();
    const tasks = window.stateManager.getTasks();
    
    let results = [];
    
    patients.forEach(p => {
      if (p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.diagnosis && p.diagnosis.toLowerCase().includes(query.toLowerCase()))) {
        results.push({ type: 'patient', item: p });
      }
    });
    
    tasks.forEach(t => {
      if (t.description.toLowerCase().includes(query.toLowerCase())) {
        results.push({ type: 'task', item: t });
      }
    });
    
    if (results.length > 0) {
      window.app.showToast(`تم العثور على ${results.length} نتيجة`, 'info');
    }
  }
}