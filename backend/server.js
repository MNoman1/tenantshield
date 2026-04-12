'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'uae_tenancy_super_secret_jwt_2026_change_in_prod';
const DB_PATH = path.join(__dirname, 'db.json');

// ─── Pure-JS JSON database ───────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const init = { users: [], sessions: [], drafts: [], activities: [], messages: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─── Encryption helpers (AES-256-GCM) ────────────────────────────────────────
// Each user gets a derived key from their password hash + a server salt.
// Data is encrypted before storage; only the authenticated user can decrypt.
const SERVER_SALT = 'uae_tenancy_server_salt_v1';

function deriveKey(userPasswordHash) {
  return crypto.scryptSync(userPasswordHash + SERVER_SALT, 'salt_v1', 32);
}

function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decrypt(data, key) {
  try {
    const [ivHex, tagHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many requests' } });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 60, message: { error: 'Rate limit exceeded' } });

// ─── JWT auth middleware ──────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.userId;
    req.encKey = Buffer.from(payload.encKey, 'hex');
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

// ─── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

  const db = readDB();
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const encKey = deriveKey(passwordHash);

  db.users.push({ id: userId, email: email.toLowerCase(), passwordHash, name, createdAt: new Date().toISOString(), plan: 'free', emirate: 'dubai' });
  writeDB(db);

  const token = jwt.sign({ userId, encKey: encKey.toString('hex') }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: userId, email, name, plan: 'free', emirate: 'dubai' } });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = readDB();
  const user = db.users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const encKey = deriveKey(user.passwordHash);
  const token = jwt.sign({ userId: user.id, encKey: encKey.toString('hex') }, JWT_SECRET, { expiresIn: '7d' });

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan, emirate: user.emirate } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, name: user.name, plan: user.plan, emirate: user.emirate });
});

app.patch('/api/auth/emirate', requireAuth, (req, res) => {
  const { emirate } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (user) { user.emirate = emirate; writeDB(db); }
  res.json({ ok: true });
});

// ─── Messages / Chat history ──────────────────────────────────────────────────
app.get('/api/messages', requireAuth, apiLimiter, (req, res) => {
  const db = readDB();
  const msgs = db.messages.filter(m => m.userId === req.userId).slice(-100);
  const decrypted = msgs.map(m => ({
    ...m,
    content: decrypt(m.content, req.encKey)
  })).filter(m => m.content !== null);
  res.json(decrypted);
});

app.post('/api/messages', requireAuth, apiLimiter, (req, res) => {
  const { role, content, tool } = req.body;
  if (!role || !content) return res.status(400).json({ error: 'Missing fields' });

  const db = readDB();
  const msg = {
    id: uuidv4(),
    userId: req.userId,
    role,
    content: encrypt(content, req.encKey),
    tool: tool || 'chat',
    createdAt: new Date().toISOString()
  };
  db.messages.push(msg);
  // Keep only last 500 messages per user
  db.messages = db.messages.filter(m => m.userId !== req.userId).concat(
    db.messages.filter(m => m.userId === req.userId).slice(-500)
  );
  writeDB(db);
  res.json({ id: msg.id, createdAt: msg.createdAt });
});

app.delete('/api/messages', requireAuth, (req, res) => {
  const db = readDB();
  db.messages = db.messages.filter(m => m.userId !== req.userId);
  writeDB(db);
  res.json({ ok: true });
});

// ─── Drafts ───────────────────────────────────────────────────────────────────
app.get('/api/drafts', requireAuth, apiLimiter, (req, res) => {
  const db = readDB();
  const drafts = db.drafts.filter(d => d.userId === req.userId);
  const decrypted = drafts.map(d => ({
    ...d,
    title: decrypt(d.title, req.encKey),
    content: decrypt(d.content, req.encKey)
  })).filter(d => d.title !== null);
  res.json(decrypted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
});

app.post('/api/drafts', requireAuth, apiLimiter, (req, res) => {
  const { title, content, type, emirate } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Missing fields' });

  const db = readDB();
  const draft = {
    id: uuidv4(),
    userId: req.userId,
    title: encrypt(title, req.encKey),
    content: encrypt(content, req.encKey),
    type: type || 'notice',
    emirate: emirate || 'dubai',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.drafts.push(draft);
  writeDB(db);
  res.json({ id: draft.id, createdAt: draft.createdAt });
});

app.put('/api/drafts/:id', requireAuth, apiLimiter, (req, res) => {
  const { title, content } = req.body;
  const db = readDB();
  const draft = db.drafts.find(d => d.id === req.params.id && d.userId === req.userId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  if (title) draft.title = encrypt(title, req.encKey);
  if (content) draft.content = encrypt(content, req.encKey);
  draft.updatedAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true });
});

app.delete('/api/drafts/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.drafts = db.drafts.filter(d => !(d.id === req.params.id && d.userId === req.userId));
  writeDB(db);
  res.json({ ok: true });
});

// ─── Activity log ─────────────────────────────────────────────────────────────
app.get('/api/activity', requireAuth, (req, res) => {
  const db = readDB();
  const acts = db.activities.filter(a => a.userId === req.userId).slice(-50);
  const decrypted = acts.map(a => ({
    ...a,
    description: decrypt(a.description, req.encKey)
  })).filter(a => a.description !== null);
  res.json(decrypted.reverse());
});

app.post('/api/activity', requireAuth, (req, res) => {
  const { type, description, icon } = req.body;
  const db = readDB();
  db.activities.push({
    id: uuidv4(),
    userId: req.userId,
    type,
    description: encrypt(description, req.encKey),
    icon: icon || '📋',
    createdAt: new Date().toISOString()
  });
  db.activities = db.activities.filter(a => a.userId !== req.userId).concat(
    db.activities.filter(a => a.userId === req.userId).slice(-200)
  );
  writeDB(db);
  res.json({ ok: true });
});

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, (req, res) => {
  const db = readDB();
  const msgs = db.messages.filter(m => m.userId === req.userId && m.role === 'user').length;
  const drafts = db.drafts.filter(d => d.userId === req.userId).length;
  const acts = db.activities.filter(a => a.userId === req.userId).length;
  res.json({ messages: msgs, drafts, activities: acts });
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Serve frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', (req, res) => {
  const indexPath = path.join(__dirname, '../frontend/dist/index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Frontend not built yet');
});

app.listen(PORT, () => console.log(`UAE Tenancy API running on http://localhost:${PORT}`));
