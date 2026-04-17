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
const JWT_SECRET = process.env.JWT_SECRET || 'uae_tenancy_v2_secret_change_in_prod';
const DB_PATH = path.join(__dirname, 'db.json');

// ── DB ──────────────────────────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const init = {
      users: [], properties: [], units: [], tenancies: [],
      payments: [], cheques: [], documents: [], messages: [],
      threads: [], maintenance: [], notifications: [],
      chatHistory: [], drafts: [], activities: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// ── Encryption ───────────────────────────────────────────────────────────────
const SERVER_SALT = 'uae_tenancy_v2_server_salt';
function deriveKey(hash) { return crypto.scryptSync(hash + SERVER_SALT, 'salt_v2', 32); }
function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  return iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + enc;
}
function decrypt(data, key) {
  try {
    const [ivH, tagH, enc] = data.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivH, 'hex'));
    decipher.setAuthTag(Buffer.from(tagH, 'hex'));
    return decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8');
  } catch { return null; }
}

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    req.userId = p.userId;
    req.userRole = p.role;
    req.encKey = Buffer.from(p.encKey, 'hex');
    next();
  } catch { res.status(401).json({ error: 'Token expired' }); }
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
  if (!['landlord', 'tenant'].includes(role)) return res.status(400).json({ error: 'Role must be landlord or tenant' });
  if (password.length < 8) return res.status(400).json({ error: 'Password min 8 chars' });
  const db = readDB();
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const encKey = deriveKey(passwordHash);
  db.users.push({ id: userId, email: email.toLowerCase(), passwordHash, name, role, phone: phone || '', emirate: 'dubai', createdAt: new Date().toISOString(), plan: 'free' });
  writeDB(db);
  const token = jwt.sign({ userId, role, encKey: encKey.toString('hex') }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: userId, email, name, role, phone: phone || '', emirate: 'dubai', plan: 'free' } });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email?.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: 'Invalid credentials' });
  const encKey = deriveKey(user.passwordHash);
  const token = jwt.sign({ userId: user.id, role: user.role, encKey: encKey.toString('hex') }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone, emirate: user.emirate, plan: user.plan } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone, emirate: user.emirate, plan: user.plan });
});

app.patch('/api/auth/profile', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { emirate, phone, name } = req.body;
  if (emirate) user.emirate = emirate;
  if (phone) user.phone = phone;
  if (name) user.name = name;
  writeDB(db);
  res.json({ ok: true });
});

// ── PROPERTIES (landlord only) ───────────────────────────────────────────────
app.get('/api/properties', requireAuth, (req, res) => {
  const db = readDB();
  const props = db.properties.filter(p => p.landlordId === req.userId);
  const result = props.map(p => {
    const units = db.units.filter(u => u.propertyId === p.id);
    const occupied = units.filter(u => u.status === 'occupied').length;
    return { ...p, totalUnits: units.length, occupiedUnits: occupied, vacantUnits: units.length - occupied };
  });
  res.json(result);
});

app.post('/api/properties', requireAuth, (req, res) => {
  if (req.userRole !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
  const { name, address, emirate, type } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Name and address required' });
  const db = readDB();
  const prop = { id: uuidv4(), landlordId: req.userId, name, address, emirate: emirate || 'dubai', type: type || 'residential', createdAt: new Date().toISOString() };
  db.properties.push(prop);
  writeDB(db);
  res.json(prop);
});

app.put('/api/properties/:id', requireAuth, (req, res) => {
  const db = readDB();
  const prop = db.properties.find(p => p.id === req.params.id && p.landlordId === req.userId);
  if (!prop) return res.status(404).json({ error: 'Not found' });
  Object.assign(prop, req.body);
  writeDB(db);
  res.json(prop);
});

app.delete('/api/properties/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.properties = db.properties.filter(p => !(p.id === req.params.id && p.landlordId === req.userId));
  writeDB(db);
  res.json({ ok: true });
});

