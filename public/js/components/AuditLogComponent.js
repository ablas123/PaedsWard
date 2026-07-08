import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';

/**
 * ==========================================================================
 * 🔍 مكون سجل التدقيق الأمني والعمليات (Audit Log Component)
 * الوظيفة: تتبع العمليات الطبية والإدارية لضمان سلامة وخصوصية بيانات المرضى
 * ==========================================================================
 */
export class AuditLogComponent {
    constructor() {
        this.container = document.getElementById('audit-view');
        this.currentSearchQuery = '';

        this.init();
    }

    init() {
        this.renderLayout();
        this.setupListeners();
        this.updateDisplay();
    }

    /**
     * بناء الهيكل الأساسي لواجهة سجل التدقيق
     */
    renderLayout() {
        this.container.innerHTML = `
            <div class="view-header">
                <h2>سجل التدقيق الأمني وتتبع العمليات (Security Audit Log)</h2>
            </div>

            <div style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); box-shadow: var(--shadow);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h4 style="color: var(--text-main);">📜 العمليات والأحداث الأخيرة بالنظام</h4>
                    <span style="font-size:0.8rem; color:var(--text-muted); background:var(--primary-light); padding:4px 10px; border-radius:20px; font-weight:600;">خاص بمشرفي النظام والأطباء الأخصائيين</span>
                </div>
                
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.9rem;">
                        <thead>
                            <tr style="background-color: var(--primary-light); color: var(--primary-color); border-bottom: 2px solid var(--border-color);">
                                <th style="padding: 12px 8px;">🕒 التوقيت</th>
                                <th style="padding: 12px 8px;">👤 المستخدم</th>
                                <th style="padding: 12px 8px;">⚙️ نوع العملية</th>
                                <th style="padding: 12px 8px;">📝 التفاصيل</th>
                            </tr>
                        </thead>
                        <tbody id="audit_log_table_body">
                            </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    setupListeners() {
        EventBus.on('stateRefreshed', () => this.updateDisplay());
        EventBus.on('roleChanged', () => this.updateDisplay());

        EventBus.on('globalSearchTriggered', (query) => {
            this.currentSearchQuery = query;
            this.updateDisplay();
        });
    }

    /**
     * تحديث وتوليد صفوف الجدول بناءً على البيانات القادمة من السيرفر
     */
    updateDisplay() {
        const tbody = document.getElementById('audit_log_table_body');
        if (!tbody) return;

        const logs = StateManager.state.auditLog || [];
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد عمليات مسجلة في السجل حالياً.</td></tr>`;
            return;
        }

        logs.forEach(log => {
            // فلترة السجلات بناءً على البحث العالمي (البحث باسم المستخدم أو نوع العملية)
            const matchesSearch = !this.currentSearchQuery || 
                log.user.toLowerCase().includes(this.currentSearchQuery) ||
                log.action.toLowerCase().includes(this.currentSearchQuery) ||
                log.details.toLowerCase().includes(this.currentSearchQuery);

            if (!matchesSearch) return;

            const row = document.createElement('tr');
            row.style.borderBottom = `1px solid var(--border-color)`;
            
            // تمييز عمليات الحذف بلون خلفية خفيف جداً لإنذار المشرفين
            if (log.action.includes('DELETE')) {
                row.style.backgroundColor = 'rgba(239, 68, 68, 0.03)';
            }

            // تنسيق التوقيت بصيغة مقروءة ومحلية
            const logDate = new Date(log.timestamp).toLocaleTimeString('ar-SD', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }) + ' - ' + new Date(log.timestamp).toLocaleDateString('ar-SD');

            row.innerHTML = `
                <td style="padding: 12px 8px; color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;">${logDate}</td>
                <td style="padding: 12px 8px; font-weight: 600; color: var(--text-main);">${log.user}</td>
                <td style="padding: 12px 8px;">
                    <span style="
                        font-size: 0.75rem; 
                        font-weight: 700; 
                        padding: 2px 6px; 
                        border-radius: 4px;
                        background-color: ${this.getActionBgColor(log.action)};
                        color: ${this.getActionTextColor(log.action)};
                    ">
                        ${log.action}
                    </span>
                </td>
                <td style="padding: 12px 8px; color: var(--text-main); font-size: 0.85rem;">${log.details}</td>
            `;

            tbody.appendChild(row);
        });
    }

    getActionBgColor(action) {
        if (action.includes('CREATE')) return 'rgba(16, 185, 129, 0.1)';
        if (action.includes('UPDATE')) return 'rgba(14, 165, 233, 0.1)';
        if (action.includes('DELETE')) return 'rgba(239, 68, 68, 0.1)';
        return 'var(--primary-light)';
    }

    getActionTextColor(action) {
        if (action.includes('CREATE')) return 'var(--success-color)';
        if (action.includes('UPDATE')) return 'var(--accent-color)';
        if (action.includes('DELETE')) return 'var(--danger-color)';
        return 'var(--primary-color)';
    }
}

// تفعيل المكون تلقائياً
document.addEventListener('DOMContentLoaded', () => {
    window.AuditLogModule = new AuditLogComponent();
});