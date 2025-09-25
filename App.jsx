/*
MedVerify — Single-file React prototype (App.jsx)

How to use:
- CodeSandbox: Create a new Sandbox using the "React" template. Replace src/App.js (or src/App.jsx) with the contents of this file and run. No external packages required.
- GitHub: Create a repo and add a React project (Create React App, Vite, etc.). Replace src/App.jsx (or src/App.js) with this file and set it as the app entry (replace default App component).

Notes:
- This is a client-side prototype that persists demo data in localStorage (no server). It simulates blockchain anchoring by computing SHA-256 hashes and storing simulated anchor objects.
- QR is rendered using Google Chart API so no QR dependency is required.
- DO NOT store private keys or mnemonics in client-side code. For real Algorand anchoring you will need a secure server or manufacturer-side wallet signing.
*/

import React, { useEffect, useState, useRef } from 'react';

// Simple styles injected into the page so this is a single-file component
const styles = `
:root{--bg:#f6f8fb;--card:#fff;--muted:#6b7280;--accent:#0b74ff}
*{box-sizing:border-box}
body{font-family:Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin:0; background:var(--bg); color:#111}
.app-header{background:linear-gradient(90deg,#08357b,#0b74ff); color:#fff; padding:18px 20px}
.app-header h1{margin:0;font-size:18px}
.container{max-width:1100px;margin:20px auto;padding:16px}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.btn{background:var(--card);border:1px solid #e6e9ef;padding:8px 12px;border-radius:8px;cursor:pointer}
.btn.primary{background:var(--accent);color:#fff;border:0}
.grid{display:grid;grid-template-columns:1fr 360px;gap:20px}
.card{background:var(--card);padding:16px;border-radius:12px;box-shadow:0 6px 18px rgba(9,30,66,0.06)}
label{display:block;font-weight:600;margin-top:8px}
input,select,textarea{width:100%;padding:8px;border-radius:8px;border:1px solid #e6e9ef;margin-top:6px}
small.muted{color:var(--muted)}
.list{max-height:380px;overflow:auto}
.item{padding:8px;border-bottom:1px dashed #eef2f7}
.qr-wrap{display:flex;gap:12px;align-items:center}
.log{font-family:monospace;background:#0b0720;color:#fff;padding:8px;border-radius:8px;overflow:auto}
footer{padding:18px;text-align:center;color:var(--muted);font-size:13px}
.kpi{display:flex;gap:12px}
.kpi .tile{flex:1;background:linear-gradient(180deg,#fff,#f8fbff);padding:12px;border-radius:8px;text-align:center}
.muted-pill{display:inline-block;background:#eef2ff;padding:6px 8px;border-radius:20px;font-size:12px}
@media (max-width:900px){.grid{grid-template-columns:1fr;}.container{padding:8px}}
`;

// Inject styles once
function useInjectStyles() {
  useEffect(() => {
    const s = document.createElement('style');
    s.id = 'medverify-styles';
    s.innerHTML = styles;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);
}

// Utilities
const STATE_KEY = 'medverify_state_vr1';
function uid(prefix = 'id') { return prefix + '_' + Math.random().toString(36).slice(2,9); }
async function sha256Hex(input) {
  const enc = new TextEncoder();
  const data = enc.encode(typeof input === 'string' ? input : JSON.stringify(input));
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuf));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
const nowISO = () => new Date().toISOString();

// Default demo bootstrap
async function bootstrapIfEmpty(savedState) {
  if (!savedState) {
    const manufacturers = { 'MAN_demo': { id: 'MAN_demo', name: 'NovaMed Pharma', kyc: 'approved', created: nowISO() } };
    const meta = { product: 'Demo Amoxicillin 500mg', batchNo: 'NM-2025-001', mfg: nowISO().slice(0,10), expiry: new Date(new Date().setFullYear(new Date().getFullYear()+2)).toISOString().slice(0,10), coa: 'Demo COA' };
    const hash = await sha256Hex({ manufacturer: manufacturers['MAN_demo'], meta });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const batches = { 'BID_demo': { id: 'BID_demo', manufacturerId: 'MAN_demo', meta, otp, hash, anchors: [{ chain: 'simulated-testnet', tx: 'SIMDEMO1', time: nowISO() }], transfers: [], labReports: [] } };
    const state = { manufacturers, batches, transfers: [], incidents: [], scans: [] };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    return state;
  }
  return savedState;
}

