// CoreWard - User Management Component (Fixed: no duplicates)

class UserManagement {
  constructor() {
    this.container = document.getElementById('appMain');
    this.bindEvents();
  }

  bindEvents() {
    EventBus.on('stateChanged', () => this.render());
  }

  render() {
    const currentUser = window.stateManager.getCurrentUser();
    
    if (!hasPermission(currentUser.role, 'manage_users')) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔒</div>
          <div class="empty-state-text">ليس لديك صلاحية الوصول إلى هذه الصفحة</div>
        </div>
      `;
      return;
    }

    const users = window.stateManager.getUsers();
    
    // Stats
    const roleCounts = {};
    Object.keys(ROLES).forEach(role => {
      roleCounts[role] = users.filter(u => u.role === role).length;
    });

    this.container.innerHTML = `
      <div class="stats-grid">
        ${Object.keys(ROLES).map(role => `
          <div class="stat-card" style="border-top-color:${getRoleColor(role)};">
            <div class="stat-value">${roleCounts[role] || 0}</div>
            <div class="stat-label">${getRoleEmoji(role)} ${getRoleLabel(role)}</div>
          </div>
        `).join('')}
      </div>

      <div class="section-header">
        <div class="section-title">👥 جميع المستخدمين (${users.length})</div>
        <button class="btn btn-primary" onclick="window.app.components.users.showAddForm()">+ إضافة مستخدم</button>
      </div>
      ${users.map(user => this.renderUser(user, currentUser.id)).join('')}
    `;
  }

  renderUser(user, currentUserId) {
    const isCurrentUser = user.id === currentUserId;
    
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${getRoleEmoji(user.role)} ${escapeHtml(user.name)}</div>
            <div class="card-subtitle">${escapeHtml(user.email)}</div>
          </div>
          <div class="badge" style="background:${getRoleColor(user.role)};color:white;">${getRoleLabel(user.role)}</div>
        </div>
        <div class="card-body">
          <div>تاريخ الإنشاء: ${formatDate(user.createdAt)}</div>
          ${isCurrentUser ? '<div style="color:var(--primary);font-size:12px;margin-top:4px;">👤 أنت</div>' : ''}
        </div>
        ${!isCurrentUser ? `
          <div class="card-footer">
            <button class="btn btn-sm btn-danger" onclick="window.app.components.users.deleteUser('${user.id}', '${escapeHtml(user.name)}')">حذف</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  showAddForm() {
    const roleOptions = Object.keys(ROLES).map(role => 
      `<option value="${role}">${getRoleEmoji(role)} ${getRoleLabel(role)}</option>`
    ).join('');

    const form = `
      <div class="form-group">
        <label>الاسم الكامل</label>
        <input type="text" id="userName" required placeholder="أدخل الاسم الكامل" />
      </div>
      <div class="form-group">
        <label>البريد الإلكتروني</label>
        <input type="email" id="userEmail" required placeholder="example@ward.com" />
      </div>
      <div class="form-group">
        <label>كلمة المرور</label>
        <input type="password" id="userPassword" required minlength="4" placeholder="4 أحرف على الأقل" />
      </div>
      <div class="form-group">
        <label>الدور</label>
        <select id="userRole" required>
          ${roleOptions}
        </select>
      </div>
    `;

    window.app.showModal('إضافة مستخدم جديد', form, `
      <button class="btn btn-secondary" onclick="window.app.components.users.closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="window.app.components.users.saveUser()">حفظ</button>
    `);
  }

  async saveUser() {
    try {
      const name = document.getElementById('userName').value.trim();
      const email = document.getElementById('userEmail').value.trim();
      const password = document.getElementById('userPassword').value;
      const role = document.getElementById('userRole').value;

      if (!name || !email || !password || !role) {
        window.app.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }

      if (password.length < 4) {
        window.app.showToast('كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'error');
        return;
      }

      const currentUser = window.stateManager.getCurrentUser();
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');

      // FIXED: Don't add to local state manually. Just sync from server.
      await window.stateManager.syncFullState();
      
      window.app.showToast('تم إنشاء المستخدم بنجاح!', 'success');
      this.closeModal();
    } catch (err) {
      console.error('User save error:', err);
      window.app.showToast('فشل الحفظ: ' + (err.message || ''), 'error');
    }
  }

  async deleteUser(id, name) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${name}"؟`)) return;

    try {
      const currentUser = window.stateManager.getCurrentUser();
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      // FIXED: Don't delete from local state manually. Just sync from server.
      await window.stateManager.syncFullState();
      
      window.app.showToast('تم حذف المستخدم!', 'success');
    } catch (err) {
      console.error('User delete error:', err);
      window.app.showToast('فشل الحذف: ' + (err.message || ''), 'error');
    }
  }

  closeModal() {
    document.getElementById('modalContainer').classList.remove('active');
    setTimeout(() => document.getElementById('modalContainer').innerHTML = '', 300);
  }
}