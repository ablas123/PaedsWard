/**
 * ==========================================================================
 * 🤖 نظام بث الأحداث المركزي (Application Event Bus)
 * النمط البرمجي: Publisher/Subscriber (Pub/Sub)
 * الوظيفة: يسمح للمكونات المنفصلة (مثل Ward و Handover) بالتواصل وإرسال 
 * البيانات والتنبيهات لبعضها البعض دون ربط مباشر، مما يضمن أعلى درجات التكامل.
 * ==========================================================================
 */

class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * الاشتراك في حدث معين (Listen)
     * @param {string} event - اسم الحدث (مثال: 'patientUpdated')
     * @param {Function} callback - الدالة المراد تنفيذها عند إطلاق الحدث
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    /**
     * إلغاء الاشتراك في حدث معين
     * @param {string} event - اسم الحدث
     * @param {Function} callback - الدالة المراد إزالتها
     */
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    /**
     * إطلاق حدث وتمرير البيانات لكافة المشتركين فواً (Emit)
     * @param {string} event - اسم الحدث المطلق
     * @param {any} data - البيانات المرسلة (كائن المريض، معلومات المهمة، إلخ)
     */
    emit(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`🔴 خطأ أثناء تنفيذ الدالة التابعة للحدث [${event}]:`, error);
            }
        });
    }
}

// تصدير نسخة واحدة ثابتة وموحدة لاستخدامها في كافة مكونات التطبيق (Singleton)
const globalEventBus = new EventBus();
export default globalEventBus;