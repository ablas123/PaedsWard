import EventBus from './core/EventBus.js';
import StateManager from './core/StateManager.js';

/**
 * ==========================================================================
 * 🚀 مهندس ومحرك الواجهة الأمامية الرئيسي (App Entry Point)
 * الوظيفة: ربط عناصر الهيدر، شريط البحث، عدادات الداشبورد، وإدارة التنقل
 * ==========================================================================
 */
class AppInitializer {
    constructor() {
        this.dom = {
            roleSelector: document.getElementById('userRoleSelector'),
            globalSearch: document.getElementById('globalSearch'),
            connectionStatus: document.getElementById('connectionStatus'),
            navigation: document.getElementById('appNavigation'),
            sections: document.querySelectorAll('.view-section'),
            // عدادات لوحة التحكم
            countTotal: document.getElementById('countTotal'),
            countCritical: document.getElementById('countCritical'),
            countTasks: document.getElementById('countTasks'),
            countUrgentHandover: document.getElementById('countUrgentHandover')
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.setupEventBusListeners();
        
        // إطلاق التحديث الأولي لقراءة حالة الشبكة الحالية للمتصفح
        this.updateNetworkIndicator(navigator.onLine);
    }

    /**
     * ربط مستمعي الأحداث لعناصر واجهة المستخدم الثابتة (DOM Events)
     */
    bindEvents() {
        // 1. مراقبة تغيير الصلاحيات والأدوار الطبية
        this.dom.roleSelector.addEventListener('change', (e) => {
            const selectedRole = e.target.value;
            StateManager.setRole(selectedRole);
            this.showToast(`تم تبديل الصلاحية الحالية إلى: ${e.target.options[e.target.selectedIndex].text}`, 'success');
        });

        // 2. تفعيل البحث العالمي الفوري أثناء الكتابة
        this.dom.globalSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            EventBus.emit('globalSearchTriggered', query);
        });

        // 3. إدارة التنقل بين التبويبات والأقسام (Sidebar / Bottom Nav)
        this.dom.navigation.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-btn');
            if (!btn) return;

            // تحديث حالة الأزرار النشطة
            this.dom.navigation.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // إظهار القسم المطلوب وإخفاء البقية بسلاسة
            const targetViewId = btn.getAttribute('data-target');
            this.dom.sections.forEach(section => {
                if (section.id === targetViewId) {
                    section.classList.add('active-view');
                } else {
                    section.classList.remove('active-view');
                }
            });

            // إطلاق حدث إعلامي بأن القسم تغير (مفيد للمكونات لإعادة تحميل بياناتها)
            EventBus.emit('viewChanged', targetViewId);
        });
    }

    /**
     * الاشتراك في الأحداث المركزية القادمة من نواة التطبيق (Event Bus Subscriptions)
     */
    setupEventBusListeners() {
        // الاستماع لتحديثات الشبكة وتغيير اللون (أونلاين / أوفلاين)
        EventBus.on('networkStatusChanged', (isOnline) => {
            this.updateNetworkIndicator(isOnline);
        });

        // الاستماع لتحديثات البيانات الكلية لتحديث عدادات الـ Dashboard فورا
        EventBus.on('stateRefreshed', (state) => {
            this.updateDashboardCounters(state);
        });

        // الاستماع لأي خطأ أمني أو برمجي آتٍ من السيرفر لعرضه للمستخدم
        EventBus.on('operationFailed', (errorMessage) => {
            this.showToast(errorMessage, 'danger');
        });
    }

    /**
     * تحديث مؤشر الاتصال العلوي (نقطة خضراء / حمراء مشعة)
     */
    updateNetworkIndicator(isOnline) {
        if (isOnline) {
            this.dom.connectionStatus.className = "status-indicator online";
            this.dom.connectionStatus.setAttribute('title', 'متصل بالسيرفر المركزي - المزامنة نشطة');
        } else {
            this.dom.connectionStatus.className = "status-indicator";
            this.dom.connectionStatus.setAttribute('title', 'وضع عدم الاتصال - يتم الحفظ محلياً في IndexedDB');
            this.showToast("أنت تعمل حالياً في وضع عدم الاتصال. تم تفعيل نظام الحفظ المحلي التلقائي.", "danger");
        }
    }

    /**
     * حساب وتحديث عدادات الإحصائيات في الهيدر فواً بناءً على قواعد دقيقة (PEWS)
     */
    updateDashboardCounters(state) {
        if (!state) return;

        // 1. إجمالي الأطفال الحاليين بالجناح
        const totalPatients = state.patients ? state.patients.length : 0;
        this.dom.countTotal.textContent = totalPatients;

        // 2. الحالات الحرجة (يتم حسابها تلقائياً إذا كان الطفل لديه وسم pews-high)
        const criticalPatients = state.patients ? state.patients.filter(p => p.isCritical || p.pewsScore >= 5).length : 0;
        this.dom.countCritical.textContent = criticalPatients;

        // 3. المهام الطبية والتمريضية المعلقة (غير المكتملة)
        const pendingTasks = state.tasks ? state.tasks.filter(t => !t.completed).length : 0;
        this.dom.countTasks.textContent = pendingTasks;

        // 4. تسليمات SBAR العاجلة والحرجة جداً
        const urgentHandovers = state.patients ? state.patients.filter(p => p.handoverUrgent && !p.handoverAcknowledged).length : 0;
        this.dom.countUrgentHandover.textContent = urgentHandovers;
    }

    /**
     * دالة مساعدة لإنشاء وعرض رسائل التنبيه العائمة (Toast Notifications)
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // إزالة التنبيه تلقائياً بعد 3.5 ثانية مع تأثير الانزلاق
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}

// تشغيل وتهيئة النظام بمجرد تحميل المتصفح بالكامل
document.addEventListener('DOMContentLoaded', () => {
    window.AppEngine = new AppInitializer();
});