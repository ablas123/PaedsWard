class TasksComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'tasks';
    this.searchQuery = '';
    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'tasks') this.render(); });
    bus.on('stateChanged', () => this.render());
    bus.on('search', (q) => { this.searchQuery = q; this.render(); });
  }

  render() {
    const state = stateManager.get();
    const role = state.currentRole;
    let pending = state.tasks.filter(t => !t.done);
    let done = state.tasks.filter(t => t.done);

    if (this.searchQuery) {
      pending = pending.filter(t => t.text.includes(this.searchQuery) || t.assignee.includes(this.searchQuery));
      done = done.filter(t => t.text.includes(this.searchQuery) || t.assignee.includes(this.searchQuery));
    }

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">📋 المهام</h2>
        ${hasPermission(role, 'create_task') ? `<button class="small" onclick="tasks.showAddForm()">➕ إضافة</button>` : ''}
      </div>
    `;

    if (!pending.length) {
      html += `<div class="empty-state"><div class="emoji">✅</div><p>${this.searchQuery ? 'لا توجد نتائج بحث' : 'لا توجد مهام معلقة'}</p></div>`;
    } else {
      pending.forEach(t => {
        const isMine = t.assignee === role || role === 'director' || role === 'specialist' || role === 'deputy';
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

  showAddForm() {
    openModal(`
      <h2>➕ إضافة مهمة جديدة</h2>
      <label>وصف المهمة *</label><input id="taskText" placeholder="مثال: مراجعة نتائج المختبر">
      <label>المسؤول</label>
      <select id="taskAssignee" class="form-input">
        <option value="director">مدير</option>
        <option value="specialist">اختصاصي</option>
        <option value="deputy">نائب</option>
        <option value="general">عمومي</option>
        <option value="intern" selected>طبيب امتياز</option>
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

  async saveTask() {
    const text = document.getElementById('taskText').value.trim();
    const assignee = document.getElementById('taskAssignee').value;
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value || today();
    const dueTime = document.getElementById('taskDueTime').value || timeNow();

    if (!text) {
      showToast('⚠️ وصف المهمة مطلوب', 'error');
      return;
    }

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

    await stateManager.addItem('tasks', newTask);
    closeModal();
    bus.emit('render');
    showToast('📋 تمت إضافة المهمة', 'success');
  }

  async toggle(id) {
    const state = stateManager.get();
    const t = state.tasks.find(task => task.id === id);
    if (!t) return;
    const done = !t.done;
    await stateManager.updateItem('tasks', id, { done, updatedAt: Date.now() });
    bus.emit('render');
    showToast(done ? '✅ تم إنجاز المهمة' : '🔄 أعيد فتح المهمة', done ? 'success' : 'warning');
  }
}

const tasks = new TasksComponent();
window.tasks = tasks;