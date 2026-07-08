import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';

/**
 * ==========================================================================
 * 💬 مكون محادثة الفريق الطبي (Team Chat & Messages Component)
 * الوظيفة: تبادل الرسائل والاستشارات الفورية السريعة داخل الجناح الطبي
 * ==========================================================================
 */
export class TeamComponent {
    constructor() {
        this.container = document.getElementById('team-view');
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
                <h2>لوحة التواصل والمحادثة الفورية للفريق الطبي</h2>
            </div>

            <div style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); box-shadow: var(--shadow); height: 75vh; display: flex; flex-direction: column;">
                <div id="chat_messages_pool" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--border-color); margin-bottom: 14px;">
                    </div>

                <div style="display: flex; gap: 12px; align-items: center;">
                    <input type="text" id="chat_msg_input" class="role-selector" style="flex: 1; text-align: right;" placeholder="اكتب رسالة أو استشارة طبية عاجلة للفريق...">
                    <button id="send_msg_btn" class="action-btn-primary" style="white-space: nowrap;">إرسال 📝</button>
                </div>
            </div>
        `;

        document.getElementById('send_msg_btn').addEventListener('click', () => this.handleSendMessage());
        // دعم الإرسال عند ضغط زر Enter للأمان والسرعة
        document.getElementById('chat_msg_input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
    }

    setupListeners() {
        EventBus.on('stateRefreshed', () => this.updateDisplay());
        EventBus.on('collectionUpdated', () => this.updateDisplay());

        EventBus.on('globalSearchTriggered', (query) => {
            this.currentSearchQuery = query;
            this.updateDisplay();
        });
    }

    async handleSendMessage() {
        const input = document.getElementById('chat_msg_input');
        const text = input.value.trim();

        if (!text) return;

        const msgData = {
            text,
            sender: StateManager.currentUserName,
            senderRole: StateManager.currentUserRole
        };

        await StateManager.addGenericItem('messages', msgData);
        input.value = '';
    }

    updateDisplay() {
        const pool = document.getElementById('chat_messages_pool');
        if (!pool) return;

        const messages = StateManager.state.messages || [];
        pool.innerHTML = '';

        if (messages.length === 0) {
            pool.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:40px;">لا توجد رسائل متبادلة اليوم. ابدأ التواصل الآن!</p>`;
            return;
        }

        // عرض الرسائل مرتبة زمنياً من الأقدم للأحدث داخل الوعاء لسهولة القراءة المتسلسلة
        const chronologicalMessages = [...messages].reverse();

        chronologicalMessages.forEach(msg => {
            const matchesSearch = !this.currentSearchQuery || msg.text.toLowerCase().includes(this.currentSearchQuery);
            if (!matchesSearch) return;

            const isMe = msg.sender === StateManager.currentUserName;

            const msgWrapper = document.createElement('div');
            msgWrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: ${isMe ? 'flex-start' : 'flex-end'};
                width: 100%;
            `;

            const bubble = document.createElement('div');
            bubble.style.cssText = `
                max-width: 70%;
                padding: 10px 14px;
                border-radius: 8px;
                background-color: ${isMe ? 'var(--primary-light)' : '#f3f4f6'};
                border-right: 3px solid ${isMe ? 'var(--primary-color)' : 'var(--text-muted)'};
                text-align: right;
            `;

            const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' }) : '';

            bubble.innerHTML = `
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--primary-color); margin-bottom: 4px;">
                    ${msg.sender} (${this.translateRole(msg.senderRole)})
                </div>
                <div style="font-size: 0.9rem; color: var(--text-main); word-break: break-word;">${msg.text}</div>
                <div style="font-size: 0.65rem; color: var(--text-muted); text-align: left; margin-top: 4px;">${time}</div>
            `;

            msgWrapper.appendChild(bubble);
            pool.appendChild(msgWrapper);
        });

        // النزول التلقائي لأسفل المحادثة لمشاهدة الرسائل الجديدة فوراً
        pool.scrollTop = pool.scrollHeight;
    }

    translateRole(role) {
        const roles = { nurse: 'تمريض', junior: 'طبيب مقيم', senior: 'أخصائي/استشاري', admin: 'مشرف' };
        return roles[role] || role;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.TeamModule = new TeamComponent();
});