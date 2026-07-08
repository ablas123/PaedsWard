// ================================================================
//  مكون سجل التدقيق (Audit Log)
// ================================================================
import { getRoleLabel } from '../core/constants.js';

class AuditLog {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'reports';

    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'reports') this.render(); });
    bus.on('stateChanged', () => this.render());
  }

  render() {
    const state = stateManager.get();
    const logs = state.auditLog || [];

    const totalPatients = state.patients.length;
    const activePatients = state.patients.filter(p => p.status !== 'discharged').length;
    const pendingTasks = state.tasks.filter(t => !t.done).length;
    const totalHandovers = state.handovers.length;

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <h2 style="font-size:18px;margin:0;">📊 التقارير وسجل التدقيق</h2>
        <button onclick="window.print()" class="secondary small">🖨️ طباعة التقرير</button>
      </div>
      <div class="dashboard">
        <div class="stat-card primary"><div class="stat-number">${totalPatients}</div><div class="stat-label">🏥 الإجمالي</div></div>
        <div class="stat-card success"><div class="stat-number">${activePatients}</div><div class="stat-label">🩺 نشطون</div></div>
        <div class="stat-card warning"><div class="stat-number">${pendingTasks}</div><div class="stat-label">📋 مهام معلقة</div></div>
        <div class="stat-card secondary"><div class="stat-number">${totalHandovers}</div><div class="stat-label">📝 تسليمات</div></div>
      </div>
      <div class="card" style="border-right-color:var(--gray);">
        <div class="title">📜 سجل التدقيق الأمني</div>
        <div style="max-height:400px;overflow-y:auto;margin-top:8px;">
          ${logs.length === 0 ? '<div class="text-muted">لا توجد سجلات</div>' : logs.slice(-50).reverse().map(log => `
            <div style="font-size:12px;border-bottom:1px solid #e2e8f0;padding:6px 0;display:flex;flex-wrap:wrap;gap:4px;">
              <span class="text-muted">${new Date(log.timestamp).toLocaleString()}</span>
              <span class="role-tag" style="background:${log.role === 'senior' ? '#dbeafe' : log.role === 'junior' ? '#fef3c7' : log.role === 'nurse' ? '#d1fae5' : '#f3e8ff'};">${getRoleLabel(log.role)}</span>
              <span style="font-weight:600;">${log.user}</span>
              <span>${log.action}</span>
              <span style="color:var(--gray);">${log.details}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }
}

const audit = new AuditLog();
window.audit = audit;