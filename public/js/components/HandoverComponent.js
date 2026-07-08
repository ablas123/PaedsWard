// ================================================================
//  مكون التسليم SBAR
// ================================================================
import { hasPermission, getRoleLabel } from '../core/constants.js';

class SbarHandover {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'handover';
    this.searchQuery = '';

    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'handover') this.render(); });
    bus.on('stateChanged', () => this.render());
    bus.on('search', (query) => {
      this.searchQuery = query;
      this.render();
    });
  }

  render() {
    const state = stateManager.get();
    const role = state.currentRole;
    let handovers = state.handovers;

    if (this.searchQuery) {
      handovers = handovers.filter(h =>
        h.situation.includes(this.searchQuery) ||
        h.background.includes(this.searchQuery) ||
        h.assessment.includes(this.searchQuery) ||
        h.recommendation.includes(this.searchQuery) ||
        (h.patientName && h.patientName.includes(this.searchQuery))
      );
    }

    const sorted = [...handovers].sort((a, b) => {
      if (a.urgent && !a.acknowledged) return -1;
      if (b.urgent && !b.acknowledged) return 1;
      return 0;
    });

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">📝 التسليم (SBAR)</h2>
        ${hasPermission(role, 'create_handover') ? `<button class="small" onclick="sbar.showCreateForm()">➕ جديد</button>` : ''}
      </div>
    `;

    if (!sorted.length) {
      html += `<div class="empty-state"><div class="emoji">📄</div><p>${this.searchQuery ? 'لا توجد نتائج بحث' : 'لا يوجد تسليم'}</p></div>`;
    } else {
      sorted.forEach(h => {
        const isUrgent = h.urgent && !h.acknowledged;
        html += `
          <div class="card" style="border-right-color:${isUrgent ? 'var(--danger)' : 'var(--primary)'};">
            <div class="flex-between">
              <span class="title" style="font-size:13px;">${h.date} · ${getRoleLabel(h.author)}</span>
              <div>
                ${isUrgent ? '<span class="urgent-badge">🚨 عاجل</span>' : ''}
                ${h.acknowledged ? '<span class="done-badge">✓ تم الاستلام</span>' : ''}
              </div>
            </div>
            ${h.patientName ? `<div class="sub">👤 المريض: ${h.patientName}</div>` : ''}
            <div style="font-size:12px;margin-top:4px;">
              <div><b>S:</b> ${h.situation}</div>
              <div><b>B:</b> ${h.background}</div>
              <div><b>A:</b> ${h.assessment}</div>
              <div><b>R:</b> ${h.recommendation}</div>
            </div>
            ${!h.acknowledged ? `<div class="actions"><button class="small" onclick="sbar.acknowledge('${h.id}')">✓ استلام</button></div>` : ''}
          </div>
        `;
      });
    }

    this.container.innerHTML = html;
  }

  // ─── بقية الدوال (showCreateForm, saveHandover, acknowledge) ───
}
const sbar = new SbarHandover();
window.sbar = sbar;