export default function App() {
  useInjectStyles();

  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  });

  const [page, setPage] = useState('manufacture');
  const [loading, setLoading] = useState(false);

  // Form refs / state
  const [mName, setMName] = useState('');
  const [mKYC, setMKYC] = useState('approved');
  const [pName, setPName] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [coa, setCOA] = useState('');

  const [selectedBatch, setSelectedBatch] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [verifyText, setVerifyText] = useState('');

  // Load state and bootstrap demo if needed
  useEffect(() => {
    (async () => {
      const raw = localStorage.getItem(STATE_KEY);
      const loaded = raw ? JSON.parse(raw) : null;
      const s = await bootstrapIfEmpty(loaded);
      setState(s);
    })();
  }, []);

  // Persist state automatically
  useEffect(() => {
    if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state]);

  // Helpers for editing state
  function saveState(next) { setState(next); localStorage.setItem(STATE_KEY, JSON.stringify(next)); }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'medverify_state.json'; a.click(); URL.revokeObjectURL(url);
  }
  function importJSON(e) {
    const f = e.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); saveState(parsed); alert('Imported'); } catch (err) { alert('Import failed: ' + err.message); } }; reader.readAsText(f);
  }
  function resetDemo() { if (window.confirm('Reset demo data?')) { localStorage.removeItem(STATE_KEY); setState(null); window.location.reload(); } }

  // Manufacturer: register batch
  async function registerBatch() {
    if (!mName || !pName) return alert('Please provide manufacturer & product name');
    setLoading(true);
    try {
      // ensure manufacturer
      let manId = Object.keys(state.manufacturers || {}).find(id => state.manufacturers[id].name === mName);
      const next = { ...state };
      if (!manId) { manId = uid('MAN'); next.manufacturers = { ...next.manufacturers, [manId]: { id: manId, name: mName, kyc: mKYC, created: nowISO() } }; }

      const batchId = uid('BID');
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const meta = { product: pName, batchNo: batchNo || batchId, mfg: mfgDate || new Date().toISOString().slice(0,10), expiry: expDate || new Date(new Date().setFullYear(new Date().getFullYear()+2)).toISOString().slice(0,10), coa: coa || '' };
      const canonical = { manufacturer: next.manufacturers[manId], meta };
      const hash = await sha256Hex(canonical);

      const batchObj = { id: batchId, manufacturerId: manId, meta, otp, hash, anchors: [{ chain: 'simulated-testnet', tx: 'SIM-' + Math.random().toString(36).slice(2,9), time: nowISO() }], transfers: [], labReports: [] };
      next.batches = { ...next.batches, [batchId]: batchObj };
      saveState(next);
      alert('Batch created and proof anchored (simulated). OTP (scratch): ' + otp + ' — save this for sticker preview');
      // reset form
      setMName(''); setPName(''); setBatchNo(''); setCOA(''); setMfgDate(''); setExpDate('');
    } catch (err) { console.error(err); alert('Failed: ' + err.message); }
    setLoading(false);
  }

  // View batch
  function viewBatch(id) { setSelectedBatch(state.batches[id]); setPage('manufacture'); }

  function generateQRUrl(batch) {
    // for demo we embed a verify URL with batch id; QR via Google Chart API
    const base = window.location.origin + window.location.pathname + `?verify=${batch.id}`;
    const qr = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(base)}`;
    return { url: base, qr };
  }

  // Transfer logging
  function logTransfer(distributor, from, to, batchId, bol) {
    if (!distributor || !to || !batchId) return alert('Please provide distributor, destination, and batch');
    const t = { id: uid('T'), distributor, from, to, batchId, bol, time: nowISO(), batchMeta: state.batches[batchId].meta };
    const next = { ...state, transfers: [...state.transfers, t], batches: { ...state.batches, [batchId]: { ...state.batches[batchId], transfers: [...state.batches[batchId].transfers, t] } } };
    saveState(next); alert('Transfer logged');
  }

  // Pharmacy receipt
  function pharmacyReceive(batchId, otp) {
    if (!batchId || !otp) return alert('Provide batch id and otp');
    const b = state.batches[batchId]; if (!b) return alert('Batch not found');
    if (b.lockUntil && new Date() < new Date(b.lockUntil)) return alert('This batch is temporarily locked due to multiple failed attempts. Try later.');
    if (otp === b.otp) {
      const next = { ...state, scans: [...state.scans, { type: 'receipt', batchId, time: nowISO(), result: 'AUTHENTIC', actor: 'pharmacy' }] };
      saveState(next); alert('Receipt confirmed — AUTHENTIC');
    } else {
      const nb = { ...b, attempts: (b.attempts || 0) + 1 };
      if (nb.attempts >= 5) { nb.lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); makeIncident(batchId, 'otp-bruteforce'); alert('Too many failed attempts — batch temporarily locked and incident created'); }
      const next = { ...state, batches: { ...state.batches, [batchId]: nb } };
      saveState(next);
    }
  }

  // Verify flow (QR/OTP)
  async function verifyBatch(batchId, otp) {
    const b = state.batches[batchId]; if (!b) return setVerifyText('SUSPECT — batch not found');
    if (b.lockUntil && new Date() < new Date(b.lockUntil)) return setVerifyText('SUSPECT — batch temporarily locked due to failed OTP attempts');
    if (otp === b.otp) {
      const canonical = { manufacturer: state.manufacturers[b.manufacturerId], meta: b.meta };
      const h = await sha256Hex(canonical);
      if (h === b.hash) {
        const next = { ...state, scans: [...state.scans, { type: 'verify', batchId, time: nowISO(), result: 'AUTHENTIC' }] };
        saveState(next);
        setVerifyText(`AUTHENTIC — Manufacturer: ${state.manufacturers[b.manufacturerId].name} • Expiry: ${b.meta.expiry}`);
      } else {
        const next = { ...state, scans: [...state.scans, { type: 'verify', batchId, time: nowISO(), result: 'SUSPECT' }] };
        saveState(next); makeIncident(batchId, 'proof-mismatch'); setVerifyText('SUSPECT — proof mismatch (possible tampering)');
      }
    } else {
      const nb = { ...b, attempts: (b.attempts || 0) + 1 };
      if (nb.attempts >= 5) { nb.lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); makeIncident(batchId, 'otp-bruteforce'); }
      const next = { ...state, batches: { ...state.batches, [batchId]: nb }, scans: [...state.scans, { type: 'verify', batchId, time: nowISO(), result: 'SUSPECT' }] };
      saveState(next); setVerifyText('SUSPECT — Invalid OTP (scratch code).');
    }
  }

  // USSD / SMS simulation
  function simulateUSSD(input) {
    const m = input.match(/\*\d+\*(BID_[a-z0-9]+)#/i); if (!m) return alert('bad format — use *345*BID_xxx#'); const batchId = m[1]; const b = state.batches[batchId]; if (!b) return setVerifyText('SUSPECT — Batch not found (USSD)'); setVerifyText('AUTHENTIC — Batch found (limited info via USSD)');
  }
  function simulateSMS(batchId, phone) { const b = state.batches[batchId]; if (!b) return alert('batch not found'); setVerifyText(`AUTHENTIC — SMS: Batch ${b.meta.batchNo} • ${b.meta.product} • exp ${b.meta.expiry}`); }

  // Lab upload
  async function uploadLabReport(batchId, labName, summary) {
    if (!labName || !batchId || !summary) return alert('complete fields');
    const report = { lab: labName, summary, time: nowISO() };
    const hash = await sha256Hex(report);
    const rep = { id: uid('LR'), lab: labName, summary, time: report.time, hash, anchor: { chain: 'simulated-testnet', tx: 'LAB-' + Math.random().toString(36).slice(2,8) } };
    const nb = { ...state.batches[batchId], labReports: [...state.batches[batchId].labReports, rep] };
    const next = { ...state, batches: { ...state.batches, [batchId]: nb } };
    saveState(next); alert('Lab report uploaded and anchored (simulated)');
  }

  // Incidents
  function makeIncident(batchId, reason, notes = '') { const inc = { id: uid('INC'), batchId, reason, notes, time: nowISO() }; const next = { ...state, incidents: [...state.incidents, inc] }; saveState(next); }

  // Admin exports
  function downloadIncidentsCSV() {
    const rows = [['id','batchId','reason','time','notes']].concat(state.incidents.map(i => [i.id, i.batchId, i.reason, i.time, (i.notes||'').replace(/\n/g, ' ')]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'incidents.csv'; a.click(); URL.revokeObjectURL(url);
  }
  function downloadAnchorsCSV() {
    const anchors = Object.values(state.batches).flatMap(b => b.anchors.map(a => [b.id, b.meta.batchNo, b.hash, a.chain, a.tx, a.time]));
    const rows = [['batchId','batchNo','hash','chain','tx','time']].concat(anchors);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'anchors.csv'; a.click(); URL.revokeObjectURL(url);
  }

  // KPI helpers
  const kpiScans = state ? state.scans.length : 0;
  const kpiSuspect = state ? state.scans.filter(s => s.result === 'SUSPECT').length : 0;

  // UI components (kept inline to remain single-file)
  function ManufacturerPanel() {
    return (
      <div>
        <h2>Manufacturer — Register Batch</h2>
        <p className="muted-pill">Create a production batch and anchor a cryptographic proof (simulated)</p>
        <label>Manufacturer name</label>
        <input value={mName} onChange={e => setMName(e.target.value)} placeholder="ACME Pharma Ltd" />
        <label>Manufacturer KYC status</label>
        <select value={mKYC} onChange={e => setMKYC(e.target.value)}><option value="approved">Approved</option><option value="pending">Pending</option></select>
        <label>Product name / description</label>
        <input value={pName} onChange={e => setPName(e.target.value)} placeholder="Amoxicillin 500mg — 10 tablets" />
        <label>Batch number</label>
        <input value={batchNo} onChange={e => setBatchNo(e.target.value)} placeholder="BATCH-2025-0001" />
        <label>Manufacture date</label>
        <input value={mfgDate} onChange={e => setMfgDate(e.target.value)} type="date" />
        <label>Expiry date</label>
        <input value={expDate} onChange={e => setExpDate(e.target.value)} type="date" />
        <label>COA / Notes (paste)</label>
        <textarea value={coa} onChange={e => setCOA(e.target.value)} rows={3} placeholder="Certificate of analysis / lab notes / packaging details"></textarea>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={registerBatch}>Register batch + Anchor proof</button>
          <button className="btn" onClick={() => { setMName('NovaMed Pharma'); setPName('Amoxicillin 500mg — 10 tablets'); setBatchNo('NM-2025-001'); setCOA('COA: compliant; assay 99.8%'); setMfgDate(new Date().toISOString().slice(0,10)); const d = new Date(); d.setFullYear(d.getFullYear()+2); setExpDate(d.toISOString().slice(0,10)); }}>Prefill Demo</button>
        </div>

        <hr />
        <h3>Existing batches</h3>
        <div className="list">
          {state && Object.values(state.batches).length === 0 && <div className="item muted">No batches yet</div>}
          {state && Object.values(state.batches).map(b => (
            <div className="item" key={b.id}>
              <strong>{b.meta.product}</strong><br/><small className="muted">batch: {b.meta.batchNo} • exp: {b.meta.expiry}</small>
              <div style={{ marginTop: 6 }}>
                <button className="btn" onClick={() => viewBatch(b.id)}>View</button>
                <button className="btn" onClick={() => { setSelectedBatch(b); setPage('qr'); }}>QR + Sticker</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function TransferPanel() {
    const [dName, setDName] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [batchId, setBatchId] = useState(Object.keys(state?.batches || {})[0] || '');
    const [bol, setBol] = useState('');
    return (
      <div>
        <h2>Distributor — Log Transfer / Shipment</h2>
        <label>Distributor name</label>
        <input value={dName} onChange={e => setDName(e.target.value)} placeholder="ACME Distribution" />
        <label>From (location / warehouse)</label>
        <input value={from} onChange={e => setFrom(e.target.value)} placeholder="Warehouse A" />
        <label>To (Pharmacy / Retailer)</label>
        <input value={to} onChange={e => setTo(e.target.value)} placeholder="Pharmacy X" />
        <label>Batch (select)</label>
        <select value={batchId} onChange={e => setBatchId(e.target.value)}>
          {state && Object.values(state.batches).map(b => <option key={b.id} value={b.id}>{b.meta.product} — {b.meta.batchNo}</option>)}
        </select>
        <label>Bill of lading / invoice (paste)</label>
        <textarea value={bol} onChange={e => setBol(e.target.value)} rows={2} placeholder="BOL #12345"></textarea>
        <div style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => logTransfer(dName, from, to, batchId, bol)}>Log transfer</button>
        </div>
        <hr />
        <h3>Recent transfers</h3>
        <div className="list">
          {state && state.transfers.slice().reverse().map(t => (<div key={t.id} className="item">{t.batchMeta.product} • {t.batchMeta.batchNo} • to: {t.to} • {t.time}</div>))}
          {state && state.transfers.length === 0 && <div className="item muted">No transfers yet</div>}
        </div>
      </div>
    );
  }

  function PharmacyPanel() {
    const [scanBatch, setScanBatch] = useState('');
    const [scanOtp, setScanOtp] = useState('');
    useEffect(() => { if (Object.keys(state?.batches || {}).length > 0 && !scanBatch) setScanBatch(Object.keys(state.batches)[0]); }, [state]);
    return (
      <div>
        <h2>Pharmacy — Confirm Receipt</h2>
        <label>Scan QR (select batch for demo)</label>
        <select value={scanBatch} onChange={e => setScanBatch(e.target.value)}>
          {state && Object.values(state.batches).map(b => <option key={b.id} value={b.id}>{b.meta.product} — {b.meta.batchNo}</option>)}
        </select>
        <label>Enter OTP (scratch)</label>
        <input value={scanOtp} onChange={e => setScanOtp(e.target.value)} placeholder="6-digit" />
        <div style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={() => pharmacyReceive(scanBatch, scanOtp)}>Confirm receipt</button>
        </div>
        <hr />
        <h3>Pending receipts (from transfers)</h3>
        <div className="list">{state && state.transfers.filter(t => !t.confirmed).slice().reverse().map(t => (<div className="item" key={t.id}>{t.batchMeta.product} • {t.batchMeta.batchNo} • to: {t.to} • <button className="btn" onClick={() => { setScanBatch(t.batchId); setScanOtp(state.batches[t.batchId].otp); }}>Use</button></div>))}</div>
      </div>
    );
  }

  function VerifyPanel() {
    const [vb, setVb] = useState(Object.keys(state?.batches || {})[0] || '');
    const [votp, setVotp] = useState('');
    const [ussd, setUssd] = useState('');
    useEffect(() => { if (Object.keys(state?.batches || {}).length > 0 && !vb) setVb(Object.keys(state.batches)[0]); }, [state]);
    return (
      <div>
        <h2>Verification — Scan QR / Enter OTP</h2>
        <p className="muted">Simulate scanning by selecting a batch or pasting batch id. USSD / SMS flows are simulated below for feature phones.</p>
        <label>Select batch</label>
        <select value={vb} onChange={e => setVb(e.target.value)}>{state && Object.values(state.batches).map(b => <option key={b.id} value={b.id}>{b.meta.product} — {b.meta.batchNo}</option>)}</select>
        <label>OTP (scratch)</label>
        <input value={votp} onChange={e => setVotp(e.target.value)} placeholder="6-digit" />
        <div style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={() => verifyBatch(vb, votp)}>Verify</button>
        </div>
        <hr />
        <h3>USSD / SMS (feature phone fallback)</h3>
        <p className="muted">USSD code (example): <strong>*345*batchid#</strong>. Simulate it below:</p>
        <label>USSD input (e.g. *345*BID_xxx#)</label>
        <input value={ussd} onChange={e => setUssd(e.target.value)} placeholder="*345*BID_abc123#" />
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => simulateUSSD(ussd)}>Simulate USSD</button>
          <button className="btn" onClick={() => { const b = prompt('Enter batch id to simulate SMS verification (BID_xxx)'); if (b) { const phone = prompt('Enter phone number (sender)'); if (phone) simulateSMS(b, phone); } }}>Simulate SMS</button>
        </div>
        <div style={{ marginTop: 12 }}>{verifyText && <div className="card"><h3>{verifyText.startsWith('AUTHENTIC') ? '✅ AUTHENTIC' : '⚠️ SUSPECT'}</h3><p>{verifyText}</p></div>}</div>
      </div>
    );
  }

  function QRPanel() {
    const b = selectedBatch; if (!b) return <div className="card">Select a batch first</div>;
    const { url, qr } = generateQRUrl(b);
    return (
      <div>
        <h2>QR + Tamper sticker preview</h2>
        <p className="muted-pill">Simulated sticker: QR encodes a verify URL + batch id. Scratch OTP is shown below for demo.</p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div><img src={qr} alt="qr" width={160} height={160} /></div>
          <div>
            <p><strong>{b.meta.product}</strong><br/><small className="muted">Batch: {b.meta.batchNo}</small></p>
            <p>OTP (scratch): <strong>{b.otp}</strong></p>
            <p><small className="muted">NOTE: On a real sticker the OTP would be concealed by a scratch panel and not directly visible</small></p>
            <div style={{ marginTop: 8 }}><button className="btn" onClick={() => alert('Download simulated sticker: right-click QR and Save image or use browser print — this is a demo')}>Download sticker (PNG)</button></div>
          </div>
        </div>
      </div>
    );
  }

  function LabPanel() {
    const [labName, setLabName] = useState('');
    const [labBatch, setLabBatch] = useState(Object.keys(state?.batches || {})[0] || '');
    const [labSummary, setLabSummary] = useState('');
    useEffect(() => { if (Object.keys(state?.batches || {}).length > 0 && !labBatch) setLabBatch(Object.keys(state.batches)[0]); }, [state]);
    return (
      <div>
        <h2>Lab — Upload Test Report</h2>
        <label>Lab name</label>
        <input value={labName} onChange={e => setLabName(e.target.value)} placeholder="Accredited Lab X" />
        <label>Select batch</label>
        <select value={labBatch} onChange={e => setLabBatch(e.target.value)}>{state && Object.values(state.batches).map(b => <option key={b.id} value={b.id}>{b.meta.product} — {b.meta.batchNo}</option>)}</select>
        <label>Test result summary</label>
        <textarea value={labSummary} onChange={e => setLabSummary(e.target.value)} rows={3} placeholder="Assay OK; identity OK"></textarea>
        <div style={{ marginTop: 10 }}><button className="btn primary" onClick={() => uploadLabReport(labBatch, labName, labSummary)}>Upload & Anchor (simulated)</button></div>
        <hr />
        <h3>Lab reports</h3>
        <div className="list">
          {state && Object.values(state.batches).flatMap(b => b.labReports.map(r => (<div key={r.id} className="item">{b.meta.product} • {r.lab} • {r.time} • <small className="muted">hash:{r.hash.slice(0,12)}</small></div>)))}
          {state && Object.values(state.batches).flatMap(b => b.labReports).length === 0 && <div className="item muted">No lab reports</div>}
        </div>
      </div>
    );
  }

  function AdminPanel() {
    return (
      <div>
        <h2>Admin / Analytics</h2>
        <p className="muted">View KYC, incidents, export reports, and basic KPIs</p>
        <h3>Manufacturers (KYC)</h3>
        <div className="list">{state && Object.values(state.manufacturers).map(m => (<div key={m.id} className="item"><strong>{m.name}</strong> • {m.kyc} • {m.created} <button className="btn" onClick={() => { const next = { ...state, manufacturers: { ...state.manufacturers, [m.id]: { ...state.manufacturers[m.id], kyc: state.manufacturers[m.id].kyc === 'approved' ? 'pending' : 'approved' } } }; saveState(next); }}>Toggle KYC</button></div>))}</div>
        <h3>Incidents</h3>
        <div className="list">{state && state.incidents.slice().reverse().map(i => (<div key={i.id} className="item"><strong>{i.reason}</strong> • batch {i.batchId} • {i.time} • {i.notes}</div>))}</div>
        <h3>Export reports</h3>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={downloadIncidentsCSV}>Download incidents CSV</button><button className="btn" onClick={downloadAnchorsCSV}>Download anchors</button></div>
      </div>
    );
  }

  // Quick tools / sidebar
  function Sidebar() {
    return (
      <aside>
        <div className="card">
          <h3>Quick tools</h3>
          <p className="muted-pill">Local-only POC (uses browser storage)</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={exportJSON}>Export JSON</button>
            <label className="btn" style={{ cursor: 'pointer' }}>Import JSON<input type="file" accept="application/json" style={{ display: 'none' }} onChange={importJSON} /></label>
            <button className="btn" onClick={resetDemo}>Reset POC</button>
          </div>
          <hr />
          <h4>Scan / Event Log</h4>
          <div id="scanLog" className="list" style={{ marginTop: 8 }}>{state && state.scans.slice().reverse().map((s, idx) => (<div key={idx} className="item"><small className="muted">{s.time}</small><div><strong>{s.result}</strong> • {s.type} • batch:{s.batchId}</div></div>))}{state && state.scans.length === 0 && <div className="item muted">No scans yet</div>}</div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <h4>KPIs (demo)</h4>
          <div className="kpi">
            <div className="tile"><div style={{ fontSize: 20 }}>{kpiScans}</div><div className="muted-pill">Scans</div></div>
            <div className="tile"><div style={{ fontSize: 20 }}>{kpiSuspect}</div><div className="muted-pill">Suspect Flags</div></div>
          </div>
        </div>
      </aside>
    );
  }

  if (!state) return <div className="container card">Loading demo...</div>;

  return (
    <div>
      <header className="app-header"><div className="container"><h1>MedVerify — React Prototype</h1></div></header>
      <main className="container">
        <div className="toolbar">
          <button className="btn" onClick={() => setPage('manufacture')}>Manufacturer — Register Batch</button>
          <button className="btn" onClick={() => setPage('transfer')}>Distributor — Log Transfer</button>
          <button className="btn" onClick={() => setPage('pharmacy')}>Pharmacy — Confirm Receipt</button>
          <button className="btn" onClick={() => setPage('verify')}>Verification — Scan / OTP</button>
          <button className="btn" onClick={() => setPage('lab')}>Lab Attestation</button>
          <button className="btn" onClick={() => setPage('admin')}>Admin / Analytics</button>
        </div>

        <section className="grid">
          <div className="card" style={{ minHeight: 420 }}>
            {page === 'manufacture' && <ManufacturerPanel />}
            {page === 'transfer' && <TransferPanel />}
            {page === 'pharmacy' && <PharmacyPanel />}
            {page === 'verify' && <VerifyPanel />}
            {page === 'lab' && <LabPanel />}
            {page === 'admin' && <AdminPanel />}
            {page === 'qr' && <QRPanel />}
          </div>

          <div>
            <Sidebar />
          </div>
        </section>

        <footer>This prototype simulates core flows: batch registration, transfer logging, QR+OTP verification, lab attestations, incident creation, and simple analytics. Data is persisted in your browser for demo only.</footer>
      </main>
    </div>
  );
}
