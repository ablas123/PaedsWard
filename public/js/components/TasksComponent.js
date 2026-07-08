// ================================================================
//  مكون المهام (Tasks)
// ================================================================
class TasksComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'tasks';
    bus.on('switchTab', (tab) => {
      if (tab === this.tab) this.render();
    });
    bus.on('render', () => {
      if (this.tab === 'tasks') this.render();
    });
    bus.on('stateChanged', () => this.render());
  }

  render() {
    const state = stateManager.get();
    const search = state.searchQuery || '';
    const pending = state.tasks.filter(t => !t.done && (t.text.includes(search) || t.assignee.includes(search)));
    const done = state.tasks.filter(t => t.done && (t.text.includes(search) || t.assignee.includes(search)));

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">📋 المهام</h2>
        ${this.hasPermission('create_task') ? `<button class="small" onclick="tasks.showAddForm()">➕ إضافة</button>` : ''}
      </div>
    `;

    if (!pending.length) {
      html += `<div class="empty-state"><div class="emoji">✅</div><p>${search ? 'لا توجد نتائج بحث' : 'لا توجد مهام معلقة'}</p></div>`;
    } else {
      pending.forEach(t => {
        const isMine = t.assignee === state.currentRole || state.currentRole === 'senior';
        const isOverdue = t.dueDate && t.dueDate < today() && !t.done;
        const isSoon = t.dueDate && t.dueDate === today() && !t.done;
        const tagClass = isOverdue ? 'overdue' : isSoon ? 'soon' : t.priority;
        const dueDisplay = t.dueDate ? (t.dueTime ? `${t.dueDate} ${t.dueTime}` : t.dueDate) : '';
        html += `
          <div class="card" style="border-right-color:${isOverdue ? 'var(--danger)' : isSoon ? 'var(--warning)' : t.priority === 'high' ? 'var(--danger)' : t.priority === 'medium' ? 'var(--warning)' : 'var(--gray)'};">
            <div class="flex-between">
              <span class="title" style="font-size:14px;">${t.text} ${isOverdue ? '⏰' : isSoon ? '🕐' : ''}</span>
              <span class="tag ${tagClass}">${isOverdue ? 'متأخرة' : isSoon ? 'مستحقة قريباً' : t.priority}</span>
            </div>
            <div class="sub">👤 ${getRoleLabel(t.assignee)} · ${t.createdAt || ''} ${dueDisplay ? '· استحقاق: ' + dueDisplay : ''}</div>
            ${isMine ? `<div class="actions"><button class="small" onclick="tasks.toggle('${t.id}')">✅ إنجاز</button></div>` : ''}
          </div>
        `;
      });
    }

    if (done.length) {
      html += `<details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:600;color:var(--gray);font-size:12px;">✅ منجزة (${done.length})</summary>`;
      done.forEach(t => {
        html += `<div class="card" style="border-right-color:var(--success);opacity:0.5;">
          <div class="flex-between"><span style="font-size:13px;">${t.text}</span><span class="done-badge">✓</span></div>
        </div>`;
      });
      html += `</details>`;
    }

    this.container.innerHTML = html;
  }

  hasPermission(perm) {
    const state = stateManager.get();
    const role = state.currentRole;
    const ROLES = {
      senior: ['view_all', 'manage_team', 'discharge', 'approve_plan', 'view_reports', 'create_task', 'view_patients'],
      junior: ['admit', 'write_notes', 'complete_tasks', 'create_handover', 'view_patients', 'update_vitals'],
      nurse: ['update_vitals', 'view_patients', 'complete_tasks'],
      admin: ['manage_clinic', 'view_patients', 'send_alerts']
    };
    return ROLES[role] && ROLES[role].includes(perm);
  }

  showAddForm() {
    openModal(`
      <h2>➕ إضافة مهمة جديدة</h2>
      <label>وصف المهمة *</label><input id="taskText" placeholder="مثال: مراجعة نتائج المختبر">
      <label>المسؤول</label>
      <select id="taskAssignee" class="form-input">
        <option value="senior">استشاري</option>
        <option value="junior">طبيب مبتدئ</option>
        <option value="nurse">ممرض</option>
      </select>
      <label>الأولوية</label>
      <select id="taskPriority" class="form-input">
        <option value="high">عالية</option>
        <option value="medium" selected>متوسطة</option>
        <option value="low">منخفضة</option>
      </select>
      <label>تاريخ الاستحقاق</label>
      <input id="taskDueDate" type="date" value="${today()}">
      <label>وقت الاستحقاق</label>
      <input id="taskDueTime" type="time" value="${timeNow()}">
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button onclick="tasks.saveTask()">حفظ</button>
        <button class="secondary" onclick="closeModal()">إلغاء</button>
      </div>
    `);
  }

  saveTask() {
    const text = document.getElementById('taskText').value.trim();
    const assignee = document.getElementById('taskAssignee').value;
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value || today();
    const dueTime = document.getElementById('taskDueTime').value || timeNow();

    if (!text) {
      showToast('⚠️ وصف المهمة مطلوب', 'error');
      return;
    }

    const state = stateManager.get();
    const newTask = {
      id: 'temp_' + uid(),
      text,
      priority,
      assignee,
      done: false,
      createdAt: today(),
      dueDate,
      dueTime,
      reminded: false,
      updatedAt: Date.now()
    };

    state.tasks.push(newTask);
    stateManager.save();
    stateManager.addToQueue('tasks', 'POST', newTask, newTask.id);

    closeModal();
    bus.emit('render');
    showToast('📋 تمت إضافة المهمة', 'success');
  }

  toggle(id) {
    const state = stateManager.get();
    const t = state.tasks.find(task => task.id === id);
    if (!t) return;
    t.done = !t.done;
    t.updatedAt = Date.now();
    stateManager.save();
    stateManager.addToQueue('tasks', 'PATCH', { done: t.done, updatedAt: t.updatedAt }, t.id);
    bus.emit('render');
    showToast(t.done ? '✅ تم إنجاز المهمة' : '🔄 أعيد فتح المهمة', t.done ? 'success' : 'warning');
  }
}

const tasks = new TasksComponent();
window.tasks = tasks;