import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';

/**
 * ==========================================================================
 * 🔄 مكون تسليم المناوبة الطبي المعتمد (SBAR Handover Component)
 * البروتوكول: Situation, Background, Assessment, Recommendation
 * ==========================================================================
 */
export class HandoverComponent {
    constructor() {
        this.container = document.getElementById('handover-view');
        this.currentSearchQuery = '';
        this.selectedPatientId = null;

        this.init();
    }

    init() {
        this.renderLayout();
        this.setupListeners();
        this.updateDisplay();
    }

    /**
     * بناء الهيكل البنائي لتبويب التسليم الطبي بنظام الشاشتين المتوازيتين
     */
    renderLayout() {
        this.container.innerHTML = `
            <div class="view-header">
                <h2>تسليم واستلام المناوبة الطبية – بروتوكول SBAR</h2>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px;">
                <div style="background: var(--bg-card); padding: 16px; border-radius: var(--radius); box-shadow: var(--shadow); max-height: 70vh; overflow-y: auto;">
                    <h4 style="margin-bottom: 12px; color: var(--text-main);">👶 اختر طفلاً لإعداد التقرير</h4>
                    <div id="handover_patients_list" style="display: flex; flex-direction: column; gap: 8px;">
                        </div>
                </div>

                <div id="sbar_editor_container" style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); box-shadow: var(--shadow);">
                    <p style="text-align: center; color: var(--text-muted); padding: 40px;">يرجى اختيار مريض من القائمة اليمنى لعرض أو صياغة تقرير التسليم الطبي SBAR الخاص به.</p>
                </div>
            </div>
        `;
    }

    setupListeners() {
        EventBus.on('stateRefreshed', () => this.updateDisplay());
        EventBus.on('patientUpdated', () => this.updateDisplay());
        EventBus.on('roleChanged', () => this.updateDisplay());

        EventBus.on('globalSearchTriggered', (query) => {
            this.currentSearchQuery = query;
            this.updateDisplay();
        });
    }

    /**
     * تحديث قائمة المرضى في الجانب الأيمن
     */
    updateDisplay() {
        const listPool = document.getElementById('handover_patients_list');
        if (!listPool) return;

        const patients = StateManager.state.patients || [];
        listPool.innerHTML = '';

        if (patients.length === 0) {
            listPool.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); text-align:center;">لا يوجد مرضى حاليين بالجناح.</p>`;
            return;
        }

