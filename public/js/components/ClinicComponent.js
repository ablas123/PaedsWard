// ================================================================
//  مكون العيادة (Clinic)
// ================================================================
import { hasPermission } from '../core/constants.js';

class ClinicComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'clinic';
    this.searchQuery = '';

    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'clinic') this.render(); });
    bus.on('stateChanged', () => this.render());
    bus.on('search', (query) => {
      this.searchQuery = query;
      this.render();
    });
  }

  render() {
    const state = stateManager.get();
    const role = state.currentRole;
    let slots = state.clinicSlots;

    if (this.searchQuery) {
      slots = slots.filter(s =>
        s.patientName.includes(this.searchQuery) ||
        s.reason.includes(this.searchQuery)
      );
    }

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">🩺 العيادة</h2>
        ${hasPermission(role, 'manage_clinic') ? `<button class="small" onclick="clinic.showAddForm()">➕ إضافة</button>` : ''}
      </div>
    `;

    if (!slots.length) {
      html += `<div class="empty-state"><div class="emoji">📋</div><p>${this.searchQuery ? 'لا توجد نتائج بحث' : 'لا توجد مواعيد'}</p></div>`;
    } else {
      slots.forEach(s => {
        html += `
          <div class="card" style="border-right-color:${s.status === 'مكتمل' ? 'var(--success)' : 'var(--warning)'};">
            <div class="flex-between">
              <div>
                <div class="title">${s.patientName}</div>
                <div class="sub">⏰ ${s.time} · ${s.age} سنة · ${s.reason}</div>
              </div>
              <span class="status-badge ${s.status === 'مكتمل' ? 'completed' : 'waiting'}">${s.status}</span>
            </div>
            ${hasPermission(role, 'manage_clinic') ? `
              <div class="actions">
                <button class="small secondary" onclick="clinic.updateStatus('${s.id}','مكتمل')">✅ مكتمل</button>
                <button class="small danger" onclick="clinic.removeSlot('${s.id}')">🗑️</button>
              </div>
            ` : ''}
          </div>
        `;
      });
    }

    this.container.innerHTML = html;
  }

  // ─── بقية الدوال (showAddForm, saveSlot, updateStatus, removeSlot) ───
}
const clinic = new ClinicComponent();
window.clinic = clinic;