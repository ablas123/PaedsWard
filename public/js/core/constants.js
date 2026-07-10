// CoreWard - Constants & Configuration (Updated: new tabs)

const ROLES = {
  director: {
    label: 'مدير',
    emoji: '👑',
    color: '#8b5cf6',
    permissions: [
      'manage_users', 'manage_patients', 'manage_tasks', 'manage_handovers',
      'add_alert', 'view_reports', 'view_audit', 'manage_clinic', 'manage_team',
      'discharge_patient', 'create_tasks', 'update_vitals', 'write_notes',
      'admit_patients', 'view_patients', 'view_assigned_patients',
      'create_handovers', 'complete_tasks'
    ]
  },
  specialist: {
    label: 'استشاري',
    emoji: '👨‍⚕️',
    color: '#06b6d4',
    permissions: [
      'view_patients', 'discharge_patient', 'create_tasks', 'update_vitals',
      'write_notes', 'view_reports', 'view_assigned_patients', 'create_handovers'
    ]
  },
  deputy: {
    label: 'مساعد',
    emoji: '🩺',
    color: '#0891b2',
    permissions: [
      'view_patients', 'discharge_patient', 'create_tasks', 'update_vitals',
      'write_notes', 'view_reports', 'view_assigned_patients', 'create_handovers'
    ]
  },
  general: {
    label: 'طبيب عام',
    emoji: '💊',
    color: '#10b981',
    permissions: [
      'admit_patients', 'write_notes', 'view_patients', 'create_handovers',
      'add_alert', 'view_assigned_patients'
    ]
  },
  intern: {
    label: 'متدرب',
    emoji: '🎓',
    color: '#f59e0b',
    permissions: [
      'admit_patients', 'write_notes', 'view_assigned_patients', 'complete_tasks'
    ]
  }
};

function hasPermission(role, permission) {
  const roleData = ROLES[role];
  if (!roleData) return false;
  return roleData.permissions.includes(permission);
}

function getRoleLabel(role) {
  return ROLES[role]?.label || role;
}

function getRoleEmoji(role) {
  return ROLES[role]?.emoji || '👤';
}

function getRoleColor(role) {
  return ROLES[role]?.color || '#64748b';
}

// UPDATED: Added 'users' and 'alerts' tabs
const TABS = [
  { id: 'dashboard', icon: '📊', label: 'الرئيسية', permission: null },
  { id: 'ward',      icon: '🛏️', label: 'العنبر',  permission: 'view_patients' },
  { id: 'tasks',     icon: '✅', label: 'المهام',  permission: null },
  { id: 'clinic',    icon: '🏥', label: 'العيادة', permission: 'manage_clinic' },
  { id: 'handover',  icon: '📋', label: 'التسليم', permission: null },
  { id: 'team',      icon: '💬', label: 'الفريق',  permission: null },
  { id: 'alerts',    icon: '🔔', label: 'التنبيهات', permission: null },
  { id: 'users',     icon: '👥', label: 'المستخدمون', permission: 'manage_users' },
  { id: 'audit',     icon: '📝', label: 'السجل',   permission: 'view_audit' }
];

const PATIENT_STATUS = {
  stable:    { label: 'مستقر',    emoji: '✅', color: '#22c55e', class: 'stable' },
  followup:  { label: 'تحت المراقبة', emoji: '👁️', color: '#f59e0b', class: 'followup' },
  critical:  { label: 'حرج',      emoji: '🚨', color: '#e53935', class: 'critical' }
};

const TASK_PRIORITY = {
  high:   { label: 'عالية', emoji: '🔴', color: '#e53935' },
  medium: { label: 'متوسطة', emoji: '🟡', color: '#f59e0b' },
  low:    { label: 'منخفضة', emoji: '🟢', color: '#22c55e' }
};

const VITALS_RANGES = {
  hr:   { min: 70,  max: 150, unit: 'نبضة/د', label: 'النبض' },
  spo2: { min: 94,  max: 100, unit: '%',      label: 'التشبع' },
  temp: { min: 36.5, max: 37.5, unit: '°م',   label: 'الحرارة' },
  rr:   { min: 15,  max: 30,  unit: 'نَفَس/د', label: 'التنفس' },
  bp:   { min: 80,  max: 120, unit: 'mmHg',   label: 'الضغط' }
};

