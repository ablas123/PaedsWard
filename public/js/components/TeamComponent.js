// CoreWard - Team Component
// Team directory and chat

class TeamComponent {
  constructor() {
    this.container = document.getElementById('appMain');
    this.bindEvents();
  }

  bindEvents() {
    EventBus.on('stateChanged', () => this.render());
    EventBus.on('search', (query) => this.handleSearch(query));
  }

  render() {
    const users = window.stateManager.getUsers();
    const messages = window.stateManager.getTeamMessages();
    const currentUser = window.stateManager.getCurrentUser();

    // Sort users by role importance
    const roleOrder = ['director', 'specialist', 'deputy', 'general', 'intern'];
    const sortedUsers = users.sort((a, b) => {
      return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    });

    this.container.innerHTML = `
      <div class="section-header">
        <div class="section-title">👥 فريق العمل (${sortedUsers.length})</div>
      </div>
      ${sortedUsers.map(user => this.renderTeamMember(user)).join('')}

      <div class="section-header mt-4">
        <div class="section-title">💬 الدردشة</div>
      </div>
      <div class="chat-container">
        <div class="chat-messages" id="chatMessages">
          ${messages.length > 0 ? messages.slice(-20).map(msg => this.renderMessage(msg, currentUser.id)).join('') : `
            <div class="empty-state" style="padding:20px;">
              <div class="empty-state-icon">💬</div>
              <div class="empty-state-text">لا توجد رسائل بعد</div>
            </div>
          `}
        </div>
        <div class="chat-input-bar">
          <input type="text" id="chatInput" placeholder="اكتب رسالتك..." maxlength="500" />
          <button class="btn btn-primary" onclick="window.app.components.team.sendMessage()">إرسال</button>
        </div>
      </div>
    `;

    // Scroll to bottom
    const chatEl = document.getElementById('chatMessages');
    chatEl.scrollTop = chatEl.scrollHeight;
    
    // Focus input
    document.getElementById('chatInput').focus();
  }

  renderTeamMember(user) {
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${getRoleEmoji(user.role)} ${escapeHtml(user.name)}</div>
          <div class="badge" style="background:${getRoleColor(user.role)};color:white;">${getRoleLabel(user.role)}</div>
        </div>
        <div class="card-body">
          <div>${user.email}</div>
        </div>
      </div>
    `;
  }

  renderMessage(message, currentUserId) {
    const isOwn = message.senderId === currentUserId;
    const sender = window.stateManager.getUserById(message.senderId);
    const senderName = sender ? sender.name : 'غير معروف';
    
    return `
      <div class="chat-message ${isOwn ? 'own' : 'other'}">
        <div class="chat-sender">${isOwn ? 'أنت' : senderName}</div>
        <div class="chat-bubble">${escapeHtml(message.text)}</div>
        <div class="chat-time">${formatTime(message.timestamp)}</div>
      </div>
    `;
  }

  async sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text) return;
    if (text.length > 500) {
      window.app.showToast('الرسالة طويلة جداً (الحد الأقصى 500 حرف)', 'error');
      return;
    }

    try {
      const currentUser = window.stateManager.getCurrentUser();
      const message = {
        text,
        timestamp: new Date().toISOString(),
        senderId: currentUser.id,
        senderName: currentUser.name
      };

      await window.stateManager.addItem('teamMessages', message);
      input.value = '';
      input.focus();
    } catch (err) {
      console.error('Message send error:', err);
      window.app.showToast('فشل الإرسال: ' + (err.message || ''), 'error');
    }
  }

  handleSearch(query) {
    if (!query) return;
    // This will be handled by the main render
  }
}