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

// ============================================================
//  ملف البيانات (JSON) – بديل عن قاعدة البيانات
//  يقلل استهلاك الموارد بشكل كبير
// ============================================================
const DATA_FILE = path.join(__dirname, 'data.json');

// قراءة البيانات
app.get('/api/state', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return res.json(data);
    }
    res.json({});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// حفظ البيانات
app.post('/api/sync', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true, timestamp: Date.now() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// نقطة إيقاظ (Ping)
app.get('/api/ping', (req, res) => {
  res.json({ status: 'awake', time: new Date().toISOString() });
});

// ============================================================
//  النسخ الاحتياطي التلقائي (كل 6 ساعات)
// ============================================================
if (!fs.existsSync('./backups')) fs.mkdirSync('./backups');

setInterval(() => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const filename = `backup_${Date.now()}.json`;
      const filePath = path.join('./backups', filename);
      fs.writeFileSync(filePath, data);
      
      // احتفظ بآخر 10 نسخ
      const files = fs.readdirSync('./backups').sort();
      if (files.length > 10) {
        const toDelete = files.slice(0, files.length - 10);
        for (const f of toDelete) fs.unlinkSync(path.join('./backups', f));
      }
      console.log('✅ تم حفظ النسخة:', filename);
    }
  } catch (e) {
    console.error('❌ فشل النسخ الاحتياطي:', e);
  }
}, 6 * 60 * 60 * 1000); // كل 6 ساعات

// ============================================================
//  تشغيل الخادم
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 PaedsWard Server running on port ${PORT}`);
  console.log(`📂 Data file: ${DATA_FILE}`);
  console.log(`📂 Backups: ${path.join(__dirname, 'backups')}`);
});