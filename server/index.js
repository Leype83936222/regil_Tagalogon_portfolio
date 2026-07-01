import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { getDb, seedFromJson, getFullData, saveFullData } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const assetsDir = path.join(rootDir, 'public', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

app.use('/assets', express.static(assetsDir));

const db = getDb();
const dataJsonPath = path.join(rootDir, 'public', 'data.json');
seedFromJson(dataJsonPath);

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!admin) return res.json({ success: false, message: 'No admin configured' });

  const hash = crypto.createHash('sha256').update(password + admin.salt).digest('hex');
  if (email.toLowerCase().trim() === admin.username.toLowerCase().trim() && hash === admin.passwordHash) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid email or password' });
  }
});

app.post('/api/auth/setup', (req, res) => {
  const { email, password } = req.body;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');

  db.prepare('INSERT OR REPLACE INTO admin (id, username, passwordHash, salt) VALUES (1, ?, ?, ?)').run(email, hash, salt);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('setup', 'true')").run();
  res.json({ success: true, message: 'Admin configured' });
});

app.post('/api/auth/change-password', (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!admin) return res.status(400).json({ success: false, message: 'No admin' });

  const hash = crypto.createHash('sha256').update(currentPassword + admin.salt).digest('hex');
  if (hash !== admin.passwordHash) return res.json({ success: false, message: 'Current password incorrect' });

  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = crypto.createHash('sha256').update(newPassword + newSalt).digest('hex');
  db.prepare('UPDATE admin SET username = ?, passwordHash = ?, salt = ? WHERE id = 1').run(email, newHash, newSalt);
  res.json({ success: true });
});

app.get('/api/data', (req, res) => {
  try {
    res.json(getFullData());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data', (req, res) => {
  try {
    saveFullData(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/save-metadata', (req, res) => {
  try {
    saveFullData(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const storage = multer.diskStorage({
  destination: assetsDir,
  filename: (req, file, cb) => {
    const uniqueName = `${crypto.randomUUID()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    cb(null, validTypes.includes(file.mimetype));
  }
});

app.post('/api/upload', (req, res) => {
  const queryUrl = new URL(req.url, `http://${req.headers.host}`);
  const filename = queryUrl.searchParams.get('filename');

  if (filename) {
    const filepath = path.join(assetsDir, filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
    const writeStream = fs.createWriteStream(filepath);
    req.pipe(writeStream);
    writeStream.on('finish', () => {
      res.json({ path: `./assets/${path.basename(filepath)}` });
    });
    writeStream.on('error', () => {
      res.status(500).json({ error: 'Upload failed' });
    });
  } else {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file provided' });
      res.json({ path: `./assets/${req.file.filename}` });
    });
  }
});

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Portfolio backend running on http://localhost:${PORT}`);
});
