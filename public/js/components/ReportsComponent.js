import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';

/**
 * ==========================================================================
 * 📊 مكون التقارير والتحليل الإحصائي الافتراضي (Reports & Analytics Component)
 * الوظيفة: استعراض مؤشرات الأداء وتوزيع الحالات الطبية بيانيًا داخل الجناح
 * ==========================================================================
 */
export class ReportsComponent {
    constructor() {
        this.container = document.getElementById('reports-view');
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
                <h2>لوحة التقارير والتحليل الإحصائي للجناح</h2>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); box-shadow: var(--shadow);">
                    <h4 style="margin-bottom: 16px; color: var(--primary-color);">📊 توزيع الحالات حسب مؤشر الخطورة (PEWS)</h4>
                    <div id="pews_chart_pool" style="display: flex; flex-direction: column; gap: 14px;">
                        </div>
                </div>

                <div style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); box-shadow: var(--shadow);">
                    <h4 style="margin-bottom: 16px; color: var(--primary-color);">📈 معدل إنجاز المهام السريرية (Task Efficiency)</h4>
                    <div id="tasks_chart_pool" style="display: flex; flex-direction: column; gap: 14px; justify-content: center; height: 80%;">
                        </div>
                </div>
            </div>
        `;
    }

    setupListeners() {
        EventBus.on('stateRefreshed', () => this.updateDisplay());
        EventBus.on('collectionUpdated', () => this.updateDisplay());
    }

    updateDisplay() {
        this.calculatePewsAnalytics();
        this.calculateTasksAnalytics();
    }

    /**
     * حساب وعرض نسب خطورة الحالات الطبية بالأجنحة
     */
    calculatePewsAnalytics() {
        const pool = document.getElementById('pews_chart_pool');
        if (!pool) return;

        const patients = StateManager.state.patients || [];
        const total = patients.length;

        let high = 0, warn = 0, normal = 0;

        patients.forEach(p => {
            if (p.pewsScore >= 5 || p.isCritical) high++;
            else if (p.pewsScore >= 3) warn++;
            else normal++;
        });

        const highPct = total ? Math.round((high / total) * 100) : 0;
        const warnPct = total ? Math.round((warn / total) * 100) : 0;
        const normalPct = total ? Math.round((normal / total) * 100) : 0;

        pool.innerHTML = `
            <div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                    <span>🚨 حالات حرجة جداً (PEWS ≥ 5): <strong>${high} طفل</strong></span>
                    <span>${highPct}%</span>
                </div>
                <div style="width:100%; height:12px; background:#f3f4f6; border-radius:6px; overflow:hidden;">
                    <div style="width:${highPct}%; height:100%; background:var(--danger-color); transition: var(--transition);"></div>
                </div>
            </div>

            <div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                    <span>⚠️ حالات متوسطة الخطورة (PEWS 3-4): <strong>${warn} طفل</strong></span>
                    <span>${warnPct}%</span>
                </div>
                <div style="width:100%; height:12px; background:#f3f4f6; border-radius:6px; overflow:hidden;">
                    <div style="width:${warnPct}%; height:100%; background:var(--warning-color); transition: var(--transition);"></div>
                </div>
            </div>

            <div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                    <span>🟢 حالات مستقرة (PEWS 0-2): <strong>${normal} طفل</strong></span>
                    <span>${normalPct}%</span>
                </div>
                <div style="width:100%; height:12px; background:#f3f4f6; border-radius:6px; overflow:hidden;">
                    <div style="width:${normalPct}%; height:100%; background:var(--success-color); transition: var(--transition);"></div>
                </div>
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted); text-align:center; margin-top:10px;">إجمالي الأطفال النشطين حالياً بالجناح: ${total}</p>
        `;
    }

    /**
     * حساب وعرض مؤشر كفاءة إنجاز الخطط العلاجية والمهام
     */
    calculateTasksAnalytics() {
        const pool = document.getElementById('tasks_chart_pool');
        if (!pool) return;

        const tasks = StateManager.state.tasks || [];
        const total = tasks.length;

        const completed = tasks.filter(t => t.completed).length;
        const pending = total - completed;

        const completedPct = total ? Math.round((completed / total) * 100) : 0;

        pool.innerHTML = `
            <div style="text-align:center; margin-bottom:16px;">
                <span style="font-size: 2.2rem; font-weight: 800; color: var(--primary-color);">${completedPct}%</span>
                <p style="font-size:0.85rem; color:var(--text-muted);">نسبة إتمام المهام الإجمالية الموكلة للفريق</p>
            </div>
            <div style="width:100%; height:20px; background:#f3f4f6; border-radius:10px; overflow:hidden; position:relative;">
                <div style="width:${completedPct}%; height:100%; background:var(--success-color); transition: var(--transition);"></div>
            </div>
            <div style="display:flex; justify-content:space-around; font-size:0.85rem; margin-top:14px;">
                <span style="color:var(--success-color); font-weight:700;">✔️ مهام منجزة: ${completed}</span>
                <span style="color:var(--warning-color); font-weight:700;">⏳ معلقة وقيد التنفيذ: ${pending}</span>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ReportsModule = new ReportsComponent();
});