        patients.forEach(patient => {
            const matchesSearch = !this.currentSearchQuery || 
                patient.name.toLowerCase().includes(this.currentSearchQuery) ||
                patient.fileNumber.includes(this.currentSearchQuery);

            if (!matchesSearch) return;

            const item = document.createElement('div');
            item.style.cssText = `
                padding: 10px 12px;
                border: 1px solid ${this.selectedPatientId === patient.id ? 'var(--accent-color)' : 'var(--border-color)'};
                background-color: ${this.selectedPatientId === patient.id ? 'var(--primary-light)' : '#ffffff'};
                border-radius: 6px;
                cursor: pointer;
                transition: var(--transition);
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;

            item.innerHTML = `
                <div style="text-align: right;">
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-main);">${patient.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">ملف: ${patient.fileNumber} | التشخيص: ${patient.diagnosis}</div>
                </div>
                ${patient.handoverUrgent ? '<span style="background:var(--danger-color); color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700; animation: fadeIn 0.5s infinite alternate;">⚠️ عاجل</span>' : ''}
            `;

            item.addEventListener('click', () => {
                this.selectedPatientId = patient.id;
                this.updateDisplay(); // لإعادة تلوين العنصر المختار
                this.renderSbarEditor(patient);
            });

            listPool.appendChild(item);
        });

        // إذا كان هناك مريض مختار مسبقاً، نعيد تحميل بياناته المحدثة في المحرر
        if (this.selectedPatientId) {
            const currentPatient = patients.find(p => p.id === this.selectedPatientId);
            if (currentPatient) this.renderSbarEditor(currentPatient);
        }
    }

    /**
     * بناء محرر الـ SBAR للطفل المختار هيدروليكياً مع تعبئة البيانات السابقة
     */
    renderSbarEditor(patient) {
        const editor = document.getElementById('sbar_editor_container');
        if (!editor) return;

        // استرجاع تفاصيل الـ SBAR المسجلة مسبقاً أو وضع قيم فارغة
        const sbar = patient.sbarReport || { situation: '', background: '', assessment: '', recommendation: '' };

        editor.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid var(--primary-light); padding-bottom: 8px;">
                <div>
                    <h3 style="color: var(--primary-color);">${patient.name}</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted);">رقم الملف: ${patient.fileNumber} | مؤشر PEWS الحالي: <strong>${patient.pewsScore || 0}</strong></p>
                </div>
                <label style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--danger-color); cursor: pointer;">
                    <input type="checkbox" id="chk_urgent_handover" ${patient.handoverUrgent ? 'checked' : ''}>
                    ⚠️ وضع وسم تسليم عاجل وحرج
                </label>
            </div>

            <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                    <strong style="color:var(--danger-color); display:block; margin-bottom:4px;">S - Situation (الوضع الحالي الحرج):</strong>
                    <textarea id="sbar_s" class="role-selector" style="width:100%; height:55px; text-align:right; font-family:inherit;" placeholder="ما هي مشكلة الطفل الأساسية والآنية حالياً؟">${sbar.situation || ''}</textarea>
                </div>
                <div>
                    <strong style="color:var(--warning-color); display:block; margin-bottom:4px;">B - Background (الخلفية المرضية):</strong>
                    <textarea id="sbar_b" class="role-selector" style="width:100%; height:55px; text-align:right; font-family:inherit;" placeholder="ملخص سريع لتاريخ المرض، خطة العلاج المتبعة، والأدوية الحالية...">${sbar.background || patient.diagnosis + ' - ' + (patient.history || '')}</textarea>
                </div>
                <div>
                    <strong style="color:var(--accent-color); display:block; margin-bottom:4px;">A - Assessment (التقييم والعلامات الحيوية):</strong>
                    <textarea id="sbar_a" class="role-selector" style="width:100%; height:55px; text-align:right; font-family:inherit;" placeholder="تقييمك السريري لحالة الطفل المستجدة ونتائج الفحوصات الأخيرة...">${sbar.assessment || `HR: ${patient.vitals?.hr || ''}, RR: ${patient.vitals?.rr || ''}, Temp: ${patient.vitals?.temp || ''}°C`}</textarea>
                </div>
                <div>
                    <strong style="color:var(--success-color); display:block; margin-bottom:4px;">R - Recommendation (التوصيات للمناوبة القادمة):</strong>
                    <textarea id="sbar_r" class="role-selector" style="width:100%; height:55px; text-align:right; font-family:inherit;" placeholder="ما هي المهام المطلوبة بدقة من الطبيب المستلم؟ (مثال: مراجعة نتيجة المختبر الساعة 12)" >${sbar.recommendation || ''}</textarea>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                <button id="save_sbar_btn" class="action-btn-primary" style="background-color: var(--success-color);">💾 حفظ تقرير التسليم ومزامنته</button>
            </div>
        `;

        // ربط حدث الحفظ والمزامنة المباشر
        document.getElementById('save_sbar_btn').addEventListener('click', () => this.handleSaveSbar(patient.id));
    }

    /**
     * تجميع وقراءة تقرير الـ SBAR وحفظه عبر مدير الحالة
     */
    async handleSaveSbar(patientId) {
        const situation = document.getElementById('sbar_s').value.trim();
        const background = document.getElementById('sbar_b').value.trim();
        const assessment = document.getElementById('sbar_a').value.trim();
        const recommendation = document.getElementById('sbar_r').value.trim();
        const handoverUrgent = document.getElementById('chk_urgent_handover').checked;

        const updatePayload = {
            handoverUrgent,
            handoverAcknowledged: false, // إعادة تصفير الإقرار للتأكيد على الطبيب المستلم الجديد
            sbarReport: {
                situation,
                background,
                assessment,
                recommendation,
                updatedBy: StateManager.currentUserName,
                timestamp: new Date().toISOString()
            }
        };

        // تحديث جزئي فوري وآمن لملف المريض بالسيرفر والمحلي
        await StateManager.patchPatient(patientId, updatePayload);
        
        // إظهار تنبيه نجاح للمستخدم عبر نظام الـ Toast
        if (window.AppEngine) {
            window.AppEngine.showToast("تم تحديث وحفظ تقرير الـ SBAR الطبي بنجاح وتمت المزامنة.", "success");
        }
    }
}

// تفعيل وتشغيل المكون تلقائياً بمجرد استدعائه
document.addEventListener('DOMContentLoaded', () => {
    window.HandoverModule = new HandoverComponent();
});