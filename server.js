const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public')); // لتقديم ملفات الواجهة

// ============================================================
//  1. قاعدة بيانات SQLite (تكتب على القرص، لا تستهلك RAM)
// ============================================================
const db = new Database('paedsward.db');

// إنشاء الجداول (بنفس هيكل التطبيق)
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY, name TEXT, age REAL, weight REAL, bed TEXT,
    diagnosis TEXT, status TEXT, vitals TEXT, fluids TEXT, meds TEXT,
    notes TEXT, admissionDate TEXT, dischargeDate TEXT, updatedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, text TEXT, priority TEXT, assignee TEXT,
    done INTEGER DEFAULT 0, createdAt TEXT, updatedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS handovers (
    id TEXT PRIMARY KEY, date TEXT, author TEXT, situation TEXT,
    background TEXT, assessment TEXT, recommendation TEXT,
    urgent INTEGER DEFAULT 0, acknowledged INTEGER DEFAULT 0, updatedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS clinicSlots (
    id TEXT PRIMARY KEY, time TEXT, patientName TEXT, age INTEGER,
    reason TEXT, status TEXT, updatedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS teamMessages (
    id TEXT PRIMARY KEY, sender TEXT, text TEXT, time TEXT,
    read INTEGER DEFAULT 0, updatedAt INTEGER
  );
`);

// دوال مساعدة لتحويل القيم (Boolean <-> Integer)
const toBool = (v) => !!v;
const rowMapper = (row) => ({
  ...row,
  done: toBool(row.done),
  urgent: toBool(row.urgent),
  acknowledged: toBool(row.acknowledged),
  read: toBool(row.read)
});

// ============================================================
//  2. نقاط النهاية (API) - خفيفة وسريعة
// ============================================================

// جلب كل البيانات دفعة واحدة (لتقليل عدد الطلبات)
app.get('/api/state', (req, res) => {
  try {
    const state = {
      patients: db.prepare('SELECT * FROM patients').all().map(rowMapper),
      tasks: db.prepare('SELECT * FROM tasks').all().map(rowMapper),
      handovers: db.prepare('SELECT * FROM handovers').all().map(rowMapper),
      clinicSlots: db.prepare('SELECT * FROM clinicSlots').all().map(rowMapper),
      teamMessages: db.prepare('SELECT * FROM teamMessages').all().map(rowMapper)
    };
    res.json(state);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// استقبال التحديثات من الواجهة (كتابة على القرص)
app.post('/api/sync/:collection', (req, res) => {
  const { collection } = req.params;
  const data = req.body;
  
  // التحقق من صحة اسم المجموعة (أمان)
  const validCollections = ['patients', 'tasks', 'handovers', 'clinicSlots', 'teamMessages'];
  if (!validCollections.includes(collection)) {
    return res.status(400).json({ error: 'Invalid collection' });
  }

  try {
    // حذف القديم وإعادة الإدراج (حل تعارضات بسيط وفعال)
    db.prepare(`DELETE FROM ${collection}`).run();
    
    if (data.length > 0) {
      // الحصول على أسماء الأعمدة من أول عنصر
      const columns = Object.keys(data[0]);
      const placeholders = columns.map(() => '?').join(',');
      const insertStmt = db.prepare(`INSERT INTO ${collection} (${columns.join(',')}) VALUES (${placeholders})`);
      
      // استخدام المعاملات لتحسين الأداء
      const insertMany = db.transaction((items) => {
        for (const item of items) {
          const values = columns.map(col => item[col] !== undefined ? item[col] : null);
          insertStmt.run(values);
        }
      });
      
      insertMany(data);
    }
    
    res.json({ success: true, count: data.length });
  } catch (e) {
    console.error('Sync error:', e);
    res.status(500).json({ error: e.message });
  }
});

// نقطة إيقاظ (Ping) - لمنع النوم
app.get('/api/ping', (req, res) => {
  res.json({ status: 'awake', time: new Date().toISOString() });
});

// ============================================================
//  3. النسخ الاحتياطي التلقائي (كل 6 ساعات)
// ============================================================
if (!fs.existsSync('./backups')) fs.mkdirSync('./backups');

cron.schedule('0 */6 * * *', () => {
  console.log('🔄 بدء النسخ الاحتياطي التلقائي...');
  try {
    const state = {
      patients: db.prepare('SELECT * FROM patients').all(),
      tasks: db.prepare('SELECT * FROM tasks').all(),
      handovers: db.prepare('SELECT * FROM handovers').all(),
      clinicSlots: db.prepare('SELECT * FROM clinicSlots').all(),
      teamMessages: db.prepare('SELECT * FROM teamMessages').all(),
      exportedAt: new Date().toISOString()
    };
    
    const filename = `backup_${Date.now()}.json`;
    const filePath = path.join('./backups', filename);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    
    // الاحتفاظ بآخر 10 نسخ فقط (توفير المساحة)
    const files = fs.readdirSync('./backups').sort();
    if (files.length > 10) {
      const toDelete = files.slice(0, files.length - 10);
      for (const f of toDelete) {
        fs.unlinkSync(path.join('./backups', f));
      }
    }
    console.log('✅ تم حفظ النسخة:', filename);
  } catch (e) {
    console.error('❌ فشل النسخ الاحتياطي:', e);
  }
});

// ============================================================
//  4. تشغيل الخادم
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📂 Database: ${path.resolve('paedsward.db')}`);
  console.log(`📂 Backups: ${path.resolve('./backups')}`);
});
