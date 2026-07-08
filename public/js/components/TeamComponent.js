// ================================================================
//  مكون الفريق (Team)
// ================================================================
import { getRoleLabel, getRoleEmoji } from '../core/constants.js';

class TeamComponent {
  constructor() {
    this.container = document.getElementById('appContent');
    this.tab = 'team';
    this.searchQuery = '';

    bus.on('switchTab', (tab) => { if (tab === this.tab) this.render(); });
    bus.on('render', () => { if (this.tab === 'team') this.render(); });
    bus.on('stateChanged', () => this.render());
    bus.on('search', (query) => {
      this.searchQuery = query;
      this.render();
    });
  }

  render() {
    const state = stateManager.get();
    let messages = state.teamMessages;

    if (this.searchQuery) {
      messages = messages.filter(m =>
        m.sender.includes(this.searchQuery) ||
        m.text.includes(this.searchQuery)
      );
    }

    let html = `
      <div class="flex-between mb-8">
        <h2 style="font-size:18px;">👥 الفريق</h2>
        <span class="text-muted">${state.teamMembers.length} أعضاء</span>
      </div>
      <div class="member-list">
        ${state.teamMembers.map(m => `
          <span class="member">
            ${getRoleEmoji(m.role)} ${m.name}
            <span class="role-tag">${getRoleLabel(m.role)}</span>
            ${m.role === state.currentRole ? '⭐' : ''}
          </span>
        `).join('')}
      </div>
      <div style="margin:10px 0;">
        <h3 style="font-size:14px;margin-bottom:4px;">💬 المحادثة</h3>
      </div>
    `;

    if (!messages.length) {
      html += `<div class="empty-state"><div class="emoji">💬</div><p>${this.searchQuery ? 'لا توجد نتائج بحث' : 'لا توجد رسائل'}</p></div>`;
    } else {
      messages.slice().reverse().forEach(m => {
        html += `
          <div class="message">
            <div class="flex-between">
              <span class="sender">${m.sender}</span>
              <span class="time">${m.time}</span>
            </div>
            <div class="text">${m.text}</div>
          </div>
        `;
      });
    }

    html += `
      <div style="display:flex;gap:6px;margin-top:6px;">
        <textarea id="teamMsgInput" placeholder="اكتب رسالة..." style="flex:1;min-height:40px;margin:0;"></textarea>
        <button onclick="team.sendMessage()" style="align-self:flex-end;">إرسال</button>
      </div>
    `;

    this.container.innerHTML = html;
  }

  sendMessage() {
    const input = document.getElementById('teamMsgInput');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    const state = stateManager.get();
    const sender = state.teamMembers.find(m => m.role === state.currentRole)?.name || getRoleLabel(state.currentRole);
    const newMsg = {
      id: 'temp_' + uid(),
      sender: sender,
      text: msg,
      time: timeNow(),
      read: false,
      updatedAt: Date.now()
    };

    state.teamMessages.push(newMsg);
    stateManager.save();
    stateManager.addToQueue('teamMessages', 'POST', newMsg, newMsg.id);

    input.value = '';
    bus.emit('render');
    showToast('💬 تم إرسال الرسالة', 'success');
  }
}

const team = new TeamComponent();
window.team = team;