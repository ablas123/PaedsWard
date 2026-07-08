import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';

/**
 * ==========================================================================
 * ✅ مكون إدارة المهام الطبية والتمريضية (Medical Tasks Component)
 * الميزات: ربط المهام بالأدوار الطبية، فلترة ذكية، تحقق من صلاحية الإكمال
 * ==========================================================================
 */
export class TasksComponent {
    constructor() {
        this.container = document.getElementById('tasks-view');
        this.currentSearchQuery = '';
        
        this.init();
    }

    init() {
        this.renderLayout();
        this.setupListeners();
        this.updateDisplay();
    }

    /**
     * بناء الهيكل الداخلي لتبويب المهام ونموذج الإضافة السريع
     */
    renderLayout() {
        this.container.innerHTML = `
            <div class="view-header">
                <h2>إدارة المهام الطبية والتمريضية بالجناح</h2>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 20px;">
                <h4 style="margin-bottom:12px; color: var(--primary-color);">➕ إسناد مهمة سريرية جديدة</h4>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; align-items: end;">
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-muted);">نص المهمة (مثال: سحب عينة دم، إعطاء دواء):</label>
                        <input type="text" id="task_title_input" class="role-selector" style="width:100%; text-align:right;" placeholder="اكتب تفاصيل المهمة هنا...">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-muted);">الفئة المستهدفة (Assignee Role):</label>
                        <select id="task_role_input" class="role-selector" style="width:100%;">
                            <option value="nurse">💡 طاقم التمريض (Nurse)</option>
                            <option value="junior">🩺 الطبيب المقيم (Junior)</option>
                            <option value="senior">👑 الأخصائي / الاستشاري</option>
                        </select>
                    </div>
                    <button id="submit_task_btn" class="action-btn-primary" style="height: 38px;">إضافة وإسناد</button>
                </div>
            </div>

            <div style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); box-shadow: var(--shadow);">
                <h4 style="margin-bottom:14px; color: var(--text-main);">📋 قائمة المهام النشطة والمعلقة</h4>
                <div id="tasks_list_pool" style="display: flex; flex-direction: column; gap: 10px;">
                    </div>
            </div>
        `;

        // ربط حدث زر الإضافة
        document.getElementById('submit_task_btn').addEventListener('click', () => this.handleAddTask());
    }

    setupListeners() {
        // إعادة البناء عند تحديث البيانات الكلية أو تغيير الأدوار
        EventBus.on('stateRefreshed', () => this.updateDisplay());
        EventBus.on('collectionUpdated', () => this.updateDisplay());
        EventBus.on('roleChanged', () => this.updateDisplay());

        // الاستماع للبحث العالمي
        EventBus.on('globalSearchTriggered', (query) => {
            this.currentSearchQuery = query;
            this.updateDisplay();
        });
    }

    /**
     * معالجة وقراءة البيانات لإنشاء مهمة جديدة
     */
    async handleAddTask() {
        const titleInput = document.getElementById('task_title_input');
        const roleSelect = document.getElementById('task_role_input');
        
        const title = titleInput.value.trim();
        const assignedRole = roleSelect.value;

        if (!title) {
            alert("يرجى كتابة نص المهمة أولاً.");
            return;
        }

        const taskData = {
            title,
            assignedRole,
            completed: false,
            creator: StateManager.currentUserName
        };

        // الرفع لمدير الحالة المركزي
        await StateManager.addGenericItem('tasks', taskData);
        
        // تصفير الحقل بعد النجاح
        titleInput.value = '';
    }

