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
//  ملف البيانات (JSON) – قاعدة بيانات بسيطة
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

// ============================================================
//  نقاط نهاية التحديث الجزئي (PATCH) – لكل مجموعة
// ============================================================

// تحديث عنصر واحد في مجموعة معينة
app.patch('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  const updates = req.body;
  
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.status(404).json({ error: 'Data file not found' });
    }
    
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data[collection]) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    const item = data[collection].find(item => item.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // تحديث الحقول مع الحفاظ على updatedAt
    Object.assign(item, updates);
    item.updatedAt = Date.now();
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// إضافة عنصر جديد إلى مجموعة
app.post('/api/:collection', (req, res) => {
  const { collection } = req.params;
  const newItem = req.body;
  
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.status(404).json({ error: 'Data file not found' });
    }
    
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data[collection]) {
      data[collection] = [];
    }
    
    // التأكد من وجود id
    if (!newItem.id) {
      newItem.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
    newItem.updatedAt = Date.now();
    
    data[collection].push(newItem);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, item: newItem });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// حذف عنصر من مجموعة
app.delete('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.status(404).json({ error: 'Data file not found' });
    }
    
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data[collection]) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    const index = data[collection].findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    data[collection].splice(index, 1);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
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
  console.log(`🚀 PaedsWard Advanced Server running on port ${PORT}`);
  console.log(`📂 Data file: ${DATA_FILE}`);
  console.log(`📂 Backups: ${path.join(__dirname, 'backups')}`);
});