// CoreWard - Backend Server
// Node.js + Express + File-based JSON Storage

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
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_BACKUPS = 10;

// ============ Middleware ============
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============ Default Data ============
const DEFAULT_DATA = {
  users: [
    {
      id: 'u1',
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

// ============ Database Helpers ============
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDB(DEFAULT_DATA);
      return DEFAULT_DATA;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('❌ Error reading database:', err);
    return DEFAULT_DATA;
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

// ============ Audit Log ============
function addAuditLog(user, action, details) {
  const db = readDB();
  const entry = {
    id: generateId('log'),
    timestamp: new Date().toISOString(),
    userId: user?.id || 'system',
    userName: user?.name || 'System',
    userRole: user?.role || 'system',
    action,
    details
  };
  db.auditLog.unshift(entry);
  if (db.auditLog.length > 1000) db.auditLog = db.auditLog.slice(0, 1000);
  writeDB(db);
  return entry;
}

// ============ Backup System ============
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

    // Keep only last MAX_BACKUPS
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();

    files.slice(MAX_BACKUPS).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) {}
    });

    console.log(`✅ Backup created: ${backupPath}`);
  } catch (err) {
    console.error('❌ Backup failed:', err);
  }
}

// ============ Auth Middleware ============
function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  if (!userId || !userRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  next();
}

// ============ Roles & Permissions ============
const ROLES = {
  director: ['manage_users', 'manage_patients', 'manage_tasks', 'manage_handovers', 'add_alert', 'view_reports', 'view_audit', 'manage_clinic', 'manage_team'],
  specialist: ['view_patients', 'discharge_patient', 'create_tasks', 'update_vitals', 'write_notes', 'view_reports'],
  deputy: ['view_patients', 'discharge_patient', 'create_tasks', 'update_vitals', 'write_notes', 'view_reports'],
  general: ['admit_patients', 'write_notes', 'view_patients', 'create_handovers', 'add_alert'],
  intern: ['admit_patients', 'write_notes', 'view_assigned_patients', 'complete_tasks']
};

function hasPermission(role, permission) {
  const perms = ROLES[role] || [];
  return perms.includes(permission) || role === 'director';
}

// ============ API Routes ============

// Ping (keep-alive)
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Login
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

    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get full state (for sync)
app.get('/api/state', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const { users, password, ...safeUsers } = { users: db.users.map(u => { const { password: _, ...rest } = u; return rest; }) };
    res.json({
      patients: db.patients,
      tasks: db.tasks,
      handovers: db.handovers,
      clinicSlots: db.clinicSlots,
      teamMembers: db.teamMembers,
      teamMessages: db.teamMessages,
      auditLog: db.auditLog,
      alerts: db.alerts,
      users: db.users.map(u => { const { password: _, ...rest } = u; return rest; })
    });
  } catch (err) {
    console.error('State error:', err);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

// Sync (receive client changes)
app.post('/api/sync', authMiddleware, (req, res) => {
  try {
    const { collection, action, item, id, updates } = req.body;
    const db = readDB();

    if (!db[collection]) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    let result;
    const now = new Date().toISOString();

    if (action === 'add') {
      const newItem = { ...item, id: item.id || generateId(collection.slice(0, 3)), createdAt: now, updatedAt: now, createdBy: req.user.id };
      db[collection].push(newItem);
      result = newItem;
      addAuditLog(req.user, `add_${collection}`, `Added to ${collection}`);
    } else if (action === 'update') {
      const idx = db[collection].findIndex(x => x.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Item not found' });

      // Conflict resolution: server wins if newer
      const serverTime = new Date(db[collection][idx].updatedAt || 0).getTime();
      const clientTime = new Date(updates.updatedAt || 0).getTime();

      if (serverTime > clientTime) {
        result = db[collection][idx];
      } else {
        db[collection][idx] = { ...db[collection][idx], ...updates, updatedAt: now, updatedBy: req.user.id };
        result = db[collection][idx];
      }
      addAuditLog(req.user, `update_${collection}`, `Updated ${id}`);
    } else if (action === 'delete') {
      const idx = db[collection].findIndex(x => x.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Item not found' });
      db[collection].splice(idx, 1);
      result = { success: true };
      addAuditLog(req.user, `delete_${collection}`, `Deleted ${id}`);
    }

    writeDB(db);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Create user (Director only)
app.post('/api/users', authMiddleware, (req, res) => {
  try {
    if (!hasPermission(req.user.role, 'manage_users')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (password.length < 4) {
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
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDB(db);

    addAuditLog(req.user, 'create_user', `Created user ${email}`);

    const { password: _, ...safeUser } = newUser;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// List users
app.get('/api/users', authMiddleware, (req, res) => {
  const db = readDB();
  res.json(db.users.map(u => { const { password: _, ...rest } = u; return rest; }));
});

// Catch-all for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`\n🏥 CoreWard Server is running on port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`👤 Admin: admin@ward.com / admin123\n`);

  // Initial backup
  ensureBackupDir();
  createBackup();

  // Schedule backups
  setInterval(createBackup, BACKUP_INTERVAL_MS);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, creating final backup...');
  createBackup();
  process.exit(0);
}); 