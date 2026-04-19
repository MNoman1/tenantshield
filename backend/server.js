'use strict';
require('dotenv').config();
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

// ── SQLite via sql.js (pure JS — no native compilation needed) ────────────────
const initSqlJs = require('./node_modules/sql.js');
const DB_FILE = path.join(__dirname, 'tenantshield.db');

let db; // global sync DB handle

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE);
    db = new SQL.Database(data);
    console.log('  📂 Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('  🆕 Created new database');
  }
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  createSchema();
  saveDB();
}

function saveDB() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  } catch {}
}

// Auto-save every 10 seconds
setInterval(saveDB, 10000);

// ── FULL SQL SCHEMA ───────────────────────────────────────────────────────────
function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('landlord','tenant')),
      phone TEXT DEFAULT '',
      emirate TEXT DEFAULT 'dubai',
      plan TEXT DEFAULT 'free',
      avatar_initial TEXT DEFAULT '',
      nationality TEXT DEFAULT '',
      id_number TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      landlord_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      emirate TEXT DEFAULT 'dubai',
      type TEXT DEFAULT 'residential',
      description TEXT DEFAULT '',
      total_floors INTEGER DEFAULT 1,
      year_built INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      unit_number TEXT NOT NULL,
      floor TEXT DEFAULT '',
      bedrooms INTEGER DEFAULT 1,
      bathrooms INTEGER DEFAULT 1,
      size_sqft TEXT DEFAULT '',
      rent_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'vacant' CHECK(status IN ('vacant','occupied','maintenance','reserved')),
      furnishing TEXT DEFAULT 'unfurnished',
      parking TEXT DEFAULT '',
      features TEXT DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenancies (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL REFERENCES units(id),
      tenant_id TEXT NOT NULL REFERENCES users(id),
      landlord_id TEXT NOT NULL REFERENCES users(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      rent_amount REAL NOT NULL,
      security_deposit REAL DEFAULT 0,
      ejari_number TEXT DEFAULT '',
      notice_period_days INTEGER DEFAULT 90,
      payment_terms TEXT DEFAULT 'annual',
      num_cheques INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','ended','expired','pending')),
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      tenancy_id TEXT NOT NULL REFERENCES tenancies(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      template_type TEXT DEFAULT 'standard',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','signed_landlord','signed_tenant','fully_signed','cancelled')),
      landlord_signed_at TEXT,
      tenant_signed_at TEXT,
      valid_from TEXT,
      valid_to TEXT,
      special_clauses TEXT DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cheques (
      id TEXT PRIMARY KEY,
      tenancy_id TEXT NOT NULL REFERENCES tenancies(id),
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      cheque_number TEXT DEFAULT '',
      bank TEXT DEFAULT '',
      type TEXT DEFAULT 'rent' CHECK(type IN ('rent','security_deposit','maintenance','utility','other')),
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue','bounced','cancelled','replaced')),
      paid_at TEXT,
      replacement_cheque_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      cheque_id TEXT REFERENCES cheques(id),
      tenancy_id TEXT NOT NULL REFERENCES tenancies(id),
      receipt_number TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      paid_at TEXT NOT NULL,
      tenant_name TEXT DEFAULT '',
      landlord_name TEXT DEFAULT '',
      property_name TEXT DEFAULT '',
      unit_number TEXT DEFAULT '',
      cheque_number TEXT DEFAULT '',
      bank TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'other',
      mime_type TEXT DEFAULT '',
      content TEXT NOT NULL,
      tenancy_id TEXT REFERENCES tenancies(id),
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      shared_with TEXT DEFAULT '[]',
      file_size INTEGER DEFAULT 0,
      expiry_date TEXT,
      is_encrypted INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      participants TEXT NOT NULL,
      tenancy_id TEXT REFERENCES tenancies(id),
      subject TEXT DEFAULT 'General',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id),
      sender_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      attachment_id TEXT REFERENCES documents(id),
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance (
      id TEXT PRIMARY KEY,
      tenancy_id TEXT NOT NULL REFERENCES tenancies(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      category TEXT DEFAULT 'general',
      status TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed','cancelled')),
      landlord_note TEXT DEFAULT '',
      estimated_cost REAL DEFAULT 0,
      actual_cost REAL DEFAULT 0,
      contractor_name TEXT DEFAULT '',
      contractor_phone TEXT DEFAULT '',
      scheduled_date TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      tenancy_id TEXT NOT NULL REFERENCES tenancies(id),
      type TEXT NOT NULL CHECK(type IN ('move_in','move_out','routine','inventory')),
      overall_condition TEXT DEFAULT 'good',
      notes TEXT DEFAULT '',
      inspector_name TEXT DEFAULT '',
      conducted_by TEXT NOT NULL REFERENCES users(id),
      tenant_present INTEGER DEFAULT 0,
      tenant_signature INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inspection_items (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL REFERENCES inspections(id),
      room TEXT NOT NULL,
      item_name TEXT NOT NULL,
      condition TEXT DEFAULT 'good' CHECK(condition IN ('excellent','good','fair','poor','damaged','missing')),
      notes TEXT DEFAULT '',
      estimated_cost REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      tenancy_id TEXT NOT NULL REFERENCES tenancies(id),
      type TEXT NOT NULL CHECK(type IN ('rent_increase','eviction_owner_use','eviction_nonpayment','eviction_breach','non_renewal','rent_demand','general')),
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      issued_by TEXT NOT NULL REFERENCES users(id),
      issued_to TEXT NOT NULL REFERENCES users(id),
      served_at TEXT,
      response_deadline TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','acknowledged','disputed','withdrawn')),
      acknowledgement_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      property_id TEXT REFERENCES properties(id),
      unit_id TEXT REFERENCES units(id),
      tenancy_id TEXT REFERENCES tenancies(id),
      category TEXT NOT NULL CHECK(category IN ('maintenance','renovation','insurance','municipality_fees','service_charge','management_fee','legal','marketing','utility','other')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      paid_by TEXT DEFAULT 'landlord',
      vendor_name TEXT DEFAULT '',
      receipt_ref TEXT DEFAULT '',
      is_recurring INTEGER DEFAULT 0,
      recurrence TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS utilities (
      id TEXT PRIMARY KEY,
      tenancy_id TEXT NOT NULL REFERENCES tenancies(id),
      type TEXT NOT NULL CHECK(type IN ('electricity_water','cooling','gas','internet','parking','other')),
      provider TEXT DEFAULT '',
      account_number TEXT DEFAULT '',
      monthly_avg REAL DEFAULT 0,
      paid_by TEXT DEFAULT 'tenant' CHECK(paid_by IN ('tenant','landlord')),
      status TEXT DEFAULT 'active',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'notice',
      emirate TEXT DEFAULT 'dubai',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_properties_landlord ON properties(landlord_id);
    CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id);
    CREATE INDEX IF NOT EXISTS idx_tenancies_tenant ON tenancies(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenancies_landlord ON tenancies(landlord_id);
    CREATE INDEX IF NOT EXISTS idx_cheques_tenancy ON cheques(tenancy_id);
    CREATE INDEX IF NOT EXISTS idx_documents_uploader ON documents(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_tenancy ON maintenance(tenancy_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);
    CREATE INDEX IF NOT EXISTS idx_notices_tenancy ON notices(tenancy_id);
    CREATE INDEX IF NOT EXISTS idx_inspections_tenancy ON inspections(tenancy_id);
  `);
}

// ── DB helpers ────────────────────────────────────────────────────────────────
function dbRun(sql, params = []) {
  try { db.run(sql, params); saveDB(); return true; }
  catch(e) { console.error('DB run error:', e.message, '\nSQL:', sql); throw e; }
}
function dbGet(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.getAsObject(params);
    stmt.free();
    return Object.keys(result).length === 0 ? null : result;
  } catch(e) { console.error('DB get error:', e.message); throw e; }
}
function dbAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch(e) { console.error('DB all error:', e.message); throw e; }
}

// ── Encryption ────────────────────────────────────────────────────────────────
const SERVER_SALT = 'tenantshield_v3_salt_2026';
const JWT_SECRET = process.env.JWT_SECRET || 'tenantshield_v3_jwt_CHANGE_IN_PROD';

function deriveKey(hash) { return crypto.scryptSync(hash + SERVER_SALT, 'salt', 32); }
function enc(text, key) {
  try {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const e = c.update(String(text), 'utf8', 'hex') + c.final('hex');
    return iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + e;
  } catch { return String(text); }
}
function dec(data, key) {
  try {
    if (!data || !String(data).includes(':')) return data;
    const [ivH, tagH, ...rest] = String(data).split(':');
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivH, 'hex'));
    d.setAuthTag(Buffer.from(tagH, 'hex'));
    return d.update(rest.join(':'), 'hex', 'utf8') + d.final('utf8');
  } catch { return data; }
}

// ── App & middleware ──────────────────────────────────────────────────────────
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));

const authLim = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const apiLim  = rateLimit({ windowMs: 60 * 1000, max: 300 });

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    req.uid  = p.userId;
    req.role = p.role;
    req.key  = Buffer.from(p.encKey, 'hex');
    next();
  } catch { return res.status(401).json({ error: 'Token expired or invalid' }); }
}

function notify(userId, type, title, message, link = '') {
  try { dbRun('INSERT INTO notifications VALUES (?,?,?,?,?,?,0,?)', [uuidv4(), userId, type, title, message, link, new Date().toISOString()]); } catch {}
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', authLim, async (req, res) => {
  try {
    const { name, email, password, role, phone, nationality } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password, role required' });
    if (!['landlord','tenant'].includes(role)) return res.status(400).json({ error: 'role must be landlord or tenant' });
    if (password.length < 6) return res.status(400).json({ error: 'Password min 6 characters' });
    if (dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()])) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4(), k = deriveKey(hash);
    dbRun('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, email.toLowerCase().trim(), hash, name.trim(), role, phone||'', 'dubai', 'free', name.trim()[0].toUpperCase(), nationality||'', '', new Date().toISOString()]);
    const token = jwt.sign({ userId: id, role, encKey: k.toString('hex') }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, email: email.toLowerCase(), name: name.trim(), role, phone: phone||'', emirate: 'dubai', plan: 'free' } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', authLim, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
    const k = deriveKey(user.password_hash);
    const token = jwt.sign({ userId: user.id, role: user.role, encKey: k.toString('hex') }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone||'', emirate: user.emirate||'dubai', plan: user.plan||'free', nationality: user.nationality||'' } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', auth, (req, res) => {
  try {
    const u = dbGet('SELECT * FROM users WHERE id = ?', [req.uid]);
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json({ id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone||'', emirate: u.emirate||'dubai', plan: u.plan||'free', nationality: u.nationality||'' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/auth/profile', auth, (req, res) => {
  try {
    const { emirate, phone, name, nationality } = req.body;
    if (emirate) dbRun('UPDATE users SET emirate = ? WHERE id = ?', [emirate, req.uid]);
    if (phone !== undefined) dbRun('UPDATE users SET phone = ? WHERE id = ?', [phone, req.uid]);
    if (name) dbRun('UPDATE users SET name = ? WHERE id = ?', [name, req.uid]);
    if (nationality) dbRun('UPDATE users SET nationality = ? WHERE id = ?', [nationality, req.uid]);
    const u = dbGet('SELECT * FROM users WHERE id = ?', [req.uid]);
    res.json({ ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone, emirate: u.emirate, plan: u.plan } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/find-tenant', auth, (req, res) => {
  try {
    const u = dbGet("SELECT id,name,email,phone FROM users WHERE email = ? AND role = 'tenant'", [req.query.email?.toLowerCase().trim()]);
    if (!u) return res.status(404).json({ error: 'No tenant found. Ask them to register first.' });
    res.json(u);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PROPERTIES ────────────────────────────────────────────────────────────────
app.get('/api/properties', auth, (req, res) => {
  try {
    const props = dbAll('SELECT * FROM properties WHERE landlord_id = ? ORDER BY created_at DESC', [req.uid]);
    const result = props.map(p => {
      const units = dbAll('SELECT * FROM units WHERE property_id = ?', [p.id]);
      const occ = units.filter(u => u.status === 'occupied').length;
      const rent = units.filter(u => u.status === 'occupied').reduce((s, u) => s + (u.rent_amount||0), 0);
      return { ...p, totalUnits: units.length, occupiedUnits: occ, vacantUnits: units.length - occ, maintenanceUnits: units.filter(u => u.status === 'maintenance').length, totalRent: rent };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/properties', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { name, address, emirate, type, description, total_floors, year_built } = req.body;
    if (!name || !address) return res.status(400).json({ error: 'name and address required' });
    const id = uuidv4();
    dbRun('INSERT INTO properties VALUES (?,?,?,?,?,?,?,?,?,?)', [id, req.uid, name, address, emirate||'dubai', type||'residential', description||'', total_floors||1, year_built||null, new Date().toISOString()]);
    res.json({ id, landlord_id: req.uid, name, address, emirate: emirate||'dubai', type: type||'residential', totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, totalRent: 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/properties/:id', auth, (req, res) => {
  try {
    const p = dbGet('SELECT * FROM properties WHERE id = ? AND landlord_id = ?', [req.params.id, req.uid]);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const { name, address, emirate, type, description, total_floors, year_built } = req.body;
    dbRun('UPDATE properties SET name=?,address=?,emirate=?,type=?,description=?,total_floors=?,year_built=? WHERE id=?',
      [name||p.name, address||p.address, emirate||p.emirate, type||p.type, description??p.description, total_floors||p.total_floors, year_built||p.year_built, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/properties/:id', auth, (req, res) => {
  try {
    dbRun('DELETE FROM properties WHERE id = ? AND landlord_id = ?', [req.params.id, req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── UNITS ─────────────────────────────────────────────────────────────────────
app.get('/api/units', auth, (req, res) => {
  try {
    let units;
    if (req.role === 'landlord') {
      units = dbAll(`SELECT u.*, p.name as property_name, p.address as property_address, p.emirate FROM units u JOIN properties p ON p.id = u.property_id WHERE p.landlord_id = ? ORDER BY p.name, u.unit_number`, [req.uid]);
    } else {
      units = dbAll(`SELECT u.*, p.name as property_name, p.address as property_address, p.emirate FROM units u JOIN properties p ON p.id = u.property_id JOIN tenancies t ON t.unit_id = u.id WHERE t.tenant_id = ? AND t.status = 'active'`, [req.uid]);
    }
    const result = units.map(u => {
      const at = dbGet("SELECT t.*, usr.name as tenant_name, usr.email as tenant_email, usr.phone as tenant_phone FROM tenancies t LEFT JOIN users usr ON usr.id = t.tenant_id WHERE t.unit_id = ? AND t.status = 'active'", [u.id]);
      return { ...u, features: JSON.parse(u.features||'[]'), activeTenancy: at || null };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/units', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { propertyId, unitNumber, floor, bedrooms, bathrooms, size_sqft, rentAmount, furnishing, parking, features } = req.body;
    if (!propertyId || !unitNumber) return res.status(400).json({ error: 'propertyId and unitNumber required' });
    const prop = dbGet('SELECT id FROM properties WHERE id = ? AND landlord_id = ?', [propertyId, req.uid]);
    if (!prop) return res.status(403).json({ error: 'Property not found or not yours' });
    const id = uuidv4();
    dbRun('INSERT INTO units VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, propertyId, unitNumber, floor||'', bedrooms||1, bathrooms||1, size_sqft||'', rentAmount||0, 'vacant', furnishing||'unfurnished', parking||'', JSON.stringify(features||[]), new Date().toISOString()]);
    res.json({ id, property_id: propertyId, unit_number: unitNumber, status: 'vacant', rent_amount: rentAmount||0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/units/:id', auth, (req, res) => {
  try {
    const u = dbGet('SELECT u.* FROM units u JOIN properties p ON p.id = u.property_id WHERE u.id = ? AND p.landlord_id = ?', [req.params.id, req.uid]);
    if (!u) return res.status(404).json({ error: 'Not found' });
    const { unitNumber, floor, bedrooms, bathrooms, size_sqft, rentAmount, status, furnishing, parking, features } = req.body;
    dbRun('UPDATE units SET unit_number=?,floor=?,bedrooms=?,bathrooms=?,size_sqft=?,rent_amount=?,status=?,furnishing=?,parking=?,features=? WHERE id=?',
      [unitNumber||u.unit_number, floor??u.floor, bedrooms||u.bedrooms, bathrooms||u.bathrooms, size_sqft||u.size_sqft, rentAmount||u.rent_amount, status||u.status, furnishing||u.furnishing, parking||u.parking, JSON.stringify(features||JSON.parse(u.features||'[]')), req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/units/:id', auth, (req, res) => {
  try {
    dbRun('DELETE FROM units WHERE id = ? AND property_id IN (SELECT id FROM properties WHERE landlord_id = ?)', [req.params.id, req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── TENANCIES ─────────────────────────────────────────────────────────────────
app.get('/api/tenancies', auth, (req, res) => {
  try {
    const where = req.role === 'landlord' ? 'landlord_id' : 'tenant_id';
    const list = dbAll(`SELECT t.*, u.unit_number, u.bedrooms, u.bathrooms, p.name as property_name, p.address as property_address, p.emirate, ten.name as tenant_name, ten.email as tenant_email, ten.phone as tenant_phone, ll.name as landlord_name, ll.phone as landlord_phone FROM tenancies t JOIN units u ON u.id = t.unit_id JOIN properties p ON p.id = u.property_id JOIN users ten ON ten.id = t.tenant_id JOIN users ll ON ll.id = t.landlord_id WHERE t.${where} = ? ORDER BY t.created_at DESC`, [req.uid]);
    const result = list.map(t => {
      const cqs = dbAll('SELECT * FROM cheques WHERE tenancy_id = ?', [t.id]);
      const now = new Date();
      cqs.forEach(c => { if (c.status === 'pending' && new Date(c.due_date) < now) { dbRun("UPDATE cheques SET status = 'overdue' WHERE id = ?", [c.id]); c.status = 'overdue'; } });
      const paid = cqs.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
      const due  = cqs.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);
      const ov   = cqs.filter(c => c.status === 'overdue').length;
      const days = Math.max(0, Math.floor((new Date(t.end_date) - now) / 86400000));
      return { ...t, totalPaid: paid, totalDue: due, overdueCount: ov, daysLeft: days, totalCheques: cqs.length };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tenancies', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { unitId, tenantEmail, startDate, endDate, rentAmount, securityDeposit, ejariNumber, noticePeriod, paymentTerms, numCheques, notes } = req.body;
    if (!unitId || !tenantEmail || !startDate || !endDate || !rentAmount) return res.status(400).json({ error: 'unitId, tenantEmail, startDate, endDate, rentAmount required' });
    const unit = dbGet('SELECT u.* FROM units u JOIN properties p ON p.id = u.property_id WHERE u.id = ? AND p.landlord_id = ?', [unitId, req.uid]);
    if (!unit) return res.status(403).json({ error: 'Unit not found or not yours' });
    const tenant = dbGet("SELECT * FROM users WHERE email = ? AND role = 'tenant'", [tenantEmail.toLowerCase().trim()]);
    if (!tenant) return res.status(404).json({ error: `No tenant found with email "${tenantEmail}". They must register first.` });
    const exists = dbGet("SELECT id FROM tenancies WHERE unit_id = ? AND status = 'active'", [unitId]);
    if (exists) return res.status(409).json({ error: 'This unit already has an active tenancy' });
    const id = uuidv4();
    dbRun('INSERT INTO tenancies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, unitId, tenant.id, req.uid, startDate, endDate, parseFloat(rentAmount), parseFloat(securityDeposit)||0, ejariNumber||'', noticePeriod||90, paymentTerms||'annual', numCheques||1, 'active', notes||'', new Date().toISOString()]);
    dbRun("UPDATE units SET status = 'occupied' WHERE id = ?", [unitId]);
    notify(tenant.id, 'tenancy', '🏠 New Tenancy Created', `Your tenancy for ${unit.unit_number} has been set up by your landlord.`, '/tenancies');
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tenancies/:id', auth, (req, res) => {
  try {
    const t = dbGet('SELECT * FROM tenancies WHERE id = ? AND landlord_id = ?', [req.params.id, req.uid]);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const fields = ['end_date','rent_amount','security_deposit','ejari_number','notice_period_days','payment_terms','num_cheques','status','notes'];
    const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f} = ?`).join(', ');
    const vals = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
    if (updates) { dbRun(`UPDATE tenancies SET ${updates} WHERE id = ?`, [...vals, req.params.id]); }
    if (req.body.status === 'ended') { dbRun("UPDATE units SET status = 'vacant' WHERE id = ?", [t.unit_id]); }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CONTRACTS ─────────────────────────────────────────────────────────────────
app.get('/api/contracts', auth, (req, res) => {
  try {
    const rows = dbAll(`SELECT c.*, t.tenant_id, t.landlord_id, t.rent_amount, t.start_date, t.end_date, u.unit_number, p.name as property_name, ten.name as tenant_name, ll.name as landlord_name FROM contracts c JOIN tenancies t ON t.id = c.tenancy_id JOIN units u ON u.id = t.unit_id JOIN properties p ON p.id = u.property_id JOIN users ten ON ten.id = t.tenant_id JOIN users ll ON ll.id = t.landlord_id WHERE t.tenant_id = ? OR t.landlord_id = ? ORDER BY c.created_at DESC`, [req.uid, req.uid]);
    res.json(rows.map(r => ({ ...r, content: undefined })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/contracts/:id', auth, (req, res) => {
  try {
    const c = dbGet(`SELECT c.*, t.tenant_id, t.landlord_id, t.rent_amount, t.start_date, t.end_date, t.security_deposit, t.ejari_number, t.notice_period_days, u.unit_number, u.bedrooms, u.bathrooms, u.size_sqft, u.furnishing, p.name as property_name, p.address as property_address, p.emirate, ten.name as tenant_name, ten.email as tenant_email, ten.phone as tenant_phone, ten.nationality as tenant_nationality, ll.name as landlord_name, ll.phone as landlord_phone FROM contracts c JOIN tenancies t ON t.id = c.tenancy_id JOIN units u ON u.id = t.unit_id JOIN properties p ON p.id = u.property_id JOIN users ten ON ten.id = t.tenant_id JOIN users ll ON ll.id = t.landlord_id WHERE c.id = ? AND (t.tenant_id = ? OR t.landlord_id = ?)`, [req.params.id, req.uid, req.uid]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json({ ...c, content: dec(c.content, req.key) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/contracts', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { tenancyId, title, content, templateType, specialClauses, validFrom, validTo } = req.body;
    if (!tenancyId || !content) return res.status(400).json({ error: 'tenancyId and content required' });
    const t = dbGet('SELECT * FROM tenancies WHERE id = ? AND landlord_id = ?', [tenancyId, req.uid]);
    if (!t) return res.status(403).json({ error: 'Tenancy not found or not yours' });
    const id = uuidv4();
    dbRun('INSERT INTO contracts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, tenancyId, title||'Tenancy Agreement', enc(content, req.key), templateType||'standard', 'draft', null, null, validFrom||t.start_date, validTo||t.end_date, specialClauses||'', req.uid, new Date().toISOString()]);
    notify(t.tenant_id, 'contract', '📋 Contract Ready', 'Your landlord has prepared a tenancy contract for your review.', '/contracts');
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/contracts/:id', auth, (req, res) => {
  try {
    const c = dbGet(`SELECT c.*, t.tenant_id, t.landlord_id FROM contracts c JOIN tenancies t ON t.id = c.tenancy_id WHERE c.id = ?`, [req.params.id]);
    if (!c || (c.landlord_id !== req.uid && c.tenant_id !== req.uid)) return res.status(403).json({ error: 'Forbidden' });
    const now = new Date().toISOString();
    if (req.body.status === 'signed_landlord' && req.uid === c.landlord_id) dbRun('UPDATE contracts SET status=?,landlord_signed_at=? WHERE id=?', ['signed_landlord', now, req.params.id]);
    else if (req.body.status === 'signed_tenant' && req.uid === c.tenant_id) {
      const newStatus = c.landlord_signed_at ? 'fully_signed' : 'signed_tenant';
      dbRun('UPDATE contracts SET status=?,tenant_signed_at=? WHERE id=?', [newStatus, now, req.params.id]);
      if (newStatus === 'fully_signed') notify(c.landlord_id, 'contract', '✅ Contract Fully Signed', 'Tenant has signed the contract. It is now fully executed.');
    } else {
      const { title, content, status, specialClauses } = req.body;
      if (title) dbRun('UPDATE contracts SET title=? WHERE id=?', [title, req.params.id]);
      if (content) dbRun('UPDATE contracts SET content=? WHERE id=?', [enc(content, req.key), req.params.id]);
      if (status) dbRun('UPDATE contracts SET status=? WHERE id=?', [status, req.params.id]);
      if (specialClauses !== undefined) dbRun('UPDATE contracts SET special_clauses=? WHERE id=?', [specialClauses, req.params.id]);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Auto-generate contract from tenancy
app.post('/api/contracts/generate', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { tenancyId } = req.body;
    const t = dbGet(`SELECT t.*, u.unit_number, u.bedrooms, u.bathrooms, u.size_sqft, u.furnishing, p.name as property_name, p.address as property_address, p.emirate, ten.name as tenant_name, ten.email as tenant_email, ten.phone as tenant_phone, ten.nationality as tenant_nationality, ll.name as landlord_name, ll.phone as landlord_phone FROM tenancies t JOIN units u ON u.id = t.unit_id JOIN properties p ON p.id = u.property_id JOIN users ten ON ten.id = t.tenant_id JOIN users ll ON ll.id = t.landlord_id WHERE t.id = ? AND t.landlord_id = ?`, [tenancyId, req.uid]);
    if (!t) return res.status(404).json({ error: 'Tenancy not found' });

    const emirateLaw = { dubai: 'Law No. 26 of 2007 (as amended by Law No. 33 of 2008)', sharjah: 'Sharjah Decree No. 2 of 2007', abudhabi: 'Abu Dhabi Law No. 20 of 2006', default: 'UAE Federal Law' };
    const law = emirateLaw[t.emirate] || emirateLaw.default;
    const formatAED = n => `AED ${Number(n).toLocaleString('en-AE')}`;
    const formatDate = d => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

    const content = `TENANCY CONTRACT
================================================================================

This Tenancy Agreement ("Agreement") is entered into on ${formatDate(new Date())} in accordance with ${law} and applicable UAE regulations.

PARTIES
────────────────────────────────────────────────────────────────────────────────
LANDLORD:       ${t.landlord_name}
Phone:          ${t.landlord_phone || 'N/A'}

TENANT:         ${t.tenant_name}
Phone:          ${t.tenant_phone || 'N/A'}
Email:          ${t.tenant_email}
Nationality:    ${t.tenant_nationality || 'N/A'}

PROPERTY DETAILS
────────────────────────────────────────────────────────────────────────────────
Property:       ${t.property_name}
Address:        ${t.property_address}
Emirate:        ${t.emirate.charAt(0).toUpperCase() + t.emirate.slice(1)}
Unit Number:    ${t.unit_number}
Bedrooms:       ${t.bedrooms}
Bathrooms:      ${t.bathrooms}
Size:           ${t.size_sqft || 'N/A'} sqft
Furnishing:     ${(t.furnishing||'unfurnished').charAt(0).toUpperCase() + (t.furnishing||'unfurnished').slice(1)}

TENANCY TERMS
────────────────────────────────────────────────────────────────────────────────
Tenancy Period: ${formatDate(t.start_date)} to ${formatDate(t.end_date)}
Annual Rent:    ${formatAED(t.rent_amount)}
Security Dep.:  ${formatAED(t.security_deposit)}
${t.ejari_number ? `Ejari Number:   ${t.ejari_number}` : ''}
Notice Period:  ${t.notice_period_days || 90} days
Payment Terms:  ${t.payment_terms || 'Annual'}

STANDARD TERMS & CONDITIONS
────────────────────────────────────────────────────────────────────────────────

1. RENT PAYMENT
   1.1 The Tenant agrees to pay the annual rent of ${formatAED(t.rent_amount)} as agreed.
   1.2 Post-dated cheques shall be provided at the commencement of the tenancy.
   1.3 If any cheque is dishonoured, a penalty fee may be applied.
   1.4 Rent increases shall be governed by the ${t.emirate.charAt(0).toUpperCase()+t.emirate.slice(1)} rent regulation index.

2. SECURITY DEPOSIT
   2.1 The Tenant shall pay a refundable security deposit of ${formatAED(t.security_deposit)}.
   2.2 The deposit shall be returned within 30 days of vacating, less documented deductions.
   2.3 Deductions may only be made for damage beyond normal wear and tear.

3. TENANT OBLIGATIONS
   3.1 Use the premises only for residential purposes.
   3.2 Maintain the property in good condition and notify the Landlord of any defects.
   3.3 Not sublet or assign the premises without written consent from the Landlord.
   3.4 Not make structural alterations without written approval.
   3.5 Comply with all building rules, regulations, and community guidelines.
   3.6 Register the tenancy with the relevant authority (Ejari/Tawtheeq) if required.

4. LANDLORD OBLIGATIONS
   4.1 Maintain the property in a habitable condition.
   4.2 Carry out necessary repairs within a reasonable time frame.
   4.3 Provide ${t.notice_period_days || 90} days written notice before any rent change or non-renewal.
   4.4 Not interfere with the Tenant's peaceful enjoyment of the property.
   4.5 Return the security deposit within 30 days of contract end, subject to deductions.

5. UTILITIES
   5.1 The Tenant is responsible for registering and paying for all utility services (DEWA/cooling/internet) unless otherwise agreed.
   5.2 The Tenant shall pay all municipality fees and service charges applicable to the unit.

6. MAINTENANCE
   6.1 Minor repairs (under AED 500) are the Tenant's responsibility.
   6.2 Major structural repairs are the Landlord's responsibility.
   6.3 The Tenant must report maintenance issues promptly in writing.

7. TERMINATION
   7.1 Either party may terminate this Agreement by giving ${t.notice_period_days || 90} days written notice.
   7.2 For eviction due to owner use, the Landlord must give 12 months notice via notary public.
   7.3 Eviction for non-payment requires a court order from the Rent Dispute Settlement Centre.

8. DISPUTE RESOLUTION
   8.1 All disputes shall first be resolved amicably between the parties.
   8.2 Unresolved disputes shall be referred to the relevant authority:
       - Dubai: Rent Dispute Settlement Centre (RDSC) — rdsc.ae
       - Abu Dhabi: Abu Dhabi Judicial Department — adjd.gov.ae
       - Sharjah: Sharjah Municipality — shjmun.gov.ae
   8.3 This Agreement is governed by UAE law.

SIGNATURES
────────────────────────────────────────────────────────────────────────────────

LANDLORD: ${t.landlord_name}
Signature: ________________________________    Date: _______________

TENANT: ${t.tenant_name}
Signature: ________________________________    Date: _______________

WITNESS:
Signature: ________________________________    Date: _______________

================================================================================
⚠️ This contract is generated for informational purposes. For legally binding contracts, please consult a UAE-licensed legal professional or notary.`;

    const id = uuidv4();
    dbRun('INSERT INTO contracts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, tenancyId, `Tenancy Agreement — ${t.property_name} Unit ${t.unit_number}`, enc(content, req.key), 'standard', 'draft', null, null, t.start_date, t.end_date, '', req.uid, new Date().toISOString()]);
    res.json({ id, content });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CHEQUES ───────────────────────────────────────────────────────────────────
function autoOverdue() {
  dbRun("UPDATE cheques SET status='overdue' WHERE status='pending' AND due_date < date('now')");
}

app.get('/api/cheques', auth, (req, res) => {
  try {
    autoOverdue();
    const where = req.role === 'landlord' ? 'landlord_id' : 'tenant_id';
    const rows = dbAll(`SELECT c.*, u.unit_number, p.name as property_name, ten.name as tenant_name FROM cheques c JOIN tenancies t ON t.id = c.tenancy_id JOIN units u ON u.id = t.unit_id JOIN properties p ON p.id = u.property_id JOIN users ten ON ten.id = t.tenant_id WHERE t.${where} = ? ORDER BY c.due_date`, [req.uid]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cheques', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { tenancyId, amount, dueDate, chequeNumber, bank, type, description } = req.body;
    if (!tenancyId || !amount || !dueDate) return res.status(400).json({ error: 'tenancyId, amount, dueDate required' });
    if (!dbGet('SELECT id FROM tenancies WHERE id = ? AND landlord_id = ?', [tenancyId, req.uid])) return res.status(403).json({ error: 'Tenancy not yours' });
    const id = uuidv4();
    dbRun('INSERT INTO cheques VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, tenancyId, parseFloat(amount), dueDate, chequeNumber||'', bank||'', type||'rent', description||'', 'pending', null, null, new Date().toISOString()]);
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cheques/bulk', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { tenancyId, cheques: list } = req.body;
    if (!tenancyId || !Array.isArray(list)) return res.status(400).json({ error: 'tenancyId and cheques[] required' });
    if (!dbGet('SELECT id FROM tenancies WHERE id = ? AND landlord_id = ?', [tenancyId, req.uid])) return res.status(403).json({ error: 'Tenancy not yours' });
    const created = list.map(c => {
      const id = uuidv4();
      dbRun('INSERT INTO cheques VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, tenancyId, parseFloat(c.amount), c.dueDate, c.chequeNumber||'', c.bank||'', c.type||'rent', c.description||'', 'pending', null, null, new Date().toISOString()]);
      return { id, ...c };
    });
    res.json(created);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/cheques/:id', auth, (req, res) => {
  try {
    const c = dbGet('SELECT c.*, t.tenant_id, t.landlord_id, t.unit_id FROM cheques c JOIN tenancies t ON t.id = c.tenancy_id WHERE c.id = ?', [req.params.id]);
    if (!c || c.landlord_id !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    const { status, chequeNumber, bank, dueDate, description } = req.body;
    if (status) dbRun('UPDATE cheques SET status=? WHERE id=?', [status, req.params.id]);
    if (chequeNumber !== undefined) dbRun('UPDATE cheques SET cheque_number=? WHERE id=?', [chequeNumber, req.params.id]);
    if (bank) dbRun('UPDATE cheques SET bank=? WHERE id=?', [bank, req.params.id]);
    if (dueDate) dbRun('UPDATE cheques SET due_date=? WHERE id=?', [dueDate, req.params.id]);
    if (description !== undefined) dbRun('UPDATE cheques SET description=? WHERE id=?', [description, req.params.id]);
    if (status === 'paid') {
      const now = new Date().toISOString();
      dbRun('UPDATE cheques SET paid_at=? WHERE id=?', [now, req.params.id]);
      const unit = dbGet('SELECT u.unit_number, p.name as pname FROM units u JOIN properties p ON p.id=u.property_id WHERE u.id=?', [c.unit_id]);
      const tenant = dbGet('SELECT name FROM users WHERE id=?', [c.tenant_id]);
      const ll = dbGet('SELECT name FROM users WHERE id=?', [c.landlord_id]);
      const rn = 'REC-' + Date.now();
      dbRun('INSERT INTO receipts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [uuidv4(), c.id, c.tenancy_id, rn, c.amount, now, tenant?.name||'', ll?.name||'', unit?.pname||'', unit?.unit_number||'', c.cheque_number, c.bank, c.description||c.type, now]);
      notify(c.tenant_id, 'payment', '✅ Payment Confirmed', `Your cheque of AED ${Number(c.amount).toLocaleString()} has been marked as received.`);
    }
    if (status === 'bounced') notify(c.tenant_id, 'payment', '⚠️ Cheque Bounced', `Your cheque of AED ${Number(c.amount).toLocaleString()} has been returned. Please contact your landlord.`);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cheques/:id', auth, (req, res) => {
  try {
    dbRun('DELETE FROM cheques WHERE id=? AND tenancy_id IN (SELECT id FROM tenancies WHERE landlord_id=?)', [req.params.id, req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── RECEIPTS ──────────────────────────────────────────────────────────────────
app.get('/api/receipts', auth, (req, res) => {
  try {
    const where = req.role === 'landlord' ? 'landlord_id' : 'tenant_id';
    res.json(dbAll(`SELECT r.* FROM receipts r JOIN tenancies t ON t.id=r.tenancy_id WHERE t.${where}=? ORDER BY r.paid_at DESC`, [req.uid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────
app.get('/api/documents', auth, (req, res) => {
  try {
    const rows = dbAll("SELECT id,name,type,mime_type,tenancy_id,uploaded_by,shared_with,file_size,expiry_date,created_at FROM documents WHERE uploaded_by=? OR shared_with LIKE ?", [req.uid, `%${req.uid}%`]);
    res.json(rows.map(r => ({ ...r, shared_with: JSON.parse(r.shared_with||'[]') })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/documents', auth, (req, res) => {
  try {
    const { name, type, content, tenancyId, sharedWith, fileSize, mimeType, expiryDate } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'name and content required' });
    const id = uuidv4();
    dbRun('INSERT INTO documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, name, type||'other', mimeType||'', enc(content, req.key), tenancyId||null, req.uid, JSON.stringify(sharedWith||[]), fileSize||0, expiryDate||null, 1, new Date().toISOString()]);
    res.json({ id, name, type });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/documents/:id', auth, (req, res) => {
  try {
    const doc = dbGet('SELECT * FROM documents WHERE id=? AND (uploaded_by=? OR shared_with LIKE ?)', [req.params.id, req.uid, `%${req.uid}%`]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ...doc, content: dec(doc.content, req.key), shared_with: JSON.parse(doc.shared_with||'[]') });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/documents/:id', auth, (req, res) => {
  try {
    dbRun('DELETE FROM documents WHERE id=? AND uploaded_by=?', [req.params.id, req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── NOTICES ───────────────────────────────────────────────────────────────────
app.get('/api/notices', auth, (req, res) => {
  try {
    const rows = dbAll(`SELECT n.*, t.unit_id, u.unit_number, p.name as property_name, iss.name as issued_by_name, rcv.name as issued_to_name FROM notices n JOIN tenancies t ON t.id=n.tenancy_id JOIN units u ON u.id=t.unit_id JOIN properties p ON p.id=u.property_id JOIN users iss ON iss.id=n.issued_by JOIN users rcv ON rcv.id=n.issued_to WHERE n.issued_by=? OR n.issued_to=? ORDER BY n.created_at DESC`, [req.uid, req.uid]);
    res.json(rows.map(r => ({ ...r, content: undefined })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/notices/:id', auth, (req, res) => {
  try {
    const n = dbGet('SELECT n.*, iss.name as issued_by_name, rcv.name as issued_to_name FROM notices n JOIN users iss ON iss.id=n.issued_by JOIN users rcv ON rcv.id=n.issued_to WHERE n.id=? AND (n.issued_by=? OR n.issued_to=?)', [req.params.id, req.uid, req.uid]);
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ ...n, content: dec(n.content, req.key) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notices', auth, (req, res) => {
  try {
    const { tenancyId, type, subject, content, responseDeadline } = req.body;
    if (!tenancyId || !type || !content) return res.status(400).json({ error: 'tenancyId, type, content required' });
    const t = dbGet('SELECT * FROM tenancies WHERE id=? AND (landlord_id=? OR tenant_id=?)', [tenancyId, req.uid, req.uid]);
    if (!t) return res.status(403).json({ error: 'Tenancy not found or not yours' });
    const issuedTo = req.uid === t.landlord_id ? t.tenant_id : t.landlord_id;
    const id = uuidv4();
    dbRun('INSERT INTO notices VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, tenancyId, type, subject||type.replace(/_/g,' '), enc(content, req.key), req.uid, issuedTo, null, responseDeadline||null, 'draft', null, new Date().toISOString()]);
    notify(issuedTo, 'notice', '📋 New Legal Notice', `You have received a ${type.replace(/_/g,' ')} notice.`, '/notices');
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notices/:id', auth, (req, res) => {
  try {
    const n = dbGet('SELECT * FROM notices WHERE id=? AND issued_by=?', [req.params.id, req.uid]);
    if (!n) return res.status(403).json({ error: 'Forbidden' });
    const { status, servedAt } = req.body;
    if (status) dbRun('UPDATE notices SET status=? WHERE id=?', [status, req.params.id]);
    if (servedAt) dbRun('UPDATE notices SET served_at=? WHERE id=?', [servedAt, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── INSPECTIONS ───────────────────────────────────────────────────────────────
app.get('/api/inspections', auth, (req, res) => {
  try {
    const where = req.role === 'landlord' ? 'landlord_id' : 'tenant_id';
    const rows = dbAll(`SELECT i.*, t.unit_id, u.unit_number, p.name as property_name FROM inspections i JOIN tenancies t ON t.id=i.tenancy_id JOIN units u ON u.id=t.unit_id JOIN properties p ON p.id=u.property_id WHERE t.${where}=? ORDER BY i.created_at DESC`, [req.uid]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/inspections/:id', auth, (req, res) => {
  try {
    const insp = dbGet('SELECT * FROM inspections WHERE id=?', [req.params.id]);
    if (!insp) return res.status(404).json({ error: 'Not found' });
    const items = dbAll('SELECT * FROM inspection_items WHERE inspection_id=? ORDER BY sort_order', [req.params.id]);
    res.json({ ...insp, items });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inspections', auth, (req, res) => {
  try {
    const { tenancyId, type, overallCondition, notes, inspectorName, tenantPresent, items } = req.body;
    if (!tenancyId || !type) return res.status(400).json({ error: 'tenancyId and type required' });
    const t = dbGet('SELECT * FROM tenancies WHERE id=? AND (landlord_id=? OR tenant_id=?)', [tenancyId, req.uid, req.uid]);
    if (!t) return res.status(403).json({ error: 'Tenancy not found' });
    const id = uuidv4();
    dbRun('INSERT INTO inspections VALUES (?,?,?,?,?,?,?,?,?,?)', [id, tenancyId, type, overallCondition||'good', notes||'', inspectorName||'', req.uid, tenantPresent?1:0, 0, new Date().toISOString()]);
    if (Array.isArray(items)) {
      items.forEach((item, i) => {
        dbRun('INSERT INTO inspection_items VALUES (?,?,?,?,?,?,?,?)', [uuidv4(), id, item.room, item.item_name, item.condition||'good', item.notes||'', item.estimated_cost||0, i]);
      });
    }
    const recipient = req.uid === t.landlord_id ? t.tenant_id : t.landlord_id;
    notify(recipient, 'inspection', '🔍 Inspection Report', `A ${type.replace(/_/g,' ')} inspection report has been submitted.`, '/inspections');
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── MAINTENANCE ───────────────────────────────────────────────────────────────
app.get('/api/maintenance', auth, (req, res) => {
  try {
    const where = req.role === 'landlord' ? 'landlord_id' : 'tenant_id';
    res.json(dbAll(`SELECT m.*, u.unit_number, p.name as property_name, ten.name as tenant_name FROM maintenance m JOIN tenancies t ON t.id=m.tenancy_id JOIN units u ON u.id=t.unit_id JOIN properties p ON p.id=u.property_id JOIN users ten ON ten.id=t.tenant_id WHERE t.${where}=? ORDER BY CASE m.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, m.created_at DESC`, [req.uid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/maintenance', auth, (req, res) => {
  try {
    if (req.role !== 'tenant') return res.status(403).json({ error: 'Tenants only' });
    const { tenancyId, title, description, priority, category } = req.body;
    if (!tenancyId || !title) return res.status(400).json({ error: 'tenancyId and title required' });
    const t = dbGet('SELECT * FROM tenancies WHERE id=? AND tenant_id=?', [tenancyId, req.uid]);
    if (!t) return res.status(403).json({ error: 'Tenancy not found or not yours' });
    const id = uuidv4();
    dbRun('INSERT INTO maintenance VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, tenancyId, title, description||'', priority||'medium', category||'general', 'open', '', 0, 0, '', '', null, new Date().toISOString(), null]);
    notify(t.landlord_id, 'maintenance', `🔧 Maintenance: ${priority||'medium'} priority`, `New request: "${title}"`, '/maintenance');
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/maintenance/:id', auth, (req, res) => {
  try {
    const item = dbGet('SELECT m.*, t.landlord_id, t.tenant_id FROM maintenance m JOIN tenancies t ON t.id=m.tenancy_id WHERE m.id=?', [req.params.id]);
    if (!item || (item.landlord_id !== req.uid && item.tenant_id !== req.uid)) return res.status(403).json({ error: 'Forbidden' });
    const fields = ['status','landlord_note','estimated_cost','actual_cost','contractor_name','contractor_phone','scheduled_date','priority'];
    fields.forEach(f => { if (req.body[f] !== undefined) dbRun(`UPDATE maintenance SET ${f}=? WHERE id=?`, [req.body[f], req.params.id]); });
    if (req.body.status === 'resolved') dbRun('UPDATE maintenance SET resolved_at=? WHERE id=?', [new Date().toISOString(), req.params.id]);
    if (req.body.status === 'resolved') notify(item.tenant_id, 'maintenance', '✅ Maintenance Resolved', `Your request "${item.title}" has been resolved.`);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── EXPENSES ──────────────────────────────────────────────────────────────────
app.get('/api/expenses', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { propertyId, from, to } = req.query;
    let sql = `SELECT e.*, p.name as property_name, u.unit_number FROM expenses e LEFT JOIN properties p ON p.id=e.property_id LEFT JOIN units u ON u.id=e.unit_id WHERE p.landlord_id=?`;
    const params = [req.uid];
    if (propertyId) { sql += ' AND e.property_id=?'; params.push(propertyId); }
    if (from) { sql += ' AND e.expense_date >= ?'; params.push(from); }
    if (to) { sql += ' AND e.expense_date <= ?'; params.push(to); }
    sql += ' ORDER BY e.expense_date DESC';
    res.json(dbAll(sql, params));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/expenses', auth, (req, res) => {
  try {
    if (req.role !== 'landlord') return res.status(403).json({ error: 'Landlords only' });
    const { propertyId, unitId, tenancyId, category, description, amount, expenseDate, paidBy, vendorName, receiptRef, isRecurring, recurrence } = req.body;
    if (!category || !description || !amount || !expenseDate) return res.status(400).json({ error: 'category, description, amount, expenseDate required' });
    const id = uuidv4();
    dbRun('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, propertyId||null, unitId||null, tenancyId||null, category, description, parseFloat(amount), expenseDate, paidBy||'landlord', vendorName||'', receiptRef||'', isRecurring?1:0, recurrence||'', new Date().toISOString()]);
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/expenses/:id', auth, (req, res) => {
  try {
    dbRun('DELETE FROM expenses WHERE id=? AND property_id IN (SELECT id FROM properties WHERE landlord_id=?)', [req.params.id, req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── UTILITIES ─────────────────────────────────────────────────────────────────
app.get('/api/utilities', auth, (req, res) => {
  try {
    const where = req.role === 'landlord' ? 'landlord_id' : 'tenant_id';
    res.json(dbAll(`SELECT ut.*, u.unit_number, p.name as property_name FROM utilities ut JOIN tenancies t ON t.id=ut.tenancy_id JOIN units u ON u.id=t.unit_id JOIN properties p ON p.id=u.property_id WHERE t.${where}=? ORDER BY ut.created_at DESC`, [req.uid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/utilities', auth, (req, res) => {
  try {
    const { tenancyId, type, provider, accountNumber, monthlyAvg, paidBy, notes } = req.body;
    if (!tenancyId || !type) return res.status(400).json({ error: 'tenancyId and type required' });
    const t = dbGet('SELECT * FROM tenancies WHERE id=? AND (landlord_id=? OR tenant_id=?)', [tenancyId, req.uid, req.uid]);
    if (!t) return res.status(403).json({ error: 'Not found' });
    const id = uuidv4();
    dbRun('INSERT INTO utilities VALUES (?,?,?,?,?,?,?,?,?)', [id, tenancyId, type, provider||'', accountNumber||'', monthlyAvg||0, paidBy||'tenant', 'active', notes||'', new Date().toISOString()]);
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/utilities/:id', auth, (req, res) => {
  try {
    const fields = ['provider','account_number','monthly_avg','paid_by','status','notes'];
    fields.forEach(f => { if (req.body[f] !== undefined) dbRun(`UPDATE utilities SET ${f}=? WHERE id=?`, [req.body[f], req.params.id]); });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/utilities/:id', auth, (req, res) => {
  try {
    dbRun('DELETE FROM utilities WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── THREADS & MESSAGES ────────────────────────────────────────────────────────
app.get('/api/threads', auth, (req, res) => {
  try {
    const all = dbAll('SELECT * FROM threads ORDER BY created_at DESC');
    const mine = all.filter(t => { try { return JSON.parse(t.participants||'[]').includes(req.uid); } catch { return false; } });
    const result = mine.map(t => {
      const participants = JSON.parse(t.participants||'[]');
      const oid = participants.find(p => p !== req.uid);
      const other = oid ? dbGet('SELECT name,role FROM users WHERE id=?', [oid]) : {};
      const msgs = dbAll('SELECT * FROM messages WHERE thread_id=? ORDER BY created_at', [t.id]);
      const unread = msgs.filter(m => m.sender_id !== req.uid && !m.read_at).length;
      const last = msgs[msgs.length - 1];
      let lastMsg = null;
      if (last) { try { lastMsg = dec(last.content, req.key); } catch { lastMsg = '...'; } }
      return { ...t, participants, otherName: other?.name||'Unknown', otherRole: other?.role||'', unreadCount: unread, lastMessage: lastMsg, lastAt: last?.created_at||t.created_at };
    });
    res.json(result.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt)));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/threads', auth, (req, res) => {
  try {
    const { recipientId, tenancyId, subject } = req.body;
    if (!recipientId) return res.status(400).json({ error: 'recipientId required' });
    const parts = JSON.stringify([req.uid, recipientId].sort());
    const tid = tenancyId || null;
    const existing = dbAll('SELECT * FROM threads WHERE tenancy_id IS ? OR tenancy_id = ?', [tid, tid]).find(t => { try { const p = JSON.parse(t.participants); return p.includes(req.uid) && p.includes(recipientId); } catch { return false; } });
    if (existing) return res.json(existing);
    const id = uuidv4();
    dbRun('INSERT INTO threads VALUES (?,?,?,?,?)', [id, JSON.stringify([req.uid, recipientId]), tid, subject||'General', new Date().toISOString()]);
    res.json({ id, participants: [req.uid, recipientId], tenancy_id: tid, subject: subject||'General' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/threads/:id/messages', auth, (req, res) => {
  try {
    const th = dbGet('SELECT * FROM threads WHERE id=?', [req.params.id]);
    if (!th) return res.status(404).json({ error: 'Not found' });
    const parts = JSON.parse(th.participants||'[]');
    if (!parts.includes(req.uid)) return res.status(403).json({ error: 'Access denied' });
    dbRun("UPDATE messages SET read_at=? WHERE thread_id=? AND sender_id!=? AND read_at IS NULL", [new Date().toISOString(), req.params.id, req.uid]);
    const msgs = dbAll('SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.thread_id=? ORDER BY m.created_at', [req.params.id]);
    res.json(msgs.map(m => { let content = m.content; try { content = dec(m.content, req.key); } catch {} return { ...m, content }; }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/threads/:id/messages', auth, (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content required' });
    const th = dbGet('SELECT * FROM threads WHERE id=?', [req.params.id]);
    if (!th || !JSON.parse(th.participants||'[]').includes(req.uid)) return res.status(403).json({ error: 'Access denied' });
    const id = uuidv4();
    const sender = dbGet('SELECT name FROM users WHERE id=?', [req.uid]);
    dbRun('INSERT INTO messages VALUES (?,?,?,?,?,?,?)', [id, req.params.id, req.uid, enc(content.trim(), req.key), null, null, new Date().toISOString()]);
    const other = JSON.parse(th.participants||'[]').find(p => p !== req.uid);
    if (other) notify(other, 'message', `💬 Message from ${sender?.name}`, content.slice(0, 80), '/messages');
    res.json({ id, thread_id: req.params.id, sender_id: req.uid, sender_name: sender?.name||'', content: content.trim(), created_at: new Date().toISOString() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
app.get('/api/notifications', auth, (req, res) => {
  try {
    res.json(dbAll('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.uid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/read-all', auth, (req, res) => {
  try {
    dbRun('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/:id/read', auth, (req, res) => {
  try {
    dbRun('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
app.get('/api/dashboard', auth, (req, res) => {
  try {
    autoOverdue();
    const now = new Date();
    if (req.role === 'landlord') {
      const props = dbAll('SELECT * FROM properties WHERE landlord_id=?', [req.uid]);
      const units = props.length > 0 ? dbAll(`SELECT * FROM units WHERE property_id IN (${props.map(()=>'?').join(',')})`, props.map(p=>p.id)) : [];
      const tens  = dbAll('SELECT * FROM tenancies WHERE landlord_id=?', [req.uid]);
      const active= tens.filter(t => t.status === 'active');
      const tids  = tens.map(t => t.id);
      const cqs   = tids.length > 0 ? dbAll(`SELECT * FROM cheques WHERE tenancy_id IN (${tids.map(()=>'?').join(',')})`, tids) : [];
      const earned= cqs.filter(c => c.status==='paid').reduce((s,c) => s+c.amount,0);
      const mnow  = cqs.filter(c => c.status==='paid'&&c.paid_at&&new Date(c.paid_at).getMonth()===now.getMonth()&&new Date(c.paid_at).getFullYear()===now.getFullYear()).reduce((s,c) => s+c.amount,0);
      const due   = cqs.filter(c => c.status!=='paid').reduce((s,c) => s+c.amount,0);
      const ovAmt = cqs.filter(c => c.status==='overdue').reduce((s,c) => s+c.amount,0);
      const ovCnt = cqs.filter(c => c.status==='overdue').length;
      const maintO= tids.length > 0 ? dbAll(`SELECT COUNT(*) as n FROM maintenance WHERE status='open' AND tenancy_id IN (${tids.map(()=>'?').join(',')})`, tids)[0]?.n||0 : 0;
      const expiring=active.filter(t => { const d=Math.floor((new Date(t.end_date)-now)/86400000); return d>=0&&d<=90; }).length;
      const unread=dbGet('SELECT COUNT(*) as n FROM notifications WHERE user_id=? AND is_read=0', [req.uid])?.n||0;
      const chart=[];
      for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const e=cqs.filter(c=>c.status==='paid'&&c.paid_at&&new Date(c.paid_at).getMonth()===d.getMonth()&&new Date(c.paid_at).getFullYear()===d.getFullYear()).reduce((s,c)=>s+c.amount,0); chart.push({month:d.toLocaleDateString('en-AE',{month:'short',year:'2-digit'}),earned:e}); }
      const recent=cqs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6).map(c=>{ const t=tens.find(x=>x.id===c.tenancy_id)||{}; const ten=dbGet('SELECT name FROM users WHERE id=?',[t.tenant_id])||{}; const u=units.find(x=>x.id===t.unit_id)||{}; return {...c,tenantName:ten.name||'',unitNumber:u.unit_number||''}; });
      const totalExpenses=dbGet(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE property_id IN (${props.length>0?props.map(()=>'?').join(','):'NULL'})`,props.map(p=>p.id))?.total||0;
      const netIncome=earned-totalExpenses;
      res.json({role:'landlord',totalProperties:props.length,totalUnits:units.length,occupiedUnits:units.filter(u=>u.status==='occupied').length,vacantUnits:units.filter(u=>u.status==='vacant').length,activeTenancies:active.length,totalEarned:earned,thisMonthEarned:mnow,totalDue:due,overdueAmt:ovAmt,overdueCount:ovCnt,maintenanceOpen:maintO,expiringLeases:expiring,unreadNotifications:unread,totalExpenses,netIncome,monthlyChart:chart,recentCheques:recent});
    } else {
      const tens=dbAll('SELECT * FROM tenancies WHERE tenant_id=?',[req.uid]);
      const tids=tens.map(t=>t.id);
      const cqs=tids.length>0?dbAll(`SELECT * FROM cheques WHERE tenancy_id IN (${tids.map(()=>'?').join(',')})`,tids):[];
      const at=tens.find(t=>t.status==='active');
      const unit=at?dbGet('SELECT u.*,p.name as property_name,p.address as property_address,p.emirate FROM units u JOIN properties p ON p.id=u.property_id WHERE u.id=?',[at.unit_id]):null;
      const ll=at?dbGet('SELECT name,phone FROM users WHERE id=?',[at.landlord_id]):null;
      const paid=cqs.filter(c=>c.status==='paid').reduce((s,c)=>s+c.amount,0);
      const due=cqs.filter(c=>c.status!=='paid').reduce((s,c)=>s+c.amount,0);
      const ov=cqs.filter(c=>c.status==='overdue');
      const upcoming=cqs.filter(c=>c.status==='pending'&&new Date(c.due_date)>now).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).slice(0,5);
      const maintO=tids.length>0?dbAll(`SELECT COUNT(*) as n FROM maintenance WHERE status='open' AND tenancy_id IN (${tids.map(()=>'?').join(',')})`,tids)[0]?.n||0:0;
      const unread=dbGet('SELECT COUNT(*) as n FROM notifications WHERE user_id=? AND is_read=0',[req.uid])?.n||0;
      const daysL=at?Math.max(0,Math.floor((new Date(at.end_date)-now)/86400000)):null;
      res.json({role:'tenant',activeTenancy:at?{...at,unitNumber:unit?.unit_number||'',propertyName:unit?.property_name||'',propertyAddress:unit?.property_address||'',emirate:unit?.emirate||'',landlordName:ll?.name||'',landlordPhone:ll?.phone||'',daysLeft:daysL}:null,totalPaid:paid,totalDue:due,overdueCount:ov.length,overdueAmt:ov.reduce((s,c)=>s+c.amount,0),upcomingPayments:upcoming,maintenanceOpen:maintO,unreadNotifications:unread,totalCheques:cqs.length});
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── AI CHAT ───────────────────────────────────────────────────────────────────
app.post('/api/chat', auth, apiLim, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in .env' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: req.body.system||'', messages: req.body.messages||[] }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message||'AI error' });
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chat-history', auth, (req, res) => {
  try {
    const rows = dbAll('SELECT * FROM chat_history WHERE user_id=? ORDER BY created_at LIMIT 100', [req.uid]);
    res.json(rows.map(r => ({ ...r, content: dec(r.content, req.key) })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat-history', auth, (req, res) => {
  try {
    const { role, content } = req.body;
    if (!role || !content) return res.json({ ok: true });
    dbRun('INSERT INTO chat_history VALUES (?,?,?,?,?)', [uuidv4(), req.uid, role, enc(content, req.key), new Date().toISOString()]);
    dbRun('DELETE FROM chat_history WHERE user_id=? AND id NOT IN (SELECT id FROM chat_history WHERE user_id=? ORDER BY created_at DESC LIMIT 500)', [req.uid, req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/chat-history', auth, (req, res) => {
  try { dbRun('DELETE FROM chat_history WHERE user_id=?', [req.uid]); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DRAFTS ────────────────────────────────────────────────────────────────────
app.get('/api/drafts', auth, (req, res) => {
  try {
    const rows = dbAll('SELECT * FROM drafts WHERE user_id=? ORDER BY updated_at DESC', [req.uid]);
    res.json(rows.map(r => ({ ...r, title: dec(r.title, req.key), content: dec(r.content, req.key) })).filter(r => r.title));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/drafts', auth, (req, res) => {
  try {
    const { title, content, type, emirate } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content required' });
    const id = uuidv4(), now = new Date().toISOString();
    dbRun('INSERT INTO drafts VALUES (?,?,?,?,?,?,?,?)', [id, req.uid, enc(title, req.key), enc(content, req.key), type||'notice', emirate||'dubai', now, now]);
    res.json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/drafts/:id', auth, (req, res) => {
  try {
    if (req.body.title) dbRun('UPDATE drafts SET title=?,updated_at=? WHERE id=? AND user_id=?', [enc(req.body.title, req.key), new Date().toISOString(), req.params.id, req.uid]);
    if (req.body.content) dbRun('UPDATE drafts SET content=?,updated_at=? WHERE id=? AND user_id=?', [enc(req.body.content, req.key), new Date().toISOString(), req.params.id, req.uid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/drafts/:id', auth, (req, res) => {
  try { dbRun('DELETE FROM drafts WHERE id=? AND user_id=?', [req.params.id, req.uid]); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// Legacy compat routes
app.patch('/api/auth/emirate', auth, (req, res) => { try { if (req.body.emirate) dbRun('UPDATE users SET emirate=? WHERE id=?',[req.body.emirate,req.uid]); res.json({ok:true}); } catch(e){res.status(500).json({error:e.message});} });
app.get('/api/stats', auth, (req, res) => { try { res.json({ messages: dbGet('SELECT COUNT(*) as n FROM chat_history WHERE user_id=?',[req.uid])?.n||0, drafts: dbGet('SELECT COUNT(*) as n FROM drafts WHERE user_id=?',[req.uid])?.n||0 }); } catch(e){res.status(500).json({error:e.message});} });
app.post('/api/activity', auth, (req, res) => res.json({ ok: true }));
app.get('/api/activity', auth, (req, res) => res.json([]));

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  try {
    res.json({
      status: 'ok', version: '3.0', db: 'SQLite (sql.js)', ts: new Date().toISOString(),
      counts: {
        users: dbGet('SELECT COUNT(*) as n FROM users')?.n||0,
        properties: dbGet('SELECT COUNT(*) as n FROM properties')?.n||0,
        units: dbGet('SELECT COUNT(*) as n FROM units')?.n||0,
        tenancies: dbGet('SELECT COUNT(*) as n FROM tenancies')?.n||0,
        contracts: dbGet('SELECT COUNT(*) as n FROM contracts')?.n||0,
        cheques: dbGet('SELECT COUNT(*) as n FROM cheques')?.n||0,
      }
    });
  } catch { res.json({ status: 'ok', version: '3.0' }); }
});

// ── STATIC FRONTEND ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', (req, res) => {
  const p = path.join(__dirname, '../frontend/dist/index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.json({ message: 'TenantShield v3 — Frontend not built yet. Run: cd frontend && npm install && npm run dev' });
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🏠 TenantShield v3.0 — SQLite edition`);
    console.log(`   Running at:  http://localhost:${PORT}`);
    console.log(`   Health:      http://localhost:${PORT}/api/health`);
    console.log(`   Database:    ${DB_FILE}`);
    if (!process.env.ANTHROPIC_API_KEY) console.log(`   ⚠️  Add ANTHROPIC_API_KEY to .env for AI chat`);
    console.log('');
  });
}).catch(e => { console.error('Failed to init database:', e.message); process.exit(1); });
