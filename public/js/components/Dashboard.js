// ================================================================
//  مكون لوحة التحكم (Dashboard)
// ================================================================
import { getRoleLabel } from '../core/constants.js';

class Dashboard {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'dashboard';

    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'dashboard') this.render(); });
    bus.on('stateChanged', () => this.render());
  }

  render() {
    const state = stateManager.get();
    const active = state.patients.filter(p => p.status !== 'discharged').length;
    const pending = state.tasks.filter(t => !t.done).length;
    const critical = state.patients.filter(p => p.workflowStage === 3 && p.status === 'admitted').length;
    const urgent = state.handovers.filter(h => h.urgent && !h.acknowledged).length;
    const total = state.patients.length;

    let html = `
      <div class="dashboard">
        <div class="stat-card primary">
          <div class="stat-number">${active}</div>
          <div class="stat-label">🩺 مرضى نشطون</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-number">${pending}</div>
          <div class="stat-label">📋 مهام معلقة</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-number">${critical}</div>
          <div class="stat-label">🚨 حالات حرجة</div>
        </div>
        <div class="stat-card secondary">
          <div class="stat-number">${urgent}</div>
          <div class="stat-label">📝 تسليم عاجل</div>
        </div>
        <div class="stat-card success" style="grid-column: span 2;">
          <div class="stat-number">${total}</div>
          <div class="stat-label">🏥 إجمالي المرضى</div>
        </div>
      </div>
      <div class="card">
        <div class="title">📈 توزيع المرضى حسب المرحلة</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
          ${['الاستقبال','الخطة','التنفيذ','الخروج'].map((s,i) => {
            const count = state.patients.filter(p => p.workflowStage === i+1 && p.status !== 'discharged').length;
            return `<div><span class="status-badge stage${i+1}">${s}</span> ${count} مريض</div>`;
          }).join('')}
        </div>
      </div>
      <div class="card">
        <div class="title">📋 آخر المهام</div>
        ${state.tasks.filter(t => !t.done).slice(0, 3).map(t =>
          `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid #e2e8f0;">${t.text} (${getRoleLabel(t.assignee)})</div>`
        ).join('') || '<div class="text-muted">لا توجد مهام معلقة</div>'}
      </div>
    `;

    this.container.innerHTML = html;
  }
}

const dashboard = new Dashboard();
window.dashboard = dashboard;