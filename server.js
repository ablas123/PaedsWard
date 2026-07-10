// CoreWard - Backend Server (Fixed: Permissions)

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_BACKUPS = 10;

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_DATA = {
  users: [
    {
      id: 'u_admin',
      name: 'مدير النظام',
      email: 'admin@ward.com',
      password: bcrypt.hashSync('admin123', 10),
      role: 'director',
      createdAt: new Date().toISOString()
    }
  ],
  patients: [],
  tasks: [],
  handovers: [],
  clinicSlots: [],
  teamMembers: [],
  teamMessages: [],
  auditLog: [],
  alerts: [],
  syncQueue: []
};

const ROLES = {
  director: ['manage_users', 'manage_patients', 'manage_tasks', 'manage_handovers', 'add_alert', 'view_reports', 'view_audit', 'manage_clinic', 'manage_team', 'discharge_patient', 'create_tasks', 'update_vitals', 'write_notes', 'admit_patients', 'view_patients', 'view_assigned_patients', 'create_handovers', 'complete_tasks'],
  specialist: ['view_patients', 'discharge_patient', 'create_tasks', 'update_vitals', 'write_notes', 'view_reports', 'view_assigned_patients', 'create_handovers'],
  deputy: ['view_patients', 'discharge_patient', 'create_tasks', 'update_vitals', 'write_notes', 'view_reports', 'view_assigned_patients', 'create_handovers'],
  general: ['admit_patients', 'write_notes', 'view_patients', 'create_handovers', 'add_alert', 'view_assigned_patients'],
  intern: ['admit_patients', 'write_notes', 'view_assigned_patients', 'complete_tasks']
};

function hasPermission(role, permission) {
  const perms = ROLES[role] || [];
  return perms.includes(permission);
}

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDB(DEFAULT_DATA);
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);
    Object.keys(DEFAULT_DATA).forEach(key => {
      if (!data[key]) data[key] = JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
    });
    return data;
  } catch (err) {
    console.error('❌ Error reading database:', err);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('❌ Error writing database:', err);
    return false;
  }
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num > 0 && isFinite(num);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function addAuditLog(user, action, details) {
  const db = readDB();
  const entry = {
    id: generateId('log'),
    timestamp: new Date().toISOString(),
    userId: user?.id || 'system',
    userName: user?.name || 'System',
    userRole: user?.role || 'system',
    action,
    details: typeof details === 'string' ? details : JSON.stringify(details)
  };
  db.auditLog.unshift(entry);
  if (db.auditLog.length > 1000) db.auditLog = db.auditLog.slice(0, 1000);
  writeDB(db);
  return entry;
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function createBackup() {
  try {
    ensureBackupDir();
    if (!fs.existsSync(DB_PATH)) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
    fs.copyFileSync(DB_PATH, backupPath);

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();

    files.slice(MAX_BACKUPS).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) { /* ignore */ }
    });

    console.log(`✅ Backup created: ${backupPath}`);
  } catch (err) {
    console.error('❌ Backup failed:', err);
  }
}

function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  if (!userId || !userRole) {
    return res.status(401).json({ error: 'Unauthorized: missing credentials' });
  }
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.role !== userRole) return res.status(403).json({ error: 'Role mismatch' });
  req.user = user;
  next();
}

app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    addAuditLog(user, 'login', 'User logged in');
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/state', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    res.json({
      patients: db.patients || [],
      tasks: db.tasks || [],
      handovers: db.handovers || [],
      clinicSlots: db.clinicSlots || [],
      teamMembers: db.teamMembers || [],
      teamMessages: db.teamMessages || [],
      auditLog: db.auditLog || [],
      alerts: db.alerts || [],
      users: (db.users || []).map(sanitizeUser)
    });
  } catch (err) {
    console.error('State error:', err);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

app.post('/api/sync', authMiddleware, (req, res) => {
  try {
    const { collection, action, item, id, updates } = req.body;
    if (!collection || !action) {
      return res.status(400).json({ error: 'Missing collection or action' });
    }

    const db = readDB();
    if (!db[collection]) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    // FIXED: Improved permission checking
    const permMap = {
      patients: { add: 'admit_patients', update: 'manage_patients', delete: 'manage_patients' },
      tasks: { add: 'create_tasks', update: 'complete_tasks', delete: 'manage_tasks' },
      handovers: { add: 'create_handovers', update: 'manage_handovers', delete: 'manage_handovers' },
      clinicSlots: { add: 'manage_clinic', update: 'manage_clinic', delete: 'manage_clinic' },
      teamMessages: { add: 'manage_team', update: 'manage_team', delete: 'manage_team' },
      alerts: { add: 'add_alert', update: 'add_alert', delete: 'add_alert' }
    };

    const requiredPerm = permMap[collection]?.[action];
    if (requiredPerm && !hasPermission(req.user.role, requiredPerm)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    let result;
    const now = new Date().toISOString();

    if (action === 'add') {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ error: 'Invalid item' });
      }
      const newItem = {
        ...item,
        id: item.id || generateId(collection.slice(0, 3)),
        createdAt: item.createdAt || now,
        updatedAt: now,
        createdBy: req.user.id
      };
      db[collection].push(newItem);
      result = newItem;
      addAuditLog(req.user, `add_${collection}`, `Added to ${collection}`);
    } else if (action === 'update') {
      if (!id || !updates) {
        return res.status(400).json({ error: 'Missing id or updates' });
      }
      const idx = db[collection].findIndex(x => x.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Item not found' });

      const serverTime = new Date(db[collection][idx].updatedAt || 0).getTime();
      const clientTime = new Date(updates.updatedAt || 0).getTime();

      if (serverTime > clientTime) {
        result = db[collection][idx];
      } else {
        db[collection][idx] = {
          ...db[collection][idx],
          ...updates,
          id: id,
          updatedAt: now,
          updatedBy: req.user.id
        };
        result = db[collection][idx];
      }
      addAuditLog(req.user, `update_${collection}`, `Updated ${id}`);
    } else if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const idx = db[collection].findIndex(x => x.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Item not found' });
      db[collection].splice(idx, 1);
      result = { success: true };
      addAuditLog(req.user, `delete_${collection}`, `Deleted ${id}`);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    writeDB(db);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

app.post('/api/users', authMiddleware, (req, res) => {
  try {
    if (!hasPermission(req.user.role, 'manage_users')) {
      return res.status(403).json({ error: 'Forbidden: Directors only' });
    }
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    if (!ROLES[role]) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const db = readDB();
    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const newUser = {
      id: generateId('u'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: bcrypt.hashSync(password, 10),
      role,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDB(db);

    addAuditLog(req.user, 'create_user', `Created user ${email}`);
    res.json({ success: true, user: sanitizeUser(newUser) });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/api/users', authMiddleware, (req, res) => {
  const db = readDB();
  res.json((db.users || []).map(sanitizeUser));
});

app.delete('/api/users/:id', authMiddleware, (req, res) => {
  try {
    if (!hasPermission(req.user.role, 'manage_users')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const db = readDB();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    const deleted = db.users.splice(idx, 1)[0];
    writeDB(db);
    addAuditLog(req.user, 'delete_user', `Deleted user ${deleted.email}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n🏥 CoreWard Server is running');
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`👤 Admin: admin@ward.com / admin123`);
  console.log(`📦 Node: ${process.version}\n`);

  ensureBackupDir();
  createBackup();
  setInterval(createBackup, BACKUP_INTERVAL_MS);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, creating final backup...');
  createBackup();
  process.exit(0);
});