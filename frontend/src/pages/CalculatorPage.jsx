import { useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui'

const RULES = {
  dubai: { name: 'Dubai', desc: 'RERA Rental Index — Law No. 26 of 2007', type: 'index' },
  sharjah: { name: 'Sharjah', desc: '3-year rent freeze active (2025 reforms) — zero increases', type: 'freeze' },
  abudhabi: { name: 'Abu Dhabi', desc: '5% annual cap — Dept. of Municipalities and Transport', type: 'cap', cap: 5 },
  ajman: { name: 'Ajman', desc: 'Ajman Municipality — max 9% per year', type: 'cap', cap: 9 },
  rak: { name: 'Ras Al Khaimah', desc: 'RAK Municipality — max 9% per year', type: 'cap', cap: 9 },
  fujairah: { name: 'Fujairah', desc: 'Fujairah Municipality', type: 'cap', cap: 9 },
  uaq: { name: 'Umm Al Quwain', desc: 'UAQ Municipality', type: 'cap', cap: 9 },
}

const DUBAI_BRACKETS = [
  { maxGap: 10, maxIncrease: 0 }, { maxGap: 20, maxIncrease: 5 },
  { maxGap: 30, maxIncrease: 10 }, { maxGap: 40, maxIncrease: 15 },
  { maxGap: Infinity, maxIncrease: 20 },
]

export default function CalculatorPage() {
  const { user } = useAuth()
  const [form, setForm] = useState({ emirate: user?.emirate || 'dubai', currentRent: '', indexRent: '', proposedRent: '' })
  const [result, setResult] = useState(null)
  const [showToast, Toast] = useToast()

  const fmt = n => Number(n || 0).toLocaleString('en-AE')

  const calculate = () => {
    const cur = parseFloat(form.currentRent)
    const proposed = parseFloat(form.proposedRent)
    const idx = parseFloat(form.indexRent)
    const rules = RULES[form.emirate]
    if (!cur || !proposed) return showToast('Enter current and proposed rent', 'error')
    if (rules.type === 'index' && !idx) return showToast('Enter the RERA index rent for Dubai', 'error')

    let maxPct = 0, maxRent = 0, verdict = '', explanation = '', legal = false, gapPct = null

    if (rules.type === 'freeze') {
      maxRent = cur; legal = proposed <= cur
      verdict = legal ? 'LEGAL' : 'ILLEGAL — Rent Freeze Active'
      explanation = `Sharjah has an active 3-year rent freeze under 2025 reforms. No increases are permitted regardless of market conditions. Any amount above AED ${fmt(cur)} per year is illegal and can be challenged at Sharjah Municipality.`
    } else if (rules.type === 'cap') {
      maxPct = rules.cap; maxRent = Math.round(cur * (1 + rules.cap / 100))
      const actualPct = ((proposed - cur) / cur) * 100
      legal = proposed <= maxRent
      verdict = legal ? 'LEGAL' : `ILLEGAL — Exceeds ${rules.cap}% Cap`
      explanation = `${rules.name} caps annual rent increases at ${rules.cap}%. Your current rent of AED ${fmt(cur)} can rise to a maximum of AED ${fmt(maxRent)}. The proposed rent of AED ${fmt(proposed)} is a ${actualPct.toFixed(1)}% increase.`
    } else {
      gapPct = ((idx - cur) / idx) * 100
      const bracket = DUBAI_BRACKETS.find(b => gapPct <= b.maxGap)
      maxPct = bracket.maxIncrease; maxRent = Math.round(cur * (1 + maxPct / 100))
      const actualPct = ((proposed - cur) / cur) * 100
      legal = proposed <= maxRent
      verdict = legal ? 'LEGAL' : `ILLEGAL — Exceeds ${maxPct}% RERA Cap`
      explanation = `Your current rent is ${gapPct.toFixed(1)}% below the RERA index. Under Law No. 26 of 2007, the maximum permitted increase is ${maxPct}%, making the legal ceiling AED ${fmt(maxRent)}. Your proposed rent of AED ${fmt(proposed)} represents a ${actualPct.toFixed(1)}% increase.`
    }

    setResult({ legal, verdict, explanation, maxRent, maxPct, gapPct, cur, proposed, rules, overcharge: Math.max(0, proposed - maxRent) })
  }

  const saveReport = async () => {
    if (!result) return
    const content = `RENT INCREASE LEGALITY REPORT
Date: ${new Date().toLocaleDateString('en-AE', { dateStyle: 'full' })}

EMIRATE: ${result.rules.name}
CURRENT RENT: AED ${fmt(result.cur)}/year
PROPOSED RENT: AED ${fmt(result.proposed)}/year
MAXIMUM LEGAL RENT: AED ${fmt(result.maxRent)}/year

VERDICT: ${result.verdict}
${result.gapPct !== null ? `GAP BELOW RERA INDEX: ${result.gapPct.toFixed(1)}%\n` : ''}MAX PERMITTED INCREASE: ${result.maxPct}%
${result.overcharge > 0 ? `OVERCHARGE AMOUNT: AED ${fmt(result.overcharge)}/year (AED ${fmt(Math.round(result.overcharge/12))}/month)\n` : ''}
ANALYSIS:
${result.explanation}

NEXT STEPS:
${result.legal
  ? '- The increase appears within legal limits.\n- Ensure you receive 90 days written notice (Dubai) before implementation.\n- Verify the RERA index at the official DLD portal: dubailand.gov.ae'
  : '- Challenge this increase at the relevant authority:\n  Dubai: Rent Dispute Settlement Centre — rdsc.ae\n  Abu Dhabi: ADJD — adjd.gov.ae\n  Sharjah: Sharjah Municipality — shjmun.gov.ae\n- File within 30 days of receiving the notice.\n- Bring: Ejari registration, tenancy contract, landlord\'s notice letter.'}

⚠️ This report is for informational purposes only. Consult a UAE-licensed legal professional for official advice.`

    await api.post('/api/drafts', { title: `Rent Report — ${result.rules.name} — ${new Date().toLocaleDateString('en-AE')}`, content, type: 'calc', emirate: form.emirate }).catch(() => {})
    showToast('Saved to drafts ✓')
  }

  return (
    <>
      {Toast}
      <div className="page-header">
        <div><div className="page-title">Rent Increase Calculator</div><div className="page-sub">Check legality of rent increases under UAE law</div></div>
      </div>

      <div className="page-body">
        <div className="two-col">
          <div className="card">
            <div className="card-header"><span className="card-title">🧮 Enter details</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">EMIRATE</label>
                <select className="form-select" value={form.emirate} onChange={e => setForm(f => ({ ...f, emirate: e.target.value }))}>
                  {Object.entries(RULES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                </select>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontFamily: 'IBM Plex Mono' }}>{RULES[form.emirate]?.desc}</div>
              </div>
              <div>
                <label className="form-label">CURRENT ANNUAL RENT (AED)</label>
                <input className="form-input" type="number" placeholder="e.g. 60000" value={form.currentRent} onChange={e => setForm(f => ({ ...f, currentRent: e.target.value }))} />
              </div>
              {RULES[form.emirate]?.type === 'index' && (
                <div>
                  <label className="form-label">RERA INDEX RENT (AED) — from dubailand.gov.ae</label>
                  <input className="form-input" type="number" placeholder="e.g. 80000" value={form.indexRent} onChange={e => setForm(f => ({ ...f, indexRent: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="form-label">PROPOSED NEW RENT (AED)</label>
                <input className="form-input" type="number" placeholder="e.g. 72000" value={form.proposedRent} onChange={e => setForm(f => ({ ...f, proposedRent: e.target.value }))} />
              </div>
              <button className="btn btn-green" style={{ width: '100%', padding: 11, fontSize: 14 }} onClick={calculate}>Calculate →</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">📊 Result</span></div>
            <div className="card-body">
              {!result ? (
                <div className="empty-state" style={{ padding: '30px 0' }}>
                  <div className="empty-icon">🧮</div>
                  <div className="empty-title">Enter rent amounts</div>
                  <div className="empty-sub">Fill in the details and click Calculate.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: 'var(--green-deeper)' }}>AED {fmt(result.maxRent)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Maximum legal annual rent</div>
                      <span className={`pill ${result.legal ? 'pill-green' : 'pill-red'}`} style={{ fontSize: 11 }}>{result.verdict}</span>
                    </div>
                  </div>
                  {[
                    ['Current rent', `AED ${fmt(result.cur)}`],
                    ['Proposed rent', `AED ${fmt(result.proposed)}`],
                    ['Max increase allowed', `${result.maxPct}%`],
                    result.gapPct !== null && ['Gap below RERA index', `${result.gapPct.toFixed(1)}%`],
                    result.overcharge > 0 && ['Overcharge per year', `AED ${fmt(result.overcharge)}`],
                  ].filter(Boolean).map(([l, v], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 12.5, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text2)' }}>{l}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 500, color: l === 'Overcharge per year' ? 'var(--red)' : 'inherit' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: 10, background: 'var(--surface2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{result.explanation}</div>
                  <button className="btn btn-green" style={{ width: '100%', marginTop: 12 }} onClick={saveReport}>Save full report to drafts →</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><span className="card-title">📋 Dubai RERA increase brackets — Law No. 26 of 2007</span></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
              {[['0–10%','0%'],['11–20%','5%'],['21–30%','10%'],['31–40%','15%'],['>40%','20%']].map(([gap, max], i) => (
                <div key={i} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>BELOW INDEX</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{gap}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', margin: '3px 0' }}>Max increase</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--green-deeper)', fontFamily: 'IBM Plex Mono' }}>{max}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
