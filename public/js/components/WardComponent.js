// ================================================================
//  مكون الجناح (Ward) – مع سير العمل وإدارة المرضى
// ================================================================
import { hasPermission, getRoleLabel } from '../core/constants.js';

class WardComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'ward';
    this.searchQuery = '';
    this.pageSize = 10;
    this.currentPage = 0;

    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'ward') this.render(); });
    bus.on('stateChanged', () => this.render());
    bus.on('search', (query) => {
      this.searchQuery = query;
      this.currentPage = 0;
      this.render();
    });
  }

  render() {
    const state = stateManager.get();
    const role = state.currentRole;
    let active = state.patients.filter(p => p.status !== 'discharged');
    const discharged = state.patients.filter(p => p.status === 'discharged');

    // تطبيق البحث
    if (this.searchQuery) {
      active = active.filter(p =>
        p.name.includes(this.searchQuery) ||
        p.diagnosis.includes(this.searchQuery) ||
        p.bed.includes(this.searchQuery)
      );
    }

    // Pagination
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = active.slice(start, end);

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">🏥 الجناح</h2>
        ${hasPermission(role, 'admit') ? `<button class="small" onclick="ward.showAdmissionWizard()">➕ قبول</button>` : ''}
      </div>
      <div class="text-muted text-sm">👥 ${active.length} مريض نشط · ${discharged.length} مكتمل</div>
    `;

    if (!active.length) {
      html += `<div class="empty-state"><div class="emoji">🛏️</div><p>${this.searchQuery ? 'لا توجد نتائج بحث' : 'لا يوجد مرضى نشطين'}</p></div>`;
    } else {
      pageItems.forEach(p => {
        const stage = p.workflowStage || 1;
        const stageLabels = ['الاستقبال', 'الخطة', 'التنفيذ', 'الخروج'];
        const stageClass = `stage${stage}`;
        const borderColor = stage === 3 ? 'var(--danger)' : stage === 2 ? 'var(--warning)' : 'var(--primary)';
        html += `
          <div class="card clickable" onclick="ward.viewPatient('${p.id}')" style="border-right-color:${borderColor};">
            <div class="flex-between">
              <div>
                <div class="title">${p.name} <span class="text-muted text-sm">(${p.age}س)</span></div>
                <div class="sub">${p.diagnosis} · سرير ${p.bed}</div>
              </div>
              <span class="status-badge ${stageClass}">${stageLabels[stage-1]}</span>
            </div>
            <div class="meta">
              <span>⚖️ ${p.weight}كجم</span>
              <span>🩺 ${p.vitals || '—'}</span>
            </div>
            <div class="actions">
              ${hasPermission(role, 'update_vitals') ? `<button class="small secondary" onclick="event.stopPropagation();ward.updateVitals('${p.id}')">📊 فحوصات</button>` : ''}
              ${hasPermission(role, 'write_notes') ? `<button class="small secondary" onclick="event.stopPropagation();ward.addNote('${p.id}')">📝 ملاحظة</button>` : ''}
              ${hasPermission(role, 'approve_plan') && stage < 4 ? `<button class="small secondary" onclick="event.stopPropagation();ward.advanceStage('${p.id}')">➡️ تقدم</button>` : ''}
              ${hasPermission(role, 'discharge') ? `<button class="small danger" onclick="event.stopPropagation();ward.dischargePatient('${p.id}')">⬆️ خروج</button>` : ''}
            </div>
          </div>
        `;
      });

      // زر تحميل المزيد
      if (end < active.length) {
        html += `<button onclick="ward.loadMore()" class="block secondary small" style="margin-top:4px;">📥 تحميل المزيد (${active.length - end} متبقي)</button>`;
      }
    }

    if (discharged.length) {
      html += `<details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:600;color:var(--gray);font-size:12px;">✅ مكتمل (${discharged.length})</summary>`;
      discharged.forEach(p => {
        html += `<div class="card" style="border-right-color:var(--gray);opacity:0.6;">
          <div class="flex-between"><span class="title" style="font-size:13px;">${p.name}</span><span class="status-badge discharged">مكتمل</span></div>
          <div class="sub">${p.diagnosis} · ${p.age}س</div>
        </div>`;
      });
      html += `</details>`;
    }

    this.container.innerHTML = html;
  }

  loadMore() {
    this.currentPage++;
    this.render();
  }

  // ─── بقية الدوال (showAdmissionWizard, viewPatient, advanceStage, updateVitals, addNote, dischargePatient) ───
  // جميعها موجودة في النسخة السابقة، ولم تتغير.
  // يمكنك الاحتفاظ بها كما هي، مع استبدال this.hasPermission بـ hasPermission(role, perm)
}
const ward = new WardComponent();
window.ward = ward;