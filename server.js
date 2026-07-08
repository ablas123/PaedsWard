const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const DB_FILE = path.join(__dirname, 'database.json');
let db = null;
let dbLock = false;

// ============================================================
//  إدارة قاعدة البيانات (JSON) مع قفل ذكي
// ============================================================
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } else {
      db = {
        patients: [],
        tasks: [],
        handovers: [],
        clinicSlots: [],
        teamMessages: [],
        teamMembers: [
          { id: 'u1', name: 'د. أحمد', role: 'senior' },
          { id: 'u2', name: 'د. سارة', role: 'junior' },
          { id: 'u3', name: 'م. ليلى', role: 'nurse' }
        ],
        auditLog: [],
        _version: '7.0.0'
      };
      saveDatabase();
    }
  } catch (e) {
    console.error('❌ فشل تحميل قاعدة البيانات:', e);
    db = { patients: [], tasks: [], handovers: [], clinicSlots: [], teamMessages: [], teamMembers: [], auditLog: [] };
  }
}

function saveDatabase() {
  if (dbLock) return;
  dbLock = true;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('❌ فشل حفظ قاعدة البيانات:', e);
  } finally {
    dbLock = false;
  }
}

// ============================================================
//  نظام الصلاحيات (RBAC)
// ============================================================
const ROLES = {
  senior: ['view_all', 'manage_team', 'discharge', 'approve_plan', 'view_reports', 'create_task', 'view_patients'],
  junior: ['admit', 'write_notes', 'complete_tasks', 'create_handover', 'view_patients', 'update_vitals'],
  nurse: ['update_vitals', 'view_patients', 'complete_tasks'],
  admin: ['manage_clinic', 'view_patients', 'send_alerts']
};

function hasPermission(role, permission) {
  return ROLES[role] && ROLES[role].includes(permission);
}

function getRoleFromHeaders(req) {
  return req.headers['x-user-role'] || 'junior';
}

function getUserName(req) {
  return req.headers['x-user-name'] || 'مستخدم مجهول';
}

// ============================================================
//  سجل التدقيق الأمني (Audit Log)
// ============================================================
function addAuditLog(action, details, req) {
  const role = getRoleFromHeaders(req);
  const name = getUserName(req);
  db.auditLog.push({
    timestamp: new Date().toISOString(),
    user: name,
    role: role,
    action: action,
    details: details,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  });
  if (db.auditLog.length > 500) db.auditLog = db.auditLog.slice(-500);
  saveDatabase();
}

// ============================================================
//  نقاط النهاية (API)
// ============================================================

app.get('/api/state', (req, res) => {
  loadDatabase();
  res.json(db);
});

app.post('/api/:collection', (req, res) => {
  const { collection } = req.params;
  const newItem = req.body;
  const role = getRoleFromHeaders(req);

  if (collection === 'patients' && !hasPermission(role, 'admit')) {
    return res.status(403).json({ error: 'غير مصرح لك بقبول مرضى' });
  }
  if (collection === 'tasks' && !hasPermission(role, 'create_task')) {
    return res.status(403).json({ error: 'غير مصرح لك بإنشاء مهام' });
  }
  if (collection === 'handovers' && !hasPermission(role, 'create_handover')) {
    return res.status(403).json({ error: 'غير مصرح لك بإنشاء تسليم' });
  }
  if (collection === 'clinicSlots' && !hasPermission(role, 'manage_clinic')) {
    return res.status(403).json({ error: 'غير مصرح لك بإدارة العيادة' });
  }

  loadDatabase();
  if (!db[collection]) db[collection] = [];
  if (!newItem.id) newItem.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  newItem.updatedAt = Date.now();
  db[collection].push(newItem);
  saveDatabase();

  addAuditLog(`إضافة ${collection}`, `تم إضافة عنصر جديد: ${newItem.id}`, req);
  res.status(201).json({ success: true, item: newItem });
});

app.patch('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  const updates = req.body;
  const role = getRoleFromHeaders(req);

  if (collection === 'patients' && !hasPermission(role, 'view_patients')) {
    return res.status(403).json({ error: 'غير مصرح لك بتحديث بيانات المرضى' });
  }

  loadDatabase();
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const item = db[collection].find(item => item.id === id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  Object.assign(item, updates);
  item.updatedAt = Date.now();
  saveDatabase();

  addAuditLog(`تحديث ${collection}`, `تم تحديث عنصر: ${id}`, req);
  res.json({ success: true, item });
});

app.delete('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  const role = getRoleFromHeaders(req);

  if (collection === 'patients' && !hasPermission(role, 'discharge')) {
    return res.status(403).json({ error: 'غير مصرح لك بحذف مرضى' });
  }
  if (collection === 'tasks' && !hasPermission(role, 'create_task')) {
    return res.status(403).json({ error: 'غير مصرح لك بحذف مهام' });
  }
  if (collection === 'handovers' && !hasPermission(role, 'create_handover')) {
    return res.status(403).json({ error: 'غير مصرح لك بحذف تسليم' });
  }

  loadDatabase();
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const index = db[collection].findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });

  const deleted = db[collection][index];
  db[collection].splice(index, 1);
  saveDatabase(); // 🔥 إصلاح الحذف: حفظ التغيير على القرص

  addAuditLog(`حذف ${collection}`, `تم حذف عنصر: ${id} (${deleted.name || deleted.text || ''})`, req);
  res.json({ success: true });
});

app.get('/api/ping', (req, res) => {
  res.json({ status: 'awake', time: new Date().toISOString() });
});

// ============================================================
//  نسخ احتياطي تلقائي كل 6 ساعات
// ============================================================
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

setInterval(() => {
  loadDatabase();
  const filename = `backup_${Date.now()}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(db, null, 2));
  const files = fs.readdirSync(BACKUP_DIR).sort();
  if (files.length > 10) {
    const toDelete = files.slice(0, files.length - 10);
    for (const f of toDelete) fs.unlinkSync(path.join(BACKUP_DIR, f));
  }
  console.log('✅ نسخ احتياطي:', filename);
}, 6 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  loadDatabase();
  console.log(`🚀 PaedsWard PRO running on port ${PORT}`);
  console.log(`📂 Database: ${DB_FILE}`);
  console.log(`📂 Backups: ${BACKUP_DIR}`);
});