// ── UNITS ────────────────────────────────────────────────────────────────────
app.get('/api/units', requireAuth, (req, res) => {
  const db = readDB();
  let units;
  if (req.userRole === 'landlord') {
    const myProps = db.properties.filter(p => p.landlordId === req.userId).map(p => p.id);
    units = db.units.filter(u => myProps.includes(u.propertyId));
  } else {
    const myTenancies = db.tenancies.filter(t => t.tenantId === req.userId && t.status === 'active').map(t => t.unitId);
    units = db.units.filter(u => myTenancies.includes(u.id));
  }
  const result = units.map(u => {
    const prop = db.properties.find(p => p.id === u.propertyId);
    const activeTenancy = db.tenancies.find(t => t.unitId === u.id && t.status === 'active');
    const tenant = activeTenancy ? db.users.find(usr => usr.id === activeTenancy.tenantId) : null;
    return { ...u, propertyName: prop?.name, propertyAddress: prop?.address, activeTenancy, tenantName: tenant?.name, tenantPhone: tenant?.phone, tenantEmail: tenant?.email };
  });
  res.json(result);
});

app.post('/api/units', requireAuth, (req, res) => {
  if (req.userRole !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
  const { propertyId, unitNumber, floor, bedrooms, bathrooms, size, rentAmount } = req.body;
  const db = readDB();
  const prop = db.properties.find(p => p.id === propertyId && p.landlordId === req.userId);
  if (!prop) return res.status(403).json({ error: 'Property not found' });
  const unit = { id: uuidv4(), propertyId, unitNumber, floor: floor || '', bedrooms: bedrooms || 1, bathrooms: bathrooms || 1, size: size || '', rentAmount: rentAmount || 0, status: 'vacant', createdAt: new Date().toISOString() };
  db.units.push(unit);
  writeDB(db);
  res.json(unit);
});

app.put('/api/units/:id', requireAuth, (req, res) => {
  const db = readDB();
  const unit = db.units.find(u => u.id === req.params.id);
  if (!unit) return res.status(404).json({ error: 'Not found' });
  const prop = db.properties.find(p => p.id === unit.propertyId && p.landlordId === req.userId);
  if (!prop) return res.status(403).json({ error: 'Forbidden' });
  Object.assign(unit, req.body);
  writeDB(db);
  res.json(unit);
});

app.delete('/api/units/:id', requireAuth, (req, res) => {
  const db = readDB();
  const unit = db.units.find(u => u.id === req.params.id);
  if (!unit) return res.status(404).json({ error: 'Not found' });
  const prop = db.properties.find(p => p.id === unit.propertyId && p.landlordId === req.userId);
  if (!prop) return res.status(403).json({ error: 'Forbidden' });
  db.units = db.units.filter(u => u.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── TENANCIES ────────────────────────────────────────────────────────────────
app.get('/api/tenancies', requireAuth, (req, res) => {
  const db = readDB();
  let tenancies;
  if (req.userRole === 'landlord') {
    const myProps = db.properties.filter(p => p.landlordId === req.userId).map(p => p.id);
    const myUnits = db.units.filter(u => myProps.includes(u.propertyId)).map(u => u.id);
    tenancies = db.tenancies.filter(t => myUnits.includes(t.unitId));
  } else {
    tenancies = db.tenancies.filter(t => t.tenantId === req.userId);
  }
  const result = tenancies.map(t => {
    const unit = db.units.find(u => u.id === t.unitId);
    const prop = unit ? db.properties.find(p => p.id === unit.propertyId) : null;
    const tenant = db.users.find(u => u.id === t.tenantId);
    const landlord = prop ? db.users.find(u => u.id === prop.landlordId) : null;
    const cheques = db.cheques.filter(c => c.tenancyId === t.id);
    const totalPaid = cheques.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
    const totalDue = cheques.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);
    const overdue = cheques.filter(c => c.status === 'overdue' || (c.status === 'pending' && new Date(c.dueDate) < new Date()));
    return { ...t, unitNumber: unit?.unitNumber, propertyName: prop?.name, propertyAddress: prop?.address, emirate: prop?.emirate, tenantName: tenant?.name, tenantEmail: tenant?.email, tenantPhone: tenant?.phone, landlordName: landlord?.name, landlordPhone: landlord?.phone, totalPaid, totalDue, overdueCount: overdue.length };
  });
  res.json(result);
});

app.post('/api/tenancies', requireAuth, (req, res) => {
  if (req.userRole !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
  const { unitId, tenantEmail, startDate, endDate, rentAmount, securityDeposit, ejariNumber, noticePeriod } = req.body;
  const db = readDB();
  const unit = db.units.find(u => u.id === unitId);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const prop = db.properties.find(p => p.id === unit.propertyId && p.landlordId === req.userId);
  if (!prop) return res.status(403).json({ error: 'Forbidden' });
  const tenant = db.users.find(u => u.email === tenantEmail?.toLowerCase() && u.role === 'tenant');
  if (!tenant) return res.status(404).json({ error: 'Tenant not found. They must register first.' });
  const tenancy = { id: uuidv4(), unitId, tenantId: tenant.id, landlordId: req.userId, startDate, endDate, rentAmount, securityDeposit: securityDeposit || 0, ejariNumber: ejariNumber || '', noticePeriod: noticePeriod || 90, status: 'active', createdAt: new Date().toISOString() };
  db.tenancies.push(tenancy);
  unit.status = 'occupied';
  writeDB(db);
  res.json(tenancy);
});

app.put('/api/tenancies/:id', requireAuth, (req, res) => {
  const db = readDB();
  const t = db.tenancies.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  if (t.landlordId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  Object.assign(t, req.body);
  if (req.body.status === 'ended') {
    const unit = db.units.find(u => u.id === t.unitId);
    if (unit) unit.status = 'vacant';
  }
  writeDB(db);
  res.json(t);
});

// ── CHEQUES & PAYMENTS ───────────────────────────────────────────────────────
app.get('/api/cheques', requireAuth, (req, res) => {
  const db = readDB();
  let cheques;
  if (req.userRole === 'landlord') {
    const myTenancies = db.tenancies.filter(t => t.landlordId === req.userId).map(t => t.id);
    cheques = db.cheques.filter(c => myTenancies.includes(c.tenancyId));
  } else {
    const myTenancies = db.tenancies.filter(t => t.tenantId === req.userId).map(t => t.id);
    cheques = db.cheques.filter(c => myTenancies.includes(c.tenancyId));
  }
  const result = cheques.map(c => {
    const tenancy = db.tenancies.find(t => t.id === c.tenancyId);
    const unit = tenancy ? db.units.find(u => u.id === tenancy.unitId) : null;
    const prop = unit ? db.properties.find(p => p.id === unit.propertyId) : null;
    const tenant = tenancy ? db.users.find(u => u.id === tenancy.tenantId) : null;
    // Auto-mark overdue
    if (c.status === 'pending' && new Date(c.dueDate) < new Date()) c.status = 'overdue';
    return { ...c, unitNumber: unit?.unitNumber, propertyName: prop?.name, tenantName: tenant?.name };
  });
  res.json(result.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
});

app.post('/api/cheques', requireAuth, (req, res) => {
  if (req.userRole !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
  const { tenancyId, amount, dueDate, chequeNumber, bank, type, description } = req.body;
  const db = readDB();
  const tenancy = db.tenancies.find(t => t.id === tenancyId && t.landlordId === req.userId);
  if (!tenancy) return res.status(403).json({ error: 'Tenancy not found' });
  const cheque = { id: uuidv4(), tenancyId, amount: parseFloat(amount), dueDate, chequeNumber: chequeNumber || '', bank: bank || '', type: type || 'rent', description: description || '', status: 'pending', paidAt: null, createdAt: new Date().toISOString() };
  db.cheques.push(cheque);
  writeDB(db);
  res.json(cheque);
});

app.put('/api/cheques/:id', requireAuth, (req, res) => {
  const db = readDB();
  const cheque = db.cheques.find(c => c.id === req.params.id);
  if (!cheque) return res.status(404).json({ error: 'Not found' });
  const tenancy = db.tenancies.find(t => t.id === cheque.tenancyId && t.landlordId === req.userId);
  if (!tenancy) return res.status(403).json({ error: 'Forbidden' });
  Object.assign(cheque, req.body);
  if (req.body.status === 'paid' && !cheque.paidAt) cheque.paidAt = new Date().toISOString();
  writeDB(db);
  res.json(cheque);
});

app.delete('/api/cheques/:id', requireAuth, (req, res) => {
  const db = readDB();
  const cheque = db.cheques.find(c => c.id === req.params.id);
  if (!cheque) return res.status(404).json({ error: 'Not found' });
  const tenancy = db.tenancies.find(t => t.id === cheque.tenancyId && t.landlordId === req.userId);
  if (!tenancy) return res.status(403).json({ error: 'Forbidden' });
  db.cheques = db.cheques.filter(c => c.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── DOCUMENTS ────────────────────────────────────────────────────────────────
app.get('/api/documents', requireAuth, (req, res) => {
  const db = readDB();
  const docs = db.documents.filter(d => d.uploadedBy === req.userId || d.sharedWith?.includes(req.userId));
  res.json(docs.map(d => ({ ...d, content: undefined }))); // don't send content in list
});

app.post('/api/documents', requireAuth, (req, res) => {
  const { name, type, content, tenancyId, sharedWith, fileSize } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name and content required' });
  const db = readDB();
  const doc = { id: uuidv4(), name, type: type || 'other', content: encrypt(content, req.encKey), tenancyId: tenancyId || null, uploadedBy: req.userId, sharedWith: sharedWith || [], fileSize: fileSize || 0, createdAt: new Date().toISOString() };
  db.documents.push(doc);
  writeDB(db);
  res.json({ id: doc.id, name: doc.name, type: doc.type, createdAt: doc.createdAt });
});

app.get('/api/documents/:id', requireAuth, (req, res) => {
  const db = readDB();
  const doc = db.documents.find(d => d.id === req.params.id && (d.uploadedBy === req.userId || d.sharedWith?.includes(req.userId)));
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const content = decrypt(doc.content, req.encKey);
  res.json({ ...doc, content });
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.documents = db.documents.filter(d => !(d.id === req.params.id && d.uploadedBy === req.userId));
  writeDB(db);
  res.json({ ok: true });
});

// ── MESSAGING (threads between landlord & tenant) ─────────────────────────────
app.get('/api/threads', requireAuth, (req, res) => {
  const db = readDB();
  const threads = db.threads.filter(t => t.participants.includes(req.userId));
  const result = threads.map(t => {
    const other = t.participants.find(p => p !== req.userId);
    const otherUser = db.users.find(u => u.id === other);
    const msgs = db.messages.filter(m => m.threadId === t.id);
    const unread = msgs.filter(m => m.senderId !== req.userId && !m.readAt).length;
    const last = msgs[msgs.length - 1];
    return { ...t, otherName: otherUser?.name, otherRole: otherUser?.role, unreadCount: unread, lastMessage: last ? decrypt(last.content, req.encKey) : null, lastAt: last?.createdAt };
  });
  res.json(result.sort((a, b) => new Date(b.lastAt || b.createdAt) - new Date(a.lastAt || a.createdAt)));
});

app.post('/api/threads', requireAuth, (req, res) => {
  const { recipientId, tenancyId, subject } = req.body;
  const db = readDB();
  const recipient = db.users.find(u => u.id === recipientId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
  const existing = db.threads.find(t => t.participants.includes(req.userId) && t.participants.includes(recipientId) && t.tenancyId === tenancyId);
  if (existing) return res.json(existing);
  const thread = { id: uuidv4(), participants: [req.userId, recipientId], tenancyId: tenancyId || null, subject: subject || 'General', createdAt: new Date().toISOString() };
  db.threads.push(thread);
  writeDB(db);
  res.json(thread);
});

app.get('/api/threads/:id/messages', requireAuth, (req, res) => {
  const db = readDB();
  const thread = db.threads.find(t => t.id === req.params.id && t.participants.includes(req.userId));
  if (!thread) return res.status(403).json({ error: 'Forbidden' });
  const msgs = db.messages.filter(m => m.threadId === req.params.id);
  msgs.filter(m => m.senderId !== req.userId && !m.readAt).forEach(m => m.readAt = new Date().toISOString());
  writeDB(db);
  const result = msgs.map(m => {
    const sender = db.users.find(u => u.id === m.senderId);
    return { ...m, content: decrypt(m.content, req.encKey), senderName: sender?.name };
  });
  res.json(result);
});

app.post('/api/threads/:id/messages', requireAuth, (req, res) => {
  const { content, attachmentId } = req.body;
  const db = readDB();
  const thread = db.threads.find(t => t.id === req.params.id && t.participants.includes(req.userId));
  if (!thread) return res.status(403).json({ error: 'Forbidden' });
  const msg = { id: uuidv4(), threadId: req.params.id, senderId: req.userId, content: encrypt(content, req.encKey), attachmentId: attachmentId || null, readAt: null, createdAt: new Date().toISOString() };
  db.messages.push(msg);
  writeDB(db);
  const sender = db.users.find(u => u.id === req.userId);
  res.json({ ...msg, content, senderName: sender?.name });
});

// ── MAINTENANCE REQUESTS ─────────────────────────────────────────────────────
app.get('/api/maintenance', requireAuth, (req, res) => {
  const db = readDB();
  let reqs;
  if (req.userRole === 'landlord') {
    const myTenancies = db.tenancies.filter(t => t.landlordId === req.userId).map(t => t.id);
    reqs = db.maintenance.filter(m => myTenancies.includes(m.tenancyId));
  } else {
    const myTenancies = db.tenancies.filter(t => t.tenantId === req.userId).map(t => t.id);
    reqs = db.maintenance.filter(m => myTenancies.includes(m.tenancyId));
  }
  const result = reqs.map(m => {
    const tenancy = db.tenancies.find(t => t.id === m.tenancyId);
    const unit = tenancy ? db.units.find(u => u.id === tenancy.unitId) : null;
    const prop = unit ? db.properties.find(p => p.id === unit.propertyId) : null;
    const tenant = tenancy ? db.users.find(u => u.id === tenancy.tenantId) : null;
    return { ...m, unitNumber: unit?.unitNumber, propertyName: prop?.name, tenantName: tenant?.name };
  });
  res.json(result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/maintenance', requireAuth, (req, res) => {
  if (req.userRole !== 'tenant') return res.status(403).json({ error: 'Tenants only' });
  const { tenancyId, title, description, priority, category } = req.body;
  const db = readDB();
  const tenancy = db.tenancies.find(t => t.id === tenancyId && t.tenantId === req.userId);
  if (!tenancy) return res.status(403).json({ error: 'Tenancy not found' });
  const req2 = { id: uuidv4(), tenancyId, title, description, priority: priority || 'medium', category: category || 'general', status: 'open', createdAt: new Date().toISOString(), resolvedAt: null };
  db.maintenance.push(req2);
  writeDB(db);
  res.json(req2);
});

app.put('/api/maintenance/:id', requireAuth, (req, res) => {
  const db = readDB();
  const item = db.maintenance.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  Object.assign(item, req.body);
  if (req.body.status === 'resolved') item.resolvedAt = new Date().toISOString();
  writeDB(db);
  res.json(item);
});

// ── DASHBOARD STATS ──────────────────────────────────────────────────────────
app.get('/api/dashboard', requireAuth, (req, res) => {
  const db = readDB();
  if (req.userRole === 'landlord') {
    const props = db.properties.filter(p => p.landlordId === req.userId);
    const propIds = props.map(p => p.id);
    const units = db.units.filter(u => propIds.includes(u.propertyId));
    const tenancies = db.tenancies.filter(t => t.landlordId === req.userId && t.status === 'active');
    const tenancyIds = tenancies.map(t => t.id);
    const cheques = db.cheques.filter(c => tenancyIds.includes(c.tenancyId));
    const now = new Date();
    const thisMonth = cheques.filter(c => {
      const d = new Date(c.paidAt || c.dueDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalEarned = cheques.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
    const monthEarned = thisMonth.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
    const totalDue = cheques.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);
    const overdueAmt = cheques.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);
    const maintenanceOpen = db.maintenance.filter(m => tenancyIds.includes(m.tenancyId) && m.status === 'open').length;
    res.json({ role: 'landlord', totalProperties: props.length, totalUnits: units.length, occupiedUnits: units.filter(u => u.status === 'occupied').length, vacantUnits: units.filter(u => u.status === 'vacant').length, activeTenancies: tenancies.length, totalEarned, monthEarned, totalDue, overdueAmt, maintenanceOpen, recentCheques: cheques.slice(-5) });
  } else {
    const tenancies = db.tenancies.filter(t => t.tenantId === req.userId);
    const tenancyIds = tenancies.map(t => t.id);
    const cheques = db.cheques.filter(c => tenancyIds.includes(c.tenancyId));
    const totalPaid = cheques.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
    const totalDue = cheques.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);
    const overdue = cheques.filter(c => c.status === 'overdue');
    const upcoming = cheques.filter(c => c.status === 'pending' && new Date(c.dueDate) > new Date()).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 3);
    const activeTenancy = tenancies.find(t => t.status === 'active');
    const unit = activeTenancy ? db.units.find(u => u.id === activeTenancy.unitId) : null;
    const prop = unit ? db.properties.find(p => p.id === unit.propertyId) : null;
    const maintenanceOpen = db.maintenance.filter(m => tenancyIds.includes(m.tenancyId) && m.status === 'open').length;
    res.json({ role: 'tenant', activeTenancy: activeTenancy ? { ...activeTenancy, unitNumber: unit?.unitNumber, propertyName: prop?.name, propertyAddress: prop?.address } : null, totalPaid, totalDue, overdueCount: overdue.length, overdueAmt: overdue.reduce((s, c) => s + c.amount, 0), upcomingPayments: upcoming, maintenanceOpen, totalCheques: cheques.length });
  }
});

// ── AI CHAT PROXY ─────────────────────────────────────────────────────────────
app.post('/api/chat', requireAuth, apiLimiter, async (req, res) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
  const { system, messages } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system, messages }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed to reach AI' }); }
});

// ── CHAT HISTORY (AI) ─────────────────────────────────────────────────────────
app.get('/api/chat-history', requireAuth, (req, res) => {
  const db = readDB();
  const hist = db.chatHistory.filter(m => m.userId === req.userId).slice(-100);
  res.json(hist.map(m => ({ ...m, content: decrypt(m.content, req.encKey) })).filter(m => m.content));
});
app.post('/api/chat-history', requireAuth, (req, res) => {
  const { role, content } = req.body;
  const db = readDB();
  db.chatHistory.push({ id: uuidv4(), userId: req.userId, role, content: encrypt(content, req.encKey), createdAt: new Date().toISOString() });
  db.chatHistory = [...db.chatHistory.filter(m => m.userId !== req.userId).slice(-9000), ...db.chatHistory.filter(m => m.userId === req.userId).slice(-500)];
  writeDB(db);
  res.json({ ok: true });
});
app.delete('/api/chat-history', requireAuth, (req, res) => {
  const db = readDB();
  db.chatHistory = db.chatHistory.filter(m => m.userId !== req.userId);
  writeDB(db);
  res.json({ ok: true });
});

// ── DRAFTS ───────────────────────────────────────────────────────────────────
app.get('/api/drafts', requireAuth, (req, res) => {
  const db = readDB();
  const drafts = db.drafts.filter(d => d.userId === req.userId).map(d => ({ ...d, title: decrypt(d.title, req.encKey), content: decrypt(d.content, req.encKey) })).filter(d => d.title);
  res.json(drafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
});
app.post('/api/drafts', requireAuth, (req, res) => {
  const { title, content, type, emirate } = req.body;
  const db = readDB();
  const draft = { id: uuidv4(), userId: req.userId, title: encrypt(title, req.encKey), content: encrypt(content, req.encKey), type: type || 'notice', emirate: emirate || 'dubai', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.drafts.push(draft);
  writeDB(db);
  res.json({ id: draft.id });
});
app.put('/api/drafts/:id', requireAuth, (req, res) => {
  const db = readDB();
  const d = db.drafts.find(x => x.id === req.params.id && x.userId === req.userId);
  if (!d) return res.status(404).json({ error: 'Not found' });
  if (req.body.title) d.title = encrypt(req.body.title, req.encKey);
  if (req.body.content) d.content = encrypt(req.body.content, req.encKey);
  d.updatedAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true });
});
app.delete('/api/drafts/:id', requireAuth, (req, res) => {
  const db = readDB();
  db.drafts = db.drafts.filter(d => !(d.id === req.params.id && d.userId === req.userId));
  writeDB(db);
  res.json({ ok: true });
});

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0', ts: new Date().toISOString() }));

// ── SERVE FRONTEND ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', (req, res) => {
  const p = path.join(__dirname, '../frontend/dist/index.html');
  fs.existsSync(p) ? res.sendFile(p) : res.status(404).send('Frontend not built');
});

app.listen(PORT, () => console.log(`TenantShield v2 running on http://localhost:${PORT}`));
