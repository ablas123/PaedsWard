import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';

/**
 * ==========================================================================
 * 🏥 مكون إدارة جناح الأطفال والقبول الذكي (Ward & Admission Component)
 * الميزات: نظام أتمتة حساب PEWS، نموذج قبول بـ 3 خطوات، لوحة سير العمل
 * ==========================================================================
 */
export class WardComponent {
    constructor() {
        this.container = document.getElementById('wardStagesContainer');
        this.wizardBtn = document.getElementById('openAdmissionWizardBtn');
        this.modalOverlay = document.getElementById('modalOverlay');
        this.modalBox = document.getElementById('modalBox');
        
        this.currentSearchQuery = '';
        this.currentWizardStep = 1;

        this.init();
    }

    init() {
        this.renderStagesLayout();
        this.bindEvents();
        this.setupListeners();
    }

    bindEvents() {
        // فتح معالج القبول الذكي عند الضغط على الزر
        if (this.wizardBtn) {
            this.wizardBtn.addEventListener('click', () => this.openAdmissionWizard());
        }
    }

    setupListeners() {
        // إعادة البناء عند تحديث البيانات الكلية
        EventBus.on('stateRefreshed', () => this.updateDisplay());
        EventBus.on('patientAdded', () => this.updateDisplay());
        EventBus.on('patientUpdated', () => this.updateDisplay());

        // الاستماع للبحث العالمي الفوري
        EventBus.on('globalSearchTriggered', (query) => {
            this.currentSearchQuery = query;
            this.updateDisplay();
        });

        // تحديث العرض عند تغيير الدور الطبي لإخفاء/إظهار أزرار التحكم
        EventBus.on('roleChanged', () => this.updateDisplay());
    }

    /**
     * بناء الأعمدة الأربعة الثابتة لسير العمل داخل الجناح
     */
    renderStagesLayout() {
        this.container.innerHTML = `
            <div class="ward-stage-column" data-stage="1" id="stage-col-1">
                <div class="stage-title">📥 1. الاستقبال <span class="stage-count" id="count-col-1">0</span></div>
                <div class="stage-cards-pool"></div>
            </div>
            <div class="ward-stage-column" data-stage="2" id="stage-col-2">
                <div class="stage-title">📝 2. وضع الخطة <span class="stage-count" id="count-col-2">0</span></div>
                <div class="stage-cards-pool"></div>
            </div>
            <div class="ward-stage-column" data-stage="3" id="stage-col-3">
                <div class="stage-title">⚡ 3. التنفيذ العلاجي <span class="stage-count" id="count-col-3">0</span></div>
                <div class="stage-cards-pool"></div>
            </div>
            <div class="ward-stage-column" data-stage="4" id="stage-col-4">
                <div class="stage-title">🏁 4. جاهز للخروج <span class="stage-count" id="count-col-4">0</span></div>
                <div class="stage-cards-pool"></div>
            </div>
        `;
    }

    /**
     * تحديث وتوزيع بطاقات الأطفال على الأعمدة بناءً على الفلترة والبحث
     */
    updateDisplay() {
        const patients = StateManager.state.patients || [];
        
        // تفريغ الأوعية الحالية أولاً
        for (let i = 1; i <= 4; i++) {
            const pool = document.querySelector(`#stage-col-${i} .stage-cards-pool`);
            if (pool) pool.innerHTML = '';
            const countBadge = document.getElementById(`count-col-${i}`);
            if (countBadge) countBadge.textContent = '0';
        }

        const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };

        // فلترة وتوزيع المرضى
        patients.forEach(patient => {
            // التحقق من مطابقة البحث العالمي (الاسم، التشخيص، أو رقم الملف)
            const matchesSearch = !this.currentSearchQuery || 
                patient.name.toLowerCase().includes(this.currentSearchQuery) ||
                patient.diagnosis.toLowerCase().includes(this.currentSearchQuery) ||
                patient.fileNumber.includes(this.currentSearchQuery);

            if (!matchesSearch) return;

            const stage = patient.stage || 1;
            const pool = document.querySelector(`#stage-col-${stage} .stage-cards-pool`);
            
            if (pool) {
                counts[stage]++;
                const card = this.createPatientCard(patient);
                pool.appendChild(card);
            }
        });

