import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';

/**
 * ==========================================================================
 * 🗓️ مكون العيادة الخارجية والمواعيد (Outpatient Clinic Component)
 * الوظيفة: حجز ومتابعة مواعيد المراجعة للأطفال بعد الخروج من الجناح
 * ==========================================================================
 */
export class ClinicComponent {
    constructor() {
        this.container = document.getElementById('clinic-view');
        this.currentSearchQuery = '';

        this.init();
    }

    init() {
        this.renderLayout();
        this.setupListeners();
        this.updateDisplay();
    }

    renderLayout() {
        this.container.innerHTML = `
            <div class="view-header">
                <h2>جدولة مواعيد العيادة الخارجية والمراجعات</h2>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 20px;">
                <h4 style="margin-bottom:12px; color: var(--primary-color);">➕ حجز موعد مراجعة جديد</h4>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; align-items: end;">
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-muted);">اسم الطفل ورقم الملف:</label>
                        <input type="text" id="clinic_patient_input" class="role-selector" style="width:100%; text-align:right;" placeholder="مثال: أحمد علي - ملف 4055">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-muted);">التاريخ (Date):</label>
                        <input type="date" id="clinic_date_input" class="role-selector" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-muted);">العيادة التخصصية:</label>
                        <select id="clinic_type_input" class="role-selector" style="width:100%;">
                            <option value="general">🩺 العيادة العامة (General)</option>
                            <option value="neuro">🧠 عيادة الأعصاب (Neurology)</option>
                            <option value="nutrition">🍼 عيادة التغذية والنمو</option>
                        </select>
                    </div>
                    <button id="submit_appointment_btn" class="action-btn-primary" style="height: 38px;">تأكيد الحجز</button>
                </div>
            </div>

            <div style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); box-shadow: var(--shadow);">
                <h4 style="margin-bottom:14px; color: var(--text-main);">🗓️ المواعيد المجدولة للأيام القادمة</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.9rem;">
                        <thead>
                            <tr style="background-color: var(--primary-light); color: var(--primary-color); border-bottom: 2px solid var(--border-color);">
                                <th style="padding: 12px 8px;">👶 المريض / الملف</th>
                                <th style="padding: 12px 8px;">📅 التاريخ</th>
                                <th style="padding: 12px 8px;">🩺 نوع العيادة</th>
                                <th style="padding: 12px 8px;">🗑️ إجراء</th>
                            </tr>
                        </thead>
                        <tbody id="clinic_appointments_body">
                            </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('submit_appointment_btn').addEventListener('click', () => this.handleCreateAppointment());
    }

    setupListeners() {
        EventBus.on('stateRefreshed', () => this.updateDisplay());
        EventBus.on('collectionUpdated', () => this.updateDisplay());

        EventBus.on('globalSearchTriggered', (query) => {
            this.currentSearchQuery = query;
            this.updateDisplay();
        });
    }

    async handleCreateAppointment() {
        const patientInput = document.getElementById('clinic_patient_input');
        const dateInput = document.getElementById('clinic_date_input');
        const typeSelect = document.getElementById('clinic_type_input');

        const patientName = patientInput.value.trim();
        const date = dateInput.value;
        const clinicType = typeSelect.value;

        if (!patientName || !date) {
            alert("يرجى إدخال اسم المريض وتحديد تاريخ الموعد.");
            return;
        }

        const appointmentData = { patientName, date, clinicType };
        await StateManager.addGenericItem('clinic', appointmentData);

        patientInput.value = '';
        dateInput.value = '';
    }

    updateDisplay() {
        const tbody = document.getElementById('clinic_appointments_body');
        if (!tbody) return;

        const appointments = StateManager.state.clinic || [];
        tbody.innerHTML = '';

        if (appointments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد مواعيد مجدولة حالياً.</td></tr>`;
            return;
        }

        appointments.forEach(app => {
            const matchesSearch = !this.currentSearchQuery || app.patientName.toLowerCase().includes(this.currentSearchQuery);
            if (!matchesSearch) return;

            const row = document.createElement('tr');
            row.style.borderBottom = `1px solid var(--border-color)`;

            row.innerHTML = `
                <td style="padding: 12px 8px; font-weight: 600;">${app.patientName}</td>
                <td style="padding: 12px 8px; color: var(--text-muted);">${app.date}</td>
                <td style="padding: 12px 8px;"><span style="background:var(--primary-light); color:var(--primary-color); padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:700;">${this.translateClinic(app.clinicType)}</span></td>
                <td style="padding: 12px 8px;">
                    <button class="delete-app-btn" style="background:none; border:none; color:var(--danger-color); cursor:pointer; font-size:1rem;">🗑️</button>
                </td>
            `;

            row.querySelector('.delete-app-btn').addEventListener('click', async () => {
                if (confirm("هل تريد إلغাকিং هذا الموعد؟")) {
                    try {
                        const res = await fetch(`/api/clinic/${app.id}`, {
                            method: 'DELETE',
                            headers: StateManager.getAuthHeaders()
                        });
                        if (res.ok) {
                            StateManager.state.clinic = StateManager.state.clinic.filter(c => c.id !== app.id);
                            await StateManager.saveLocalState();
                            this.updateDisplay();
                            EventBus.emit('stateRefreshed', StateManager.state);
                        }
                    } catch (e) {
                        alert("فشل في حذف الموعد.");
                    }
                }
            });

            tbody.appendChild(row);
        });
    }

    translateClinic(type) {
        const list = { general: 'العيادة العامة', neuro: 'عيادة الأعصاب', nutrition: 'عيادة التغذية والنمو' };
        return list[type] || type;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ClinicModule = new ClinicComponent();
});