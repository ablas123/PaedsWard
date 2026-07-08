// ================================================================
//  constants.js – الثوابت العامة (ROLES, Permissions, Helpers)
// ================================================================

// ─── تعريف الأدوار والصلاحيات (RBAC) ───
export const ROLES = {
  senior: [
    'view_all', 'manage_team', 'discharge', 'approve_plan',
    'view_reports', 'create_task', 'view_patients', 'admit',
    'write_notes', 'update_vitals', 'create_handover'
  ],
  junior: [
    'admit', 'write_notes', 'complete_tasks', 'create_handover',
    'view_patients', 'update_vitals'
  ],
  nurse: [
    'update_vitals', 'view_patients', 'complete_tasks'
  ],
  admin: [
    'manage_clinic', 'view_patients', 'send_alerts'
  ]
};

// ─── دوال مساعدة ───
export function hasPermission(role, permission) {
  return ROLES[role]?.includes(permission) || false;
}

export function getRoleLabel(role) {
  const map = { senior: 'استشاري', junior: 'طبيب مبتدئ', nurse: 'ممرض', admin: 'إداري' };
  return map[role] || role;
}

export function getRoleEmoji(role) {
  const map = { senior: '👨‍⚕️', junior: '🧑‍⚕️', nurse: '👩‍⚕️', admin: '📋' };
  return map[role] || '👤';
}

// ─── قائمة التبويبات (للاستخدام في Navigation) ───
export const TABS = [
  { id: 'dashboard', icon: '📊', label: 'الرئيسية' },
  { id: 'ward', icon: '🏥', label: 'الجناح' },
  { id: 'clinic', icon: '🩺', label: 'العيادة' },
  { id: 'tasks', icon: '📋', label: 'المهام' },
  { id: 'team', icon: '👥', label: 'الفريق' },
  { id: 'handover', icon: '📝', label: 'التسليم' },
  { id: 'reports', icon: '📊', label: 'التقارير' }
];