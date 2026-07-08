// ================================================================
//  مكون المهام (Tasks)
// ================================================================
import { hasPermission, getRoleLabel } from '../core/constants.js';

class TasksComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'tasks';
    this.searchQuery = '';

    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'tasks') this.render(); });
    bus.on('stateChanged', () => this.render());
    bus.on('search', (query) => {
      this.searchQuery = query;
      this.render();
    });
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
        const isMine = t.assignee === role || role === 'senior';
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

  // ─── بقية الدوال (showAddForm, saveTask, toggle) ───
  // جميعها موجودة في النسخة السابقة
}
const tasks = new TasksComponent();
window.tasks = tasks;