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
          { id: 'u1', name: 'د. أحمد', role: 'director' },
          { id: 'u2', name: 'د. سارة', role: 'specialist' },
          { id: 'u3', name: 'د. خالد', role: 'deputy' },
          { id: 'u4', name: 'م. ليلى', role: 'general' },
          { id: 'u5', name: 'م. نور', role: 'intern' }
        ],
        auditLog: [],
        _version: '1.0.0'
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
//  RBAC – الأدوار والصلاحيات (متوافق مع العميل)
// ============================================================
const ROLES = {
  director: ['view_all', 'manage_team', 'discharge', 'approve_plan', 'view_reports', 'create_task', 'view_patients', 'admit', 'write_notes', 'update_vitals', 'create_handover', 'manage_alerts'],
  specialist: ['view_all', 'discharge', 'approve_plan', 'view_reports', 'create_task', 'view_patients', 'admit', 'write_notes', 'update_vitals', 'create_handover'],
  deputy: ['view_all', 'discharge', 'approve_plan', 'view_reports', 'create_task', 'view_patients', 'admit', 'write_notes', 'update_vitals', 'create_handover'],
  general: ['admit', 'write_notes', 'view_patients', 'create_handover', 'add_alert'],
  intern: ['admit', 'write_notes', 'view_patients', 'complete_tasks']
};

function hasPermission(role, permission) {
  return ROLES[role] && ROLES[role].includes(permission);
}

function getRoleFromHeaders(req) {
  return req.headers['x-user-role'] || 'intern';
}

function getUserName(req) {
  return req.headers['x-user-name'] || 'مستخدم مجهول';
}

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

  const permMap = {
    patients: 'admit',
    tasks: 'create_task',
    handovers: 'create_handover',
    clinicSlots: 'manage_clinic',
    teamMessages: 'send_alerts'
  };
  const requiredPerm = permMap[collection];
  if (requiredPerm && !hasPermission(role, requiredPerm)) {
    return res.status(403).json({ error: 'غير مصرح لك بهذه العملية' });
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

  loadDatabase();
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const index = db[collection].findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });

  const deleted = db[collection][index];
  db[collection].splice(index, 1);
  saveDatabase();

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
  console.log(`🚀 CoreWard running on port ${PORT}`);
  console.log(`📂 Database: ${DB_FILE}`);
  console.log(`📂 Backups: ${BACKUP_DIR}`);
});