    /**
     * تحديث قائمة المهام المعروضة بناءً على الصلاحيات وحالة البحث
     */
    updateDisplay() {
        const pool = document.getElementById('tasks_list_pool');
        if (!pool) return;

        const tasks = StateManager.state.tasks || [];
        pool.innerHTML = '';

        if (tasks.length === 0) {
            pool.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد مهام مسجلة حالياً في هذا الجناح.</p>`;
            return;
        }

        tasks.forEach(task => {
            // التحقق من مطابقة كلمة البحث العالمي
            const matchesSearch = !this.currentSearchQuery || task.title.toLowerCase().includes(this.currentSearchQuery);
            if (!matchesSearch) return;

            const card = document.createElement('div');
            card.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background-color: ${task.completed ? '#f9fafb' : '#ffffff'};
                border-right: 4px solid ${task.completed ? 'var(--success-color)' : 'var(--warning-color)'};
                opacity: ${task.completed ? '0.7' : '1'};
            `;

            card.innerHTML = `
                <div style="text-align: right;">
                    <span style="text-decoration: ${task.completed ? 'line-through' : 'none'}; font-weight: 600; color: ${task.completed ? 'var(--text-muted)' : 'var(--text-main)'};">
                        ${task.title}
                    </span>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                        🎯 موجهة إلى: <span style="color:var(--primary-color); font-weight:700;">${this.translateRole(task.assignedRole)}</span> | بواسطة: ${task.creator || 'النظام'}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    ${!task.completed ? `<button class="complete-task-btn" style="background:var(--success-color); color:#fff; border:none; padding:4px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer; font-weight:600;">✔️ إكمال</button>` : '<span style="color:var(--success-color); font-size:0.85rem; font-weight:700;">✅ اكتملت</span>'}
                    <button class="delete-task-btn" style="background:none; border:none; color:var(--danger-color); cursor:pointer; font-size:0.9rem;" title="حذف المهمة">🗑️</button>
                </div>
            `;

            // حدث زر إكمال المهمة مع التحقق من صلاحية الدور الحالية للسلامة الطبية
            const completeBtn = card.querySelector('.complete-task-btn');
            if (completeBtn) {
                completeBtn.addEventListener('click', async () => {
                    const currentUserRole = StateManager.currentUserRole;
                    // يسمح للأدوار العليا أو الشخص الموجهة له المهمة بإكمالها
                    if (currentUserRole === 'senior' || currentUserRole === 'admin' || currentUserRole === task.assignedRole) {
                        // تحديث جزئي للمهمة على السيرفر ومحلياً
                        task.completed = true;
                        await this.updateTaskOnServer(task.id, { completed: true });
                    } else {
                        alert(`خطأ في الصلاحية: هذه المهمة مخصصة لدور [${this.translateRole(task.assignedRole)}]، ولا يمكن لكم إكمالها من الحساب الحالي.`);
                    }
                });
            }

            // حدث حذف المهمة
            card.querySelector('.delete-task-btn').addEventListener('click', async () => {
                if (confirm("هل تريد حذف هذه المهمة نهائياً من سجلات الجناح؟")) {
                    try {
                        const res = await fetch(`/api/tasks/${task.id}`, {
                            method: 'DELETE',
                            headers: StateManager.getAuthHeaders()
                        });
                        if (res.ok) {
                            StateManager.state.tasks = StateManager.state.tasks.filter(t => t.id !== task.id);
                            await StateManager.saveLocalState();
                            this.updateDisplay();
                            EventBus.emit('stateRefreshed', StateManager.state);
                        }
                    } catch (e) {
                        alert("فشل حذف المهمة، يرجى التحقق من الصلاحيات والاتصال بالسيرفر.");
                    }
                }
            });

            pool.appendChild(card);
        });
    }

    /**
     * تحديث حالة المهمة على السيرفر مباشرة
     */
    async updateTaskOnServer(taskId, updatedFields) {
        if (!StateManager.isOnline) {
            await StateManager.saveLocalState();
            this.updateDisplay();
            return;
        }

        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: StateManager.getAuthHeaders(),
                body: JSON.stringify(updatedFields)
            });
            await StateManager.fetchServerState(); // إعادة التزامن الكامل لإشعار باقي الأجهزة
        } catch (e) {
            console.error("فشلت مزامنة تحديث المهمة مع السيرفر.");
        }
    }

    translateRole(role) {
        const roles = { nurse: 'طاقم التمريض', junior: 'الطبيب المقيم', senior: 'الاستشاري / الأخصائي' };
        return roles[role] || role;
    }
}

// تشغيل وتفعيل المكون تلقائياً
document.addEventListener('DOMContentLoaded', () => {
    window.TasksModule = new TasksComponent();
});