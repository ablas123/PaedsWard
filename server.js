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

const DATA_FILE = path.join(__dirname, 'data.json');

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

app.patch('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  const updates = req.body;
  try {
    if (!fs.existsSync(DATA_FILE)) throw new Error('Data file not found');
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data[collection]) throw new Error('Collection not found');
    const item = data[collection].find(item => item.id === id);
    if (!item) throw new Error('Item not found');
    Object.assign(item, updates);
    item.updatedAt = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/:collection', (req, res) => {
  const { collection } = req.params;
  const newItem = req.body;
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}));
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data[collection]) data[collection] = [];
    if (!newItem.id) newItem.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    newItem.updatedAt = Date.now();
    data[collection].push(newItem);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, item: newItem });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  try {
    if (!fs.existsSync(DATA_FILE)) throw new Error('Data file not found');
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data[collection]) throw new Error('Collection not found');
    const index = data[collection].findIndex(item => item.id === id);
    if (index === -1) throw new Error('Item not found');
    data[collection].splice(index, 1);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ping', (req, res) => {
  res.json({ status: 'awake', time: new Date().toISOString() });
});

if (!fs.existsSync('./backups')) fs.mkdirSync('./backups');
setInterval(() => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const filename = `backup_${Date.now()}.json`;
      fs.writeFileSync(path.join('./backups', filename), data);
      const files = fs.readdirSync('./backups').sort();
      if (files.length > 10) {
        const toDelete = files.slice(0, files.length - 10);
        for (const f of toDelete) fs.unlinkSync(path.join('./backups', f));
      }
      console.log('✅ نسخ احتياطي:', filename);
    }
  } catch (e) { console.error('❌ فشل النسخ:', e); }
}, 6 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 PaedsWard PRO running on port ${PORT}`);
  console.log(`📂 Data: ${DATA_FILE}`);
  console.log(`📂 Backups: ${path.join(__dirname, 'backups')}`);
});