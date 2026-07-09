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
    const critical = state.patients.filter(p => p.patientStatus === 'critical').length;
    const urgent = state.handovers.filter(h => h.urgent && !h.acknowledged).length;
    const total = state.patients.length;
    const unreadAlerts = state.alerts.filter(a => !a.read).length;

    let html = `
      <div class="dashboard">
        <div class="stat-card primary"><div class="stat-number">${active}</div><div class="stat-label">🩺 مرضى نشطون</div></div>
        <div class="stat-card warning"><div class="stat-number">${pending}</div><div class="stat-label">📋 مهام معلقة</div></div>
        <div class="stat-card danger"><div class="stat-number">${critical}</div><div class="stat-label">🚨 حالات حرجة</div></div>
        <div class="stat-card secondary"><div class="stat-number">${urgent}</div><div class="stat-label">📝 تسليم عاجل</div></div>
        <div class="stat-card success" style="grid-column: span 2;"><div class="stat-number">${total}</div><div class="stat-label">🏥 إجمالي المرضى</div></div>
        <div class="stat-card info" style="border-right-color:var(--info);grid-column:span 2;background:#f0f9ff;">
          <div class="stat-number">${unreadAlerts}</div>
          <div class="stat-label">🔔 تنبيهات غير مقروءة</div>
        </div>
      </div>
      <div class="card"><div class="title">📈 توزيع المرضى حسب الحالة</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
          ${['critical','followup','stable'].map(s => {
            const count = state.patients.filter(p => p.patientStatus === s && p.status !== 'discharged').length;
            const labels = { critical: 'حرج', followup: 'متابعة', stable: 'مستقر' };
            return `<div><span class="status-badge ${s}">${labels[s]}</span> ${count} مريض</div>`;
          }).join('')}
        </div>
      </div>
    `;
    this.container.innerHTML = html;
  }
}
const dashboard = new Dashboard();
window.dashboard = dashboard;