# 🏠 TenantShield v3 — UAE Property Management Platform
### SQLite Edition — Full-stack, end-to-end encrypted

---

## ⚡ Quick Start (Local)

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY and change JWT_SECRET
node server.js
# → TenantShield v3.0 — SQLite edition running at http://localhost:4000
```

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
# → Local: http://localhost:3000
```

### 3. Open http://localhost:3000
Register as **Landlord** first. Then register a second account as **Tenant**.

---

## 🗄️ SQL Schema — 18 Tables

```sql
users            — Landlords and tenants with roles
properties       — Buildings/complexes per landlord
units            — Individual units with bedrooms, status, rent
tenancies        — Contracts linking landlord + tenant + unit
contracts        — Digital tenancy agreements with signing workflow
cheques          — Payment schedule (post-dated cheques)
receipts         — Auto-generated payment receipts
documents        — Encrypted file vault (Ejari, passports, NOCs)
threads          — Messaging threads between landlord/tenant
messages         — Encrypted chat messages per thread
maintenance      — Tenant-raised maintenance requests
inspections      — Move-in/move-out inspection reports
inspection_items — Room-by-room condition checklist items
notices          — Legal notices (eviction, rent increase, etc.)
expenses         — Landlord expense tracking per property
utilities        — DEWA, cooling, internet accounts per unit
notifications    — In-app notifications with read/unread
chat_history     — Encrypted AI chat history
drafts           — Saved AI-generated notice letters
```

---

## 🏗️ Feature Set

### Landlord
| Feature | Description |
|---|---|
| Portfolio Dashboard | Total units, occupancy, earnings, dues, overdue alerts |
| Properties Manager | Add/edit buildings with occupancy stats |
| Units Manager | Vacant/occupied filter, tenant info, rent amounts |
| Tenancy Contracts | Create & manage leases |
| Auto-Generate Contracts | One-click UAE-compliant tenancy agreement |
| Digital Signing | Landlord sends → Tenant reviews & signs |
| Cheque Tracker | Log post-dated cheques, mark paid/bounced |
| Bulk Cheques | Add full year of cheques at once |
| Auto Receipts | Receipt auto-generated when cheque marked paid |
| Legal Notices | 90-day rent notice, eviction, rent demand with templates |
| Expense Tracker | Maintenance costs, fees, insurance by category |
| Utilities Manager | DEWA, cooling, internet accounts per unit |
| Inspections | Move-in/out reports with room-by-room condition |
| Maintenance | Track and resolve tenant requests |
| Document Vault | Upload and share encrypted files |
| Messages | Direct encrypted chat with tenants |
| Monthly Earnings Chart | 6-month earnings trend |
| Notifications | Real-time alerts for payments, requests, messages |

### Tenant
| Feature | Description |
|---|---|
| Tenancy Dashboard | Lease summary, days left, upcoming payments |
| Payment Schedule | All cheques with due dates and status |
| Total Dues | Outstanding balance at a glance |
| Contract Viewer | View and sign tenancy contracts |
| Legal Notices | Receive and acknowledge/dispute notices |
| Move-In Inspection | View condition report at handover |
| Document Access | View shared Ejari, contracts, NOCs |
| Maintenance Requests | Report issues by category & priority |
| Utility Accounts | View DEWA, cooling account details |
| Messages | Direct encrypted chat with landlord |
| AI Assistant | UAE tenancy law expert |
| Rent Calculator | Check if increase is legal |

### Security
- AES-256-GCM encryption on sensitive stored data
- Bcrypt password hashing (cost 12)
- JWT sessions (7-day tokens)
- Per-user encryption keys derived from password hash
- Rate limiting on auth and API endpoints
- SQLite with WAL mode for reliable writes

---

## 🌐 Deploy to Production

### Backend → Railway.app
1. Push to GitHub
2. Railway → New Project → GitHub → root dir: `backend`
3. Environment variables:
   ```
   JWT_SECRET        = (long random string, min 32 chars)
   ANTHROPIC_API_KEY = sk-ant-api03-...
   PORT              = 4000
   ```
4. Start command: `npm install && node server.js`
5. Your URL: `https://tenantshield-api.up.railway.app`

### Frontend → Vercel
1. Vercel → New Project → GitHub → root dir: `frontend`
2. Environment variable:
   ```
   VITE_API_URL = https://tenantshield-api.up.railway.app
   ```
3. Your URL: `https://tenantshield.vercel.app`

### Custom Domain
- Buy `tenantshield.ae` (~AED 50/year)
- Point to Vercel via DNS

---

## 💰 Monetization

| Plan | Price | Features |
|---|---|---|
| Free | AED 0 | 1 property, 5 units, 10 AI questions/month |
| Pro Landlord | AED 99/month | Unlimited + AI contracts + analytics |
| Pro Tenant | AED 29/month | Unlimited AI + full document access |
| Agency | AED 499/month | White-label, 50 users, API access |

**UAE Payments:** Telr · PayTabs · Stripe

---

## 📁 Project Structure

```
backend/
  server.js          739-line Express + sql.js API
  .env.example       Environment variable template
  railway.json       Railway deployment config
  tenantshield.db    Auto-created SQLite database

frontend/src/
  App.jsx                     All routes
  api.js                      Axios instance with base URL
  index.css                   Full design system
  context/AuthContext.jsx     JWT auth + role management
  components/
    Layout.jsx                Sidebar with role-based nav
    ui.jsx                    Modal, Toast, Field helpers
  pages/
    AuthPages.jsx             Login + Register with role picker
    DashboardPage.jsx         Role-aware overview
    PropertiesPage.jsx        Building management
    UnitsPage.jsx             Unit tracker
    TenanciesPage.jsx         Lease management
    ChequesPage.jsx           Payment tracker
    ContractsPage.jsx    ★    Auto-generate + digital signing
    NoticesPage.jsx      ★    Legal notice templates
    InspectionsPage.jsx  ★    Room-by-room checklists
    ExpensesPage.jsx     ★    Expense tracker + analytics
    UtilitiesPage.jsx    ★    DEWA/cooling/internet per unit
    MessagesPage.jsx          Encrypted messaging
    DocumentsPage.jsx         Encrypted file vault
    MaintenancePage.jsx       Issue tracker
    ChatPage.jsx              AI assistant
    CalculatorPage.jsx        Rent increase checker
    DraftsPage.jsx            Saved AI drafts
    
★ = new in v3
```
