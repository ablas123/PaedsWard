const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ============================================================
//  1. قاعدة بيانات SQLite (مع Promises)
// ============================================================
const db = new sqlite3.Database('paedsward.db');

const run = promisify(db.run.bind(db));
const all = promisify(db.all.bind(db));
const exec = promisify(db.exec.bind(db));

// إنشاء الجداول
async function initDB() {
  await exec(`
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
}
initDB().catch(console.error);

// دوال مساعدة لتحويل القيم
const toBool = (v) => !!v;
const rowMapper = (row) => ({
  ...row,
  done: toBool(row.done),
  urgent: toBool(row.urgent),
  acknowledged: toBool(row.acknowledged),
  read: toBool(row.read)
});

// ============================================================
//  2. نقاط النهاية (API)
// ============================================================

// جلب كل البيانات دفعة واحدة
app.get('/api/state', async (req, res) => {
  try {
    const patients = (await all('SELECT * FROM patients')).map(rowMapper);
    const tasks = (await all('SELECT * FROM tasks')).map(rowMapper);
    const handovers = (await all('SELECT * FROM handovers')).map(rowMapper);
    const clinicSlots = (await all('SELECT * FROM clinicSlots')).map(rowMapper);
    const teamMessages = (await all('SELECT * FROM teamMessages')).map(rowMapper);
    res.json({ patients, tasks, handovers, clinicSlots, teamMessages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// تحديث مجموعة معينة (استبدال كامل)
app.post('/api/sync/:collection', async (req, res) => {
  const { collection } = req.params;
  const data = req.body;
  const valid = ['patients', 'tasks', 'handovers', 'clinicSlots', 'teamMessages'];
  if (!valid.includes(collection)) {
    return res.status(400).json({ error: 'Invalid collection' });
  }
  try {
    await run(`DELETE FROM ${collection}`);
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      const placeholders = columns.map(() => '?').join(',');
      const stmt = db.prepare(`INSERT INTO ${collection} (${columns.join(',')}) VALUES (${placeholders})`);
      for (const item of data) {
        const values = columns.map(col => item[col] !== undefined ? item[col] : null);
        await new Promise((resolve, reject) => {
          stmt.run(values, function(err) { if (err) reject(err); else resolve(); });
        });
      }
      stmt.finalize();
    }
    res.json({ success: true, count: data.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// نقطة إيقاظ (Ping)
app.get('/api/ping', (req, res) => {
  res.json({ status: 'awake', time: new Date().toISOString() });
});

// ============================================================
//  3. النسخ الاحتياطي التلقائي (كل 6 ساعات)
// ============================================================
if (!fs.existsSync('./backups')) fs.mkdirSync('./backups');

cron.schedule('0 */6 * * *', async () => {
  console.log('🔄 بدء النسخ الاحتياطي...');
  try {
    const patients = await all('SELECT * FROM patients');
    const tasks = await all('SELECT * FROM tasks');
    const handovers = await all('SELECT * FROM handovers');
    const clinicSlots = await all('SELECT * FROM clinicSlots');
    const teamMessages = await all('SELECT * FROM teamMessages');
    const state = { patients, tasks, handovers, clinicSlots, teamMessages, exportedAt: new Date().toISOString() };
    const filename = `backup_${Date.now()}.json`;
    const filePath = path.join('./backups', filename);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    // احتفظ بآخر 10 نسخ
    const files = fs.readdirSync('./backups').sort();
    if (files.length > 10) {
      const toDelete = files.slice(0, files.length - 10);
      for (const f of toDelete) fs.unlinkSync(path.join('./backups', f));
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