const DEFAULT_USERS = [
  {
    id: 'u_admin',
    name: 'مدير النظام',
    email: 'admin@ward.com',
    role: 'director'
  }
];

const DIAGNOSIS_SUGGESTIONS = {
  'حمى': ['التهاب فيروسي', 'التهاب بكتيري', 'إنفلونزا'],
  'سعال': ['التهاب شعبي', 'ربو', 'التهاب رئوي'],
  'إسهال': ['التهاب معدة', 'تسمم غذائي', 'عدوى فيروسية'],
  'ألم بطن': ['التهاب زائدة', 'مغص', 'إمساك'],
  'طفح': ['حساسية', 'جدري ماء', 'حصبة'],
  'صداع': ['جفاف', 'التهاب سحايا', 'صداع نصفي'],
  'قيء': ['التهاب معدة', 'ارتجاج', 'تسمم'],
  'ضيق تنفس': ['ربو', 'التهاب رئوي', 'خانوق']
};

const DISCHARGE_CHECKLIST = [
  'استقرار العلامات الحيوية لمدة 24 ساعة',
  'إكمال كورس العلاج المناسب',
  'تثقيف الأهل حول الرعاية المنزلية',
  'توصية المتابعة الخارجية',
  'تقرير طبي نهائي مُوقَّع'
];

function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function formatTime(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-EG', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function formatDateTime(dateString) {
  if (!dateString) return '—'; // FIXED: Added null check
  return `${formatDate(dateString)} ${formatTime(dateString)}`;
}

function timeAgo(dateString) {
  const d = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 2592000) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return formatDate(dateString);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function isTaskOverdue(task) {
  if (task.completed) return false;
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':');
    due.setHours(parseInt(h), parseInt(m));
  } else {
    due.setHours(23, 59, 59);
  }
  return new Date() > due;
}

function isTaskDueSoon(task) {
  if (task.completed || isTaskOverdue(task)) return false;
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':');
    due.setHours(parseInt(h), parseInt(m));
  }
  const diff = due - new Date();
  return diff > 0 && diff < 2 * 60 * 60 * 1000;
}

function analyzeVitals(vitals) {
  const warnings = [];
  if (!vitals) return warnings;

  Object.keys(VITALS_RANGES).forEach(key => {
    const value = Number(vitals[key]);
    if (isNaN(value)) return;
    const range = VITALS_RANGES[key];
    if (value < range.min) {
      warnings.push({
        type: 'low',
        vital: key,
        label: range.label,
        value,
        unit: range.unit,
        min: range.min,
        message: `${range.label} منخفض (${value} ${range.unit})`
      });
    } else if (value > range.max) {
      warnings.push({
        type: 'high',
        vital: key,
        label: range.label,
        value,
        unit: range.unit,
        max: range.max,
        message: `${range.label} مرتفع (${value} ${range.unit})`
      });
    }
  });

  return warnings;
}

function suggestDiagnoses(symptoms) {
  if (!symptoms || typeof symptoms !== 'string') return [];
  const lower = symptoms.toLowerCase();
  const suggestions = new Set();
  Object.keys(DIAGNOSIS_SUGGESTIONS).forEach(keyword => {
    if (lower.includes(keyword)) {
      DIAGNOSIS_SUGGESTIONS[keyword].forEach(d => suggestions.add(d));
    }
  });
  return Array.from(suggestions);
}

window.ROLES = ROLES;
window.TABS = TABS;
window.PATIENT_STATUS = PATIENT_STATUS;
window.TASK_PRIORITY = TASK_PRIORITY;
window.VITALS_RANGES = VITALS_RANGES;
window.DEFAULT_USERS = DEFAULT_USERS;
window.DISCHARGE_CHECKLIST = DISCHARGE_CHECKLIST;

window.hasPermission = hasPermission;
window.getRoleLabel = getRoleLabel;
window.getRoleEmoji = getRoleEmoji;
window.getRoleColor = getRoleColor;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatDateTime = formatDateTime;
window.timeAgo = timeAgo;
window.escapeHtml = escapeHtml;
window.generateId = generateId;
window.isTaskOverdue = isTaskOverdue;
window.isTaskDueSoon = isTaskDueSoon;
window.analyzeVitals = analyzeVitals;
window.suggestDiagnoses = suggestDiagnoses;