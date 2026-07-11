// CoreWard - Dashboard Component (Enhanced)

(function() {
  'use strict';
  
  console.log('[CoreWard] 📦 Dashboard.js loading...');

  class Dashboard {
    constructor() {
      console.log('[CoreWard] 🔧 Dashboard constructor');
      this.container = document.getElementById('appMain');
      if (!this.container) {
        console.error('[CoreWard] ❌ appMain container not found!');
        return;
      }
      this.bindEvents();
      console.log('[CoreWard] ✅ Dashboard initialized');
    }

    bindEvents() {
      var self = this;
      EventBus.on('stateChanged', function() { self.render(); });
      EventBus.on('search', function(query) { self.handleSearch(query); });
    }

    render() {
      console.log('[CoreWard] 🎨 Dashboard rendering...');
      
      if (!this.container) {
        console.error('[CoreWard] ❌ Dashboard container not found');
        return;
      }

      try {
        var patients = window.stateManager.getPatients();
        var tasks = window.stateManager.getTasks();
        var handovers = window.stateManager.getHandovers();
        var currentUser = window.stateManager.getCurrentUser();

        console.log('[CoreWard] 📊 Data:', {
          patients: patients.length,
          tasks: tasks.length,
          handovers: handovers.length
        });

        var filteredPatients = this.filterPatientsByRole(patients, currentUser.role);
        var filteredTasks = this.filterTasksByRole(tasks, currentUser.role);

        var activePatients = filteredPatients.filter(function(p) { return p.status !== 'discharged'; }).length;
        var criticalPatients = filteredPatients.filter(function(p) { return p.status === 'critical'; }).length;
        var pendingTasks = filteredTasks.filter(function(t) { return !t.completed; }).length;
        var urgentHandovers = handovers.filter(function(h) { return h.urgent; }).length;
        var totalPatients = filteredPatients.length;

        var upcomingTasks = filteredTasks
          .filter(function(t) { return !t.completed && t.dueDate; })
          .sort(function(a, b) { return new Date(a.dueDate) - new Date(b.dueDate); })
          .slice(0, 3);

        var statusCounts = {
          stable: filteredPatients.filter(function(p) { return p.status === 'stable'; }).length,
          followup: filteredPatients.filter(function(p) { return p.status === 'followup'; }).length,
          critical: filteredPatients.filter(function(p) { return p.status === 'critical'; }).length
        };

        var html = '<div class="stats-grid">' +
          '<div class="stat-card"><div class="stat-value">' + totalPatients + '</div><div class="stat-label">إجمالي المرضى</div></div>' +
          '<div class="stat-card info"><div class="stat-value">' + activePatients + '</div><div class="stat-label">مرضى نشطون</div></div>' +
          '<div class="stat-card danger"><div class="stat-value">' + criticalPatients + '</div><div class="stat-label">حالات حرجة</div></div>' +
          '<div class="stat-card warning"><div class="stat-value">' + pendingTasks + '</div><div class="stat-label">مهام معلقة</div></div>' +
          '</div>';

        html += '<div class="section-header"><div class="section-title">📈 توزيع المرضى</div></div>' +
          '<div class="card"><div style="display:flex;gap:10px;">' +
          '<div style="flex:1;"><div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">مستقر (' + statusCounts.stable + ')</div>' +
          '<div style="background:var(--success);height:20px;border-radius:10px;width:' + this.calcPercentage(statusCounts.stable, totalPatients) + '%;"></div></div>' +
          '<div style="flex:1;"><div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">تحت المراقبة (' + statusCounts.followup + ')</div>' +
          '<div style="background:var(--warning);height:20px;border-radius:10px;width:' + this.calcPercentage(statusCounts.followup, totalPatients) + '%;"></div></div>' +
          '<div style="flex:1;"><div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">حرج (' + statusCounts.critical + ')</div>' +
          '<div style="background:var(--danger);height:20px;border-radius:10px;width:' + this.calcPercentage(statusCounts.critical, totalPatients) + '%;"></div></div>' +
          '</div></div>';

        if (upcomingTasks.length > 0) {
          html += '<div class="section-header"><div class="section-title">✅ المهام القادمة</div></div>';
          html += upcomingTasks.map(function(task) { return this.renderTaskCard(task); }.bind(this)).join('');
        } else {
          html += '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">لا توجد مهام قادمة</div></div>';
        }

        this.container.innerHTML = html;
        console.log('[CoreWard] ✅ Dashboard rendered');
      } catch (err) {
        console.error('[CoreWard] ❌ Dashboard render error:', err);
        this.container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">خطأ في عرض البيانات</div></div>';
      }
    }

    filterPatientsByRole(patients, role) {
      if (role === 'intern') {
        var currentUser = window.stateManager.getCurrentUser();
        return patients.filter(function(p) { return p.assignedIntern === currentUser.id; });
      }
      return patients;
    }

    filterTasksByRole(tasks, role) {
      if (role === 'intern') {
        var currentUser = window.stateManager.getCurrentUser();
        return tasks.filter(function(t) { return t.assignee === currentUser.id; });
      }
      return tasks;
    }

    calcPercentage(value, total) {
      if (total === 0) return 0;
      return Math.round((value / total) * 100);
    }

    renderTaskCard(task) {
      var user = window.stateManager.getUserById(task.assignee);
      var assigneeName = user ? user.name : 'غير معروف';
      var isOverdue = isTaskOverdue(task);
      var isDueSoon = isTaskDueSoon(task);

      var statusClass = '';
      var statusText = '';
      if (isOverdue) {
        statusClass = 'task-overdue';
        statusText = 'متأخر';
      } else if (isDueSoon) {
        statusClass = 'task-soon';
        statusText = 'قريب';
      }

      return '<div class="card">' +
        '<div class="card-header">' +
        '<div class="card-title">' + escapeHtml(task.description) + '</div>' +
        (statusText ? '<div class="badge badge-critical">' + statusText + '</div>' : '') +
        '</div>' +
        '<div class="card-body">' +
        '<div>الموعد: ' + formatDateTime(task.dueDate) + '</div>' +
        '<div>المكلف: ' + assigneeName + '</div>' +
        '<div>الأولوية: ' + (TASK_PRIORITY[task.priority] ? TASK_PRIORITY[task.priority].label : task.priority) + '</div>' +
        '</div></div>';
    }

    handleSearch(query) {
      if (!query) return;
      console.log('[CoreWard] 🔍 Dashboard search:', query);
    }
  }

  window.Dashboard = Dashboard;
  console.log('[CoreWard] ✅ Dashboard class registered');
})();