        // تحديث شارات الأعداد أعلى الأعمدة
        for (let i = 1; i <= 4; i++) {
            const countBadge = document.getElementById(`count-col-${i}`);
            if (countBadge) countBadge.textContent = counts[i];
        }
    }

    /**
     * توليد كود HTML لبطاقة الطفل مع تحديد خطورة الحالة (PEWS Class)
     */
    createPatientCard(patient) {
        const card = document.createElement('div');
        
        // حساب وتقييم الـ PEWS لتلوين حواف البطاقة فوراً للأمان السريري
        let pewsClass = 'pews-normal';
        if (patient.pewsScore >= 5 || patient.isCritical) pewsClass = 'pews-high';
        else if (patient.pewsScore >= 3) pewsClass = 'pews-warn';

        card.className = `patient-card ${pewsClass}`;
        card.innerHTML = `
            <h4>${patient.name}</h4>
            <div class="patient-meta">
                <span>📁 ملف: ${patient.fileNumber}</span>
                <span>🎂 العمر: ${patient.age}</span>
                <span>🩺 PEWS: <strong>${patient.pewsScore || 0}</strong></span>
            </div>
            <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: var(--primary-color);">
                📋 ${patient.diagnosis}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <button class="view-details-btn" style="background: none; border: none; color: var(--accent-color); font-weight: 700; cursor: pointer; font-size: 0.8rem;">👁️ التفاصيل</button>
                ${this.renderActionBtnForStage(patient)}
            </div>
        `;

        // ربط الأحداث للبطاقة
        card.querySelector('.view-details-btn').addEventListener('click', () => this.openPatientDetailsModal(patient));
        
        const advanceBtn = card.querySelector('.advance-stage-btn');
        if (advanceBtn) {
            advanceBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.advancePatientStage(patient);
            });
        }

        return card;
    }

    renderActionBtnForStage(patient) {
        // زر الترقية يظهر فقط لصلاحيات الاستشاري/الأخصائي لضمان المأمونية الطبية
        if (StateManager.currentUserRole !== 'senior') return '';
        if (patient.stage === 4) return `<button class="advance-stage-btn" style="background: var(--danger-color); color: #fff; border: none; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">🚪 خروج نهائي</button>`;
        return `<button class="advance-stage-btn" style="background: var(--primary-color); color: #fff; border: none; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">➡️ تقدم</button>`;
    }

    /**
     * دالة ترقية مرحلة رعاية الطفل عبر أعمدة الأجنحة
     */
    async advancePatientStage(patient) {
        if (patient.stage < 4) {
            const nextStage = patient.stage + 1;
            await StateManager.patchPatient(patient.id, { stage: nextStage });
        } else {
            // إذا كان في المرحلة 4 وضغط خروج نهائي، يتم حذفه من اللوحة النشطة وأرشفته بالسيرفر
            if (confirm(`هل أنت متأكد من إتمام إجراءات الخروج النهائي وأرشفة ملف الطفل: ${patient.name}؟`)) {
                try {
                    const res = await fetch(`/api/patients/${patient.id}`, {
                        method: 'DELETE',
                        headers: StateManager.getAuthHeaders()
                    });
                    if (res.ok) {
                        StateManager.state.patients = StateManager.state.patients.filter(p => p.id !== patient.id);
                        await StateManager.saveLocalState();
                        this.updateDisplay();
                        EventBus.emit('stateRefreshed', StateManager.state);
                    }
                } catch (e) {
                    alert("فشل إجراء الخروج النهائي، يرجى التحقق من الاتصال بالسيرفر.");
                }
            }
        }
    }

    /**
     * فتح نافذة معالج القبول المكون من 3 خطوات (Admission Wizard Modal)
     */
    openAdmissionWizard() {
        this.currentWizardStep = 1;
        this.modalOverlay.classList.add('active');
        this.renderWizardStepContent();
    }

    renderWizardStepContent() {
        let stepHtml = '';

        if (this.currentWizardStep === 1) {
            stepHtml = `
                <h3>👶 قبول طفل جديد - الخطوة 1 (البيانات الأساسية)</h3>
                <hr style="margin: 12px 0; border-color: var(--border-color);">
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <label>اسم الطفل رباعي:</label>
                    <input type="text" id="wiz_name" class="role-selector" style="width:100%; text-align:right;" required>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label>رقم الملف الطبي:</label>
                            <input type="text" id="wiz_file" class="role-selector" style="width:100%; text-align:right;" required>
                        </div>
                        <div>
                            <label>العمر / تاريخ الميلاد:</label>
                            <input type="text" id="wiz_age" class="role-selector" style="width:100%; text-align:right;" placeholder="مثال: 3 سنوات" required>
                        </div>
                    </div>
                </div>
            `;
        } else if (this.currentWizardStep === 2) {
            stepHtml = `
                <h3>🩺 قبول طفل جديد - الخطوة 2 (التشخيص السريري)</h3>
                <hr style="margin: 12px 0; border-color: var(--border-color);">
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <label>التشخيص الأولي (Diagnosis):</label>
                    <input type="text" id="wiz_diag" class="role-selector" style="width:100%; text-align:right;" placeholder="مثال: Severe Pneumonia" required>
                    <label>الشكوى الرئيسية والتاريخ الطبي باختصار:</label>
                    <textarea id="wiz_history" class="role-selector" style="width:100%; height:80px; text-align:right; font-family:inherit;"></textarea>
                </div>
            `;
        } else if (this.currentWizardStep === 3) {
            stepHtml = `
                <h3>📊 قبول طفل جديد - الخطوة 3 (العلامات الحيوية الأولية و PEWS)</h3>
                <hr style="margin: 12px 0; border-color: var(--border-color);">
                <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">سيقوم النظام بحساب درجة خطورة الحالة مؤتمتاً بناءً على هذه المدخلات القياسية.</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label>معدل التنفس (Respiratory Rate):</label>
                        <input type="number" id="wiz_rr" class="role-selector" style="width:100%;" value="24">
                    </div>
                    <div>
                        <label>نبضات القلب (Heart Rate):</label>
                        <input type="number" id="wiz_hr" class="role-selector" style="width:100%;" value="95">
                    </div>
                    <div>
                        <label>درجة الحرارة (Temp °C):</label>
                        <input type="number" id="wiz_temp" class="role-selector" style="width:100%;" value="37" step="0.1">
                    </div>
                    <div>
                        <label>الحالة العصبية والوعي:</label>
                        <select id="wiz_neuro" class="role-selector" style="width:100%;">
                            <option value="0">واعي ومستجيب بالكامل (Normal)</option>
                            <option value="1">مستجيب للصوت فقط (Somnolent)</option>
                            <option value="3">مستجيب للألم فقط أو غائب عن الوعي</option>
                        </select>
                    </div>
                </div>
            `;
        }

        // إضافة أزرار التحكم بالمعالج أسفل المحتوى الديناميكي
        this.modalBox.innerHTML = `
            <div id="wizard-form-container">${stepHtml}</div>
            <div style="display: flex; justify-content: space-between; margin-top: 24px;">
                <button id="wiz_close" class="role-selector">إلغاء</button>
                <div>
                    ${this.currentWizardStep > 1 ? '<button id="wiz_back" class="role-selector" style="margin-left:8px;">السابق</button>' : ''}
                    <button id="wiz_next" class="action-btn-primary">${this.currentWizardStep === 3 ? 'إتمام القبول وحفظ' : 'التالي'}</button>
                </div>
            </div>
        `;

        this.bindWizardControls();
    }

    bindWizardControls() {
        // تخزين البيانات المدخلة مؤقتاً بين الخطوات
        if (!this.wizardData) this.wizardData = {};

        document.getElementById('wiz_close').addEventListener('click', () => {
            this.modalOverlay.classList.remove('active');
            this.wizardData = {};
        });

        const nextBtn = document.getElementById('wiz_next');
        const backBtn = document.getElementById('wiz_back');

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.currentWizardStep--;
                this.renderWizardStepContent();
            });
        }

        nextBtn.addEventListener('click', async () => {
            // حفظ مدخلات الخطوة الحالية قبل الانتقال
            if (this.currentWizardStep === 1) {
                this.wizardData.name = document.getElementById('wiz_name').value;
                this.wizardData.fileNumber = document.getElementById('wiz_file').value;
                this.wizardData.age = document.getElementById('wiz_age').value;
                if (!this.wizardData.name || !this.wizardData.fileNumber) return alert("يرجى ملء الاسم ورقم الملف الحقول إلزامية");
                this.currentWizardStep = 2;
                this.renderWizardStepContent();
            } else if (this.currentWizardStep === 2) {
                this.wizardData.diagnosis = document.getElementById('wiz_diag').value;
                this.wizardData.history = document.getElementById('wiz_history').value;
                if (!this.wizardData.diagnosis) return alert("يرجى تحديد التشخيص الأولي للطفل");
                this.currentWizardStep = 3;
                this.renderWizardStepContent();
            } else if (this.currentWizardStep === 3) {
                // قراءة وحساب نقاط الـ PEWS آلياً قبل الرفع للشبكة
                const rr = parseInt(document.getElementById('wiz_rr').value) || 24;
                const hr = parseInt(document.getElementById('wiz_hr').value) || 95;
                const neuroScore = parseInt(document.getElementById('wiz_neuro').value) || 0;
                
                // دالة سريرية برمجية مبسطة لحساب نقاط الخطورة الافتراضية للإنذار المبكر
                let calculatedPews = neuroScore;
                if (rr > 40 || rr < 15) calculatedPews += 2;
                if (hr > 140 || hr < 60) calculatedPews += 2;

                this.wizardData.vitals = { rr, hr, temp: document.getElementById('wiz_temp').value };
                this.wizardData.pewsScore = calculatedPews;
                this.wizardData.isCritical = calculatedPews >= 5;

                // إرسال البيانات الكلية لمدير الحالة المركزي
                await StateManager.addPatient(this.wizardData);
                this.modalOverlay.classList.remove('active');
                this.wizardData = {}; // تصفير الوعاء
            }
        });
    }

    /**
     * فتح نافذة عرض التفاصيل الكاملة لملف الطفل
     */
    openPatientDetailsModal(patient) {
        this.modalOverlay.classList.add('active');
        this.modalBox.innerHTML = `
            <h3>📄 الملف الطبي الشامل للطفل</h3>
            <hr style="margin: 12px 0; border-color: var(--border-color);">
            <div style="text-align: right; line-height: 1.8;">
                <p><strong>الاسم الكامـل:</strong> ${patient.name}</p>
                <p><strong>رقم الملف:</strong> ${patient.fileNumber} | <strong>العمر:</strong> ${patient.age}</p>
                <p><strong>التشخيص الحالي:</strong> ${patient.diagnosis}</p>
                <p><strong>التاريخ المرضي:</strong> ${patient.history || 'لا يوجد ملخص مسجل'}</p>
                <hr style="margin: 12px 0; border-style: dashed; border-color: var(--border-color);">
                <p>📊 <strong>مؤشر الإنذار المبكر (PEWS Score):</strong> <span style="font-size:1.1rem; font-weight:700; color:var(--danger-color);">${patient.pewsScore || 0}</span></p>
                <p>🌡️ <strong>آخر علامات حيوية:</strong> نبض: ${patient.vitals?.hr || '--'} | تنفس: ${patient.vitals?.rr || '--'} | حرارة: ${patient.vitals?.temp || '--'}°C</p>
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:24px;">
                <button id="closeDetailsModalBtn" class="action-btn-primary">إغلاق الملف</button>
            </div>
        `;
        document.getElementById('closeDetailsModalBtn').addEventListener('click', () => {
            this.modalOverlay.classList.remove('active');
        });
    }
}

// تهيئة المكون ذاتياً لربط الأحداث باللوحة
document.addEventListener('DOMContentLoaded', () => {
    window.WardModule = new WardComponent();
});