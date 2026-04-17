# TenantShield v2 — UAE Property Management AI

Full-stack property management for UAE landlords and tenants.
End-to-end encrypted, role-aware, AI legal assistant built in.

## Run locally

### Backend
```bash
cd backend
npm install
cp .env.example .env   # then add your ANTHROPIC_API_KEY
node server.js
```

### Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — register as Landlord or Tenant.

## Deploy

Backend → Railway.app (root dir: `backend`, start command: `npm install && node server.js`)
Frontend → Vercel (root dir: `frontend`, env: `VITE_API_URL=your-railway-url`)

See README_FULL.md for complete documentation.
