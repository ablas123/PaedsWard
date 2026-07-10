// CoreWard - Tasks Component
// Task management system

class TasksComponent {
  constructor() {
    this.container = document.getElementById('appMain');
    this.bindEvents();
  }

  bindEvents() {
    EventBus.on('stateChanged', () => this.render());
    EventBus.on('search', (query) => this.handleSearch(query));
  }

  render() {
    const tasks = window.stateManager.getTasks();
    const currentUser = window.stateManager.getCurrentUser();
    const filteredTasks = this.filterTasksByRole(tasks, currentUser.role);

    if (filteredTasks.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-text">لا توجد مهام حالياً</div>
          <button class="btn btn-primary" onclick="window.app.components.tasks.showAddForm()">
            إنشاء مهمة جديدة
          </button>
        </div>
      `;
      return;
    }

    // Sort tasks: overdue first, then by due date
    const sortedTasks = filteredTasks.sort((a, b) => {
      const aOverdue = isTaskOverdue(a);
      const bOverdue = isTaskOverdue(b);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return new Date(a.dueDate || '9999') - new Date(b.dueDate || '9999');
    });

    this.container.innerHTML = sortedTasks.map(task => this.renderTaskItem(task)).join('');
  }

  filterTasksByRole(tasks, role) {
    if (role === 'intern') {
      const currentUser = window.stateManager.getCurrentUser();
      return tasks.filter(t => t.assignee === currentUser.id);
    }
    return tasks;
  }

  renderTaskItem(task) {
    const user = window.stateManager.getUserById(task.assignee);
    const assigneeName = user ? user.name : 'غير معروف';
    const priority = TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium;
    const isOverdue = isTaskOverdue(task);
    const isDueSoon = isTaskDueSoon(task);
    const completedClass = task.completed ? 'completed' : '';
    
    let statusText = '';
    if (isOverdue) statusText = '⏰ متأخر';
    else if (isDueSoon) statusText = '🕐 قريب';

    return `
      <div class="task-item ${priority.label.toLowerCase()} ${completedClass}">
        <div class="task-check ${task.completed ? 'checked' : ''}" onclick="window.app.components.tasks.toggleTask('${task.id}', ${!task.completed})">
          ${task.completed ? '✓' : ''}
        </div>
        <div class="task-content">
          <div class="task-text">${escapeHtml(task.description)}</div>
          <div class="task-meta">
            <span>الموعد: ${formatDateTime(task.dueDate)}</span>
            <span>المكلف: ${assigneeName}</span>
            <span class="badge" style="background:${priority.color};color:white;">${priority.label}</span>
            ${statusText ? `<span class="${isOverdue ? 'task-overdue' : 'task-soon'}">${statusText}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  showAddForm() {
    const users = window.stateManager.getUsers();
    const currentUser = window.stateManager.getCurrentUser();
    
    // Filter assignable users based on role
    let assignableUsers = users;
    if (currentUser.role === 'intern') {
      // Interns can only assign to themselves
      assignableUsers = [currentUser];
    } else if (['general', 'specialist', 'deputy'].includes(currentUser.role)) {
      // Can assign to interns and themselves
      assignableUsers = users.filter(u => u.role === 'intern' || u.id === currentUser.id);
    }
    // Directors can assign to anyone

    const userOptions = assignableUsers.map(u => 
      `<option value="${u.id}">${getRoleEmoji(u.role)} ${u.name}</option>`
    ).join('');

    const form = `
      <div class="form-group">
        <label>وصف المهمة</label>
        <input type="text" id="taskDesc" required placeholder="مثال: مراجعة تحليل الدم" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>المكلف</label>
          <select id="taskAssignee" required>
            <option value="">اختر...</option>
            ${userOptions}
          </select>
        </div>
        <div class="form-group">
          <label>الأولوية</label>
          <select id="taskPriority" required>
            <option value="high">🔴 عالية</option>
            <option value="medium" selected>🟡 متوسطة</option>
            <option value="low">🟢 منخفضة</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>تاريخ التنفيذ</label>
          <input type="date" id="taskDueDate" required />
        </div>
        <div class="form-group">
          <label>وقت التنفيذ</label>
          <input type="time" id="taskDueTime" />
        </div>
      </div>
    `;

    window.app.showModal('إنشاء مهمة جديدة', form, `
      <button class="btn btn-secondary" onclick="window.app.components.tasks.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="window.app.components.tasks.saveTask()">حفظ المهمة</button>
    `);

    // Set default date to today
    document.getElementById('taskDueDate').valueAsDate = new Date();
  }

  async saveTask() {
    try {
      const description = document.getElementById('taskDesc').value;
      const assignee = document.getElementById('taskAssignee').value;
      const priority = document.getElementById('taskPriority').value;
      const dueDate = document.getElementById('taskDueDate').value;
      const dueTime = document.getElementById('taskDueTime').value;

      if (!description || !assignee || !priority || !dueDate) {
        window.app.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }

      const task = {
        description,
        assignee,
        priority,
        dueDate,
        dueTime: dueTime || null,
        completed: false
      };

      await window.stateManager.addItem('tasks', task);
      window.app.showToast('تم إنشاء المهمة بنجاح!', 'success');
      window.app.components.tasks.closeModal();
    } catch (err) {
      console.error('Task save error:', err);
      window.app.showToast('فشل الحفظ: ' + (err.message || ''), 'error');
    }
  }

  async toggleTask(id, completed) {
    try {
      await window.stateManager.updateItem('tasks', id, { completed });
      // Auto-refresh
    } catch (err) {
      console.error('Task toggle error:', err);
      window.app.showToast('فشل التحديث: ' + (err.message || ''), 'error');
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