import { useState } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const EMIRATE_RULES = {
  dubai: {
    name: 'Dubai',
    description: 'Based on RERA Rental Index (Law No. 26 of 2007)',
    type: 'index',
    brackets: [
      { maxGap: 10, maxIncrease: 0 },
      { maxGap: 20, maxIncrease: 5 },
      { maxGap: 30, maxIncrease: 10 },
      { maxGap: 40, maxIncrease: 15 },
      { maxGap: Infinity, maxIncrease: 20 },
    ]
  },
  sharjah: {
    name: 'Sharjah',
    description: '3-year rent freeze — zero increases permitted (2025 reforms)',
    type: 'freeze',
  },
  abudhabi: {
    name: 'Abu Dhabi',
    description: '5% annual cap — Dept. of Municipalities and Transport',
    type: 'cap',
    cap: 5,
  },
  ajman: {
    name: 'Ajman',
    description: 'Governed by Ajman Municipality — generally similar to Dubai framework',
    type: 'cap',
    cap: 9,
  },
  rak: {
    name: 'Ras Al Khaimah',
    description: 'RAK Municipality governs — consult local authority for current caps',
    type: 'cap',
    cap: 9,
  },
}

export default function CalculatorPage() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    emirate: user?.emirate || 'dubai',
    currentRent: '',
    indexRent: '',
    proposedRent: '',
  })
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const calculate = () => {
    const cur = parseFloat(form.currentRent)
    const proposed = parseFloat(form.proposedRent)
    const idx = parseFloat(form.indexRent)
    const rules = EMIRATE_RULES[form.emirate]
    if (!cur || !proposed) return showToast('Please enter current and proposed rent', 'error')
    if (rules.type === 'index' && !idx) return showToast('Please enter the RERA index rent for Dubai', 'error')

    let maxIncreasePct = 0
    let gapPct = null
    let legal = false
    let maxRent = 0
    let verdict = ''
    let explanation = ''

    if (rules.type === 'freeze') {
      maxIncreasePct = 0
      maxRent = cur
      legal = proposed <= cur
      verdict = legal ? 'LEGAL' : 'ILLEGAL — Rent Freeze Active'
      explanation = `Sharjah has an active 3-year rent freeze under 2025 reforms. Landlords cannot increase rent regardless of market conditions. Any increase above AED ${cur.toLocaleString()} is legally challengeable at Sharjah Municipality.`
    } else if (rules.type === 'cap') {
      maxIncreasePct = rules.cap
      maxRent = Math.round(cur * (1 + rules.cap / 100))
      const actualPct = ((proposed - cur) / cur) * 100
      legal = proposed <= maxRent
      verdict = legal ? 'LEGAL' : `ILLEGAL — Exceeds ${rules.cap}% Cap`
      explanation = `${rules.name} caps annual rent increases at ${rules.cap}%. Your current rent of AED ${cur.toLocaleString()} can increase to a maximum of AED ${maxRent.toLocaleString()} (${rules.cap}%). The proposed rent of AED ${proposed.toLocaleString()} represents a ${actualPct.toFixed(1)}% increase.`
    } else {
      // Dubai index-based
      gapPct = ((idx - cur) / idx) * 100
      const bracket = rules.brackets.find(b => gapPct <= b.maxGap)
      maxIncreasePct = bracket.maxIncrease
      maxRent = Math.round(cur * (1 + maxIncreasePct / 100))
      const actualPct = ((proposed - cur) / cur) * 100
      legal = proposed <= maxRent
      verdict = legal ? 'LEGAL' : `ILLEGAL — Exceeds ${maxIncreasePct}% RERA Cap`
      explanation = `Your current rent is ${gapPct.toFixed(1)}% below the RERA Rental Index. Under Law No. 26 of 2007, this means the maximum permitted increase is ${maxIncreasePct}%. The maximum legal rent is AED ${maxRent.toLocaleString()}. The proposed rent of AED ${proposed.toLocaleString()} ${legal ? 'is within' : 'exceeds'} this limit.`
    }

    const savingIfLegal = legal ? 0 : proposed - maxRent
    setResult({ legal, verdict, explanation, maxRent, maxIncreasePct, gapPct, savingIfLegal, cur, proposed, rules })
    axios.post('/api/activity', { type: 'calc', description: `Calculated rent legality for ${rules.name}: ${verdict}`, icon: '🧮' }).catch(() => {})
  }

  const saveToDrafts = async () => {
    if (!result) return
    const content = `RENT INCREASE LEGALITY CHECK
${new Date().toLocaleDateString('en-AE', { dateStyle: 'full' })}

EMIRATE: ${result.rules.name}
CURRENT RENT: AED ${result.cur.toLocaleString()}/year
PROPOSED RENT: AED ${result.proposed.toLocaleString()}/year
MAXIMUM LEGAL RENT: AED ${result.maxRent.toLocaleString()}/year

VERDICT: ${result.verdict}
${result.gapPct !== null ? `GAP BELOW INDEX: ${result.gapPct.toFixed(1)}%\n` : ''}MAX PERMITTED INCREASE: ${result.maxIncreasePct}%
${result.savingIfLegal > 0 ? `OVERCHARGE AMOUNT: AED ${result.savingIfLegal.toLocaleString()}/year` : ''}

LEGAL BASIS:
${result.explanation}

NEXT STEPS:
${result.legal
  ? '- The proposed increase appears to be within legal limits.\n- Ensure you receive 90 days written notice before implementation.\n- Verify the RERA index figure at the official DLD portal.'
  : '- Challenge this increase at the Rent Dispute Settlement Centre (Dubai) or relevant authority.\n- File within 30 days of receiving the notice.\n- Bring your Ejari registration, tenancy contract, and landlord notice.\n- You may also contact RERA at 800-4488.'}

⚠️ This calculation is for informational purposes only. Consult a UAE-licensed legal professional for official advice.`

    try {
      await axios.post('/api/drafts', {
        title: `Rent Calculator — ${result.rules.name} — ${new Date().toLocaleDateString('en-AE')}`,
        content,
        type: 'calc',
        emirate: form.emirate,
      })
      await axios.post('/api/activity', { type: 'draft_saved', description: 'Saved rent calculation as draft', icon: '📄' })
      showToast('Saved to drafts ✓')
    } catch { showToast('Failed to save', 'error') }
  }

  const rules = EMIRATE_RULES[form.emirate]

  return (
    <>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <div className="page-header">
        <div className="page-title">Rent Increase Calculator</div>
        <div className="page-sub">Check if your landlord's rent increase is legal under UAE law</div>
      </div>

      <div className="calc-body">
        <div className="calc-grid">
          <div className="calc-card">
            <div className="calc-card-title">🧮 Enter Details</div>

            <div className="field-group">
              <label className="field-label">EMIRATE</label>
              <select className="field-select" value={form.emirate} onChange={e => setForm(f => ({ ...f, emirate: e.target.value }))}>
                {Object.entries(EMIRATE_RULES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, fontFamily: 'IBM Plex Mono' }}>{rules.description}</div>
            </div>

            <div className="field-group">
              <label className="field-label">CURRENT ANNUAL RENT (AED)</label>
              <input className="field-input" type="number" placeholder="e.g. 60000" value={form.currentRent}
                onChange={e => setForm(f => ({ ...f, currentRent: e.target.value }))} />
            </div>

            {rules.type === 'index' && (
              <div className="field-group">
                <label className="field-label">RERA INDEX RENT (AED) — check at DLD portal</label>
                <input className="field-input" type="number" placeholder="e.g. 80000" value={form.indexRent}
                  onChange={e => setForm(f => ({ ...f, indexRent: e.target.value }))} />
              </div>
            )}

            <div className="field-group">
              <label className="field-label">PROPOSED NEW RENT (AED)</label>
              <input className="field-input" type="number" placeholder="e.g. 72000" value={form.proposedRent}
                onChange={e => setForm(f => ({ ...f, proposedRent: e.target.value }))} />
            </div>

            <button className="calc-btn-full" onClick={calculate}>Calculate →</button>
          </div>

          <div className="calc-card">
            <div className="calc-card-title">📊 Result</div>

            {!result ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">🧮</div>
                <div className="empty-title">Fill in the details</div>
                <div className="empty-sub">Enter your rent amounts and click Calculate</div>
              </div>
            ) : (
              <div className="result-box">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div className="result-highlight">AED {result.maxRent.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Maximum legal annual rent</div>
                    <span className={`pill ${result.legal ? 'pill-green' : 'pill-red'}`}>{result.verdict}</span>
                  </div>
                </div>

                <div className="result-row-item">
                  <span className="result-row-label">Current rent</span>
                  <span className="result-row-val">AED {result.cur.toLocaleString()}</span>
                </div>
                <div className="result-row-item">
                  <span className="result-row-label">Proposed rent</span>
                  <span className="result-row-val" style={{ color: result.legal ? 'inherit' : 'var(--red)' }}>AED {result.proposed.toLocaleString()}</span>
                </div>
                <div className="result-row-item">
                  <span className="result-row-label">Max increase allowed</span>
                  <span className="result-row-val">{result.maxIncreasePct}%</span>
                </div>
                {result.gapPct !== null && (
                  <div className="result-row-item">
                    <span className="result-row-label">Gap below RERA index</span>
                    <span className="result-row-val">{result.gapPct.toFixed(1)}%</span>
                  </div>
                )}
                {result.savingIfLegal > 0 && (
                  <div className="result-row-item">
                    <span className="result-row-label" style={{ color: 'var(--red)' }}>Overcharge per year</span>
                    <span className="result-row-val" style={{ color: 'var(--red)' }}>AED {result.savingIfLegal.toLocaleString()}</span>
                  </div>
                )}

                <div style={{ marginTop: 14, padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {result.explanation}
                </div>

                <button className="calc-btn-full" style={{ marginTop: 12 }} onClick={saveToDrafts}>
                  Save full report to Drafts →
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>📋 Dubai RERA Increase Brackets (Law No. 26 of 2007)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { gap: '0–10%', max: '0%' },
              { gap: '11–20%', max: '5%' },
              { gap: '21–30%', max: '10%' },
              { gap: '31–40%', max: '15%' },
              { gap: '>40%', max: '20%' },
            ].map((b, i) => (
              <div key={i} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 4 }}>BELOW INDEX</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.gap}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Max increase</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--green-deeper)', fontFamily: 'IBM Plex Mono' }}>{b.max}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
