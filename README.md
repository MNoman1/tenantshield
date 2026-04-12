# 🏠 TenantShield — UAE Tenancy AI

A full-stack, end-to-end encrypted SaaS web app for UAE landlords and tenants.
Users can chat with an AI trained on UAE tenancy law, calculate legal rent increases, draft notice letters, and track all activity — all encrypted per-user at rest.

---

## ✅ What's Built

| Feature | Status |
|---|---|
| User registration & login | ✅ |
| JWT sessions (7-day) | ✅ |
| AES-256-GCM per-user encryption | ✅ |
| Bcrypt password hashing (cost 12) | ✅ |
| AI chat with UAE tenancy law context | ✅ |
| Persistent encrypted chat history | ✅ |
| Rent increase calculator (all emirates) | ✅ |
| Save results as encrypted drafts | ✅ |
| Edit / delete drafts | ✅ |
| Encrypted activity log | ✅ |
| Rate limiting (auth + API) | ✅ |
| Security headers (helmet) | ✅ |
| React frontend (Vite) | ✅ |
| Responsive sidebar layout | ✅ |
| Quick-action dashboard | ✅ |

---

## 🔐 Security Architecture

```
User Password
     │
     ▼
bcrypt hash (cost 12) ──── stored in DB
     │
     ▼
scrypt key derivation (hash + server_salt)
     │
     ▼
AES-256-GCM key (32 bytes)
     │
     ├── Encrypts chat messages before storage
     ├── Encrypts draft titles + content
     └── Encrypts activity log descriptions

JWT token contains: { userId, encKey (hex) }
Only the logged-in user's token holds the decryption key.
Server cannot decrypt data without the user's JWT.
```

**What's encrypted at rest:**
- All chat messages (user and AI)
- All draft titles and content
- All activity log descriptions

**What's NOT stored in plaintext:**
- Passwords (bcrypt hashed)
- Chat content (AES-256-GCM encrypted)
- Documents (AES-256-GCM encrypted)

---

## 🚀 Local Development

### 1. Backend

```bash
cd backend
npm install
node server.js
# Runs on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000 (proxies /api to :4000)
```

### 3. Open http://localhost:3000 — register and start using it

---

## 🌐 Deploy to Production (Recommended: free tier)

### Backend → Railway.app

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Select the `backend/` folder
3. Set environment variables:
   ```
   JWT_SECRET=your_very_long_random_secret_here_min_32_chars
   PORT=4000
   ```
4. Railway gives you a URL like `https://uae-tenancy-api.up.railway.app`

### Frontend → Vercel

1. Go to https://vercel.com → New Project → import GitHub repo
2. Set root directory to `frontend/`
3. Add environment variable:
   ```
   VITE_API_URL=https://uae-tenancy-api.up.railway.app
   ```
4. In `frontend/vite.config.js`, update the proxy target to your Railway URL
5. Vercel gives you `https://tenantshield.vercel.app`

### Custom Domain
- Buy `tenantshield.ae` from Namecheap (~AED 50/year)
- Point DNS to Vercel
- Done — you have a professional UAE product

---

## 🔑 Anthropic API Key Setup

The app calls the Anthropic API directly from the browser (using `anthropic-dangerous-direct-browser-access` header for prototyping).

**For production**, move API calls to the backend:

1. Add to backend `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Add a backend route in `server.js`:
   ```js
   app.post('/api/chat', requireAuth, async (req, res) => {
     const { messages, system } = req.body
     const response = await fetch('https://api.anthropic.com/v1/messages', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'x-api-key': process.env.ANTHROPIC_API_KEY,
         'anthropic-version': '2023-06-01',
       },
       body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system, messages }),
     })
     const data = await response.json()
     res.json(data)
   })
   ```

3. In `ChatPage.jsx`, change the fetch URL from `https://api.anthropic.com/v1/messages` to `/api/chat`
   and remove the `anthropic-dangerous-direct-browser-access` header.

---

## 💰 Monetization Plan

| Tier | Price | Features |
|---|---|---|
| Free | AED 0 | 10 questions/month, 3 drafts |
| Pro | AED 49/month | Unlimited chats, unlimited drafts, letter drafting |
| Agency | AED 499/month | White-label, 50 sub-users, custom branding |

**To add payment limits**, check `stats.messages` in the backend and return 402 when free tier is exceeded.

**UAE payment gateways:**
- Telr (https://telr.com) — UAE-based, supports AED
- Stripe — works in UAE with international card

---

## 📁 Project Structure

```
uae-tenancy-app/
├── backend/
│   ├── server.js          # Express API — auth, encryption, storage
│   ├── db.json            # JSON database (auto-created, all encrypted)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx                    # Routing
    │   ├── context/AuthContext.jsx    # Auth state, JWT management
    │   ├── components/Layout.jsx      # Sidebar + navigation
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── DashboardPage.jsx      # Stats + quick actions
    │   │   ├── ChatPage.jsx           # AI chat + history
    │   │   ├── CalculatorPage.jsx     # Rent increase calculator
    │   │   ├── DraftsPage.jsx         # Encrypted draft manager
    │   │   └── ActivityPage.jsx       # Activity log
    │   └── index.css                  # Full design system
    ├── index.html
    └── vite.config.js
```

---

## 🛠 Upgrading the Database

The app uses a JSON file database (zero native dependencies). For production scale, migrate to:

**Option A — PostgreSQL (recommended for scale)**
```bash
npm install pg
```
Replace `readDB()`/`writeDB()` with `pg` queries.

**Option B — SQLite with libsql (Turso — free cloud SQLite)**
```bash
npm install @libsql/client
```

---

## ⚠️ Disclaimer

This app provides general legal information, not official legal advice.
Always recommend users consult a UAE-licensed legal professional for specific situations.
