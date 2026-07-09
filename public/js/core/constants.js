// ================================================================
//  constants.js – الثوابت العامة (ROLES, Permissions, Helpers)
// ================================================================

const ROLES = {
  director: [
    'view_all', 'manage_team', 'discharge', 'approve_plan',
    'view_reports', 'create_task', 'view_patients', 'admit',
    'write_notes', 'update_vitals', 'create_handover', 'manage_alerts'
  ],
  specialist: [
    'view_all', 'discharge', 'approve_plan', 'view_reports',
    'create_task', 'view_patients', 'admit', 'write_notes',
    'update_vitals', 'create_handover'
  ],
  deputy: [
    'view_all', 'discharge', 'approve_plan', 'view_reports',
    'create_task', 'view_patients', 'admit', 'write_notes',
    'update_vitals', 'create_handover'
  ],
  general: [
    'admit', 'write_notes', 'view_patients', 'create_handover', 'add_alert'
  ],
  intern: [
    'admit', 'write_notes', 'view_patients', 'complete_tasks'
  ]
};

function hasPermission(role, permission) {
  if (!role || !permission) return false;
  return ROLES[role]?.includes(permission) || false;
}

function getRoleLabel(role) {
  const map = {
    director: 'مدير',
    specialist: 'اختصاصي',
    deputy: 'نائب',
    general: 'عمومي',
    intern: 'طبيب امتياز'
  };
  return map[role] || role;
}

function getRoleEmoji(role) {
  const map = {
    director: '👨‍⚕️',
    specialist: '🩺',
    deputy: '👨‍⚕️',
    general: '🧑‍⚕️',
    intern: '👨‍🎓'
  };
  return map[role] || '👤';
}

const TABS = [
  { id: 'dashboard', icon: '📊', label: 'الرئيسية' },
  { id: 'ward', icon: '🏥', label: 'الجناح' },
  { id: 'clinic', icon: '🩺', label: 'العيادة' },
  { id: 'tasks', icon: '📋', label: 'المهام' },
  { id: 'team', icon: '👥', label: 'الفريق' },
  { id: 'handover', icon: '📝', label: 'التسليم' },
  { id: 'reports', icon: '📊', label: 'التقارير' }
];

const DEFAULT_USERS = [
  { email: 'admin@ward.com', password: 'admin123', role: 'director', name: 'د. المدير' },
  { email: 'specialist@ward.com', password: 'specialist123', role: 'specialist', name: 'د. الاختصاصي' },
  { email: 'intern@ward.com', password: 'intern123', role: 'intern', name: 'ط. الامتياز' }
];

window.ROLES = ROLES;
window.hasPermission = hasPermission;
window.getRoleLabel = getRoleLabel;
window.getRoleEmoji = getRoleEmoji;
window.TABS = TABS;
window.DEFAULT_USERS = DEFAULT_USERS;