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
//  API بسيط للمزامنة – يقرأ ويكتب ملف JSON بدلاً من قاعدة بيانات
//  (يقلل استهلاك الموارد بشكل كبير)
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
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// نقطة إيقاظ (Ping)
app.get('/api/ping', (req, res) => {
  res.json({ status: 'awake', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});