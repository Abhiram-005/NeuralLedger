import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

/* ─────────────────────────────────────────────
   CHAIN EXPLORER — shows ONLY real transactions
   collected from /register and /buy responses
───────────────────────────────────────────── */
function ChainExplorer({ txHistory, onClose }) {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [detail, setDetail]   = useState(null);

  const fmtTime  = ts => ts ? new Date(ts * 1000).toLocaleString() : '—';
  const shortHash = h => h ? h.slice(0, 12) + '…' + h.slice(-8) : '—';
  const shortAddr = a => a ? a.slice(0, 10) + '…' + a.slice(-6) : '—';
  const fmtWei   = v => v ? `${v} Wei` : '0 Wei';

  const filtered = txHistory.filter(tx => {
    if (filter === 'register' && tx.type !== 'REGISTER') return false;
    if (filter === 'buy'      && tx.type !== 'BUY')      return false;
    if (search) {
      const q = search.toLowerCase();
      return tx.txHash?.toLowerCase().includes(q) ||
             tx.newOwner?.toLowerCase().includes(q) ||
             String(tx.blockNumber).includes(q);
    }
    return true;
  });

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(3,10,22,0.97)',
      backdropFilter:'blur(20px)',
      display:'flex', flexDirection:'column',
      fontFamily:"'Rajdhani','Share Tech Mono',monospace",
      animation:'txFadeIn .25s ease',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Share+Tech+Mono&family=Rajdhani:wght@500;600;700&display=swap');
        @keyframes txFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes txRowIn  { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes txPulse  { 0%,100%{box-shadow:0 0 8px #00d4ff33} 50%{box-shadow:0 0 24px #00d4ff88} }
        @keyframes txBlink  { 0%,100%{opacity:1} 50%{opacity:.2} }
        .txe-tr:hover { background:#0d2540 !important; cursor:pointer; }
        .txe-tr { animation:txRowIn .3s ease backwards; }
        .txe-btn {
          padding:8px 18px; border-radius:8px; font-family:inherit;
          font-size:13px; font-weight:700; letter-spacing:1px;
          cursor:pointer; transition:all .2s; border:1px solid;
        }
        .txe-btn-ghost { border-color:#1a3a5c; background:transparent; color:#5a8aaa; }
        .txe-btn-ghost:hover { border-color:#00d4ff; color:#00d4ff; background:#00d4ff11; }
        .txe-btn-ghost.active { border-color:#00d4ff; color:#00d4ff; background:#00d4ff18; }
        .txe-badge-reg {
          background:#00d4ff18; border:1px solid #00d4ff44;
          color:#00d4ff; padding:3px 10px; border-radius:20px;
          font-size:11px; font-weight:700; letter-spacing:1px;
        }
        .txe-badge-buy {
          background:#00ffaa18; border:1px solid #00ffaa44;
          color:#00ffaa; padding:3px 10px; border-radius:20px;
          font-size:11px; font-weight:700; letter-spacing:1px;
        }
        .txe-detail-card {
          background:#0d2137; border:1px solid #1a3a5c;
          border-radius:12px; padding:20px; transition:border-color .2s;
        }
        .txe-detail-card:hover { border-color:#00d4ff44; }
        .txe-inp {
          background:#0a1929; border:1px solid #1a3a5c; border-radius:8px;
          padding:8px 14px; color:#e0f4ff;
          font-family:'Share Tech Mono',monospace; font-size:13px;
          outline:none; transition:all .2s;
        }
        .txe-inp::placeholder { color:#2a5a7a; }
        .txe-inp:focus { border-color:#00d4ff88; box-shadow:0 0 12px #00d4ff22; }
        .txe-empty-state {
          display:flex; flex-direction:column; align-items:center;
          justify-content:center; flex:1; gap:16px; color:#2a5a7a;
        }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1a3a5c; border-radius:3px; }
      `}</style>

      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'18px 28px', borderBottom:'1px solid #1a3a5c',
        background:'linear-gradient(180deg,#0a1929 0%,transparent 100%)',
        flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{
            width:38, height:38, borderRadius:9, border:'2px solid #00d4ff',
            background:'#00d4ff18', display:'flex', alignItems:'center',
            justifyContent:'center', animation:'txPulse 2s ease infinite',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4M7 7h10M7 11h6"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:17, fontWeight:700, color:'#e0f4ff', letterSpacing:2 }}>
              CHAIN EXPLORER
            </div>
            <div style={{ fontSize:11, color:'#3a6a8a', letterSpacing:3, textTransform:'uppercase', marginTop:2 }}>
              AIChain · Real Transactions Only
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:24, alignItems:'center' }}>
          {[
            { val: txHistory.length,                                 lbl:'Total TX',  color:'#e0f4ff' },
            { val: txHistory.filter(t=>t.type==='REGISTER').length,  lbl:'Registers', color:'#00d4ff' },
            { val: txHistory.filter(t=>t.type==='BUY').length,       lbl:'Purchases', color:'#00ffaa' },
          ].map((s,i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{width:1,height:36,background:'#1a3a5c'}}/>}
              <div style={{textAlign:'center'}}>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:22, fontWeight:700, color:s.color, lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:10, color:'#3a6a8a', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>{s.lbl}</div>
              </div>
            </React.Fragment>
          ))}
        </div>

        <button onClick={onClose} style={{
          width:38, height:38, borderRadius:9, border:'1px solid #1a3a5c',
          background:'transparent', color:'#5a8aaa', cursor:'pointer',
          fontSize:18, transition:'all .2s', display:'flex', alignItems:'center', justifyContent:'center',
        }}
          onMouseEnter={e=>{ e.currentTarget.style.borderColor='#ff4d6d'; e.currentTarget.style.color='#ff4d6d'; }}
          onMouseLeave={e=>{ e.currentTarget.style.borderColor='#1a3a5c'; e.currentTarget.style.color='#5a8aaa'; }}
        >✕</button>
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 28px', borderBottom:'1px solid #1a3a5c44', flexShrink:0 }}>
        <input
          className="txe-inp"
          style={{ flex:1, maxWidth:380 }}
          placeholder="Search by hash, address, block number…"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
        {[
          { key:'all',      label:'All' },
          { key:'register', label:'⬡ Registers' },
          { key:'buy',      label:'🛒 Purchases' },
        ].map(f=>(
          <button key={f.key} className={`txe-btn txe-btn-ghost ${filter===f.key?'active':''}`} onClick={()=>setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft:'auto', fontSize:12, color:'#2a5a7a', fontFamily:"'Share Tech Mono',monospace" }}>
          {filtered.length} of {txHistory.length} transactions
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', position:'relative' }}>
        {txHistory.length === 0 ? (
          <div className="txe-empty-state">
            <div style={{ fontSize:52, opacity:.3 }}>⛓</div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14, letterSpacing:3 }}>NO TRANSACTIONS YET</div>
            <div style={{ fontSize:13 }}>Register or buy a model to see real transactions here</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="txe-empty-state">
            <div style={{ fontSize:40, opacity:.3 }}>🔍</div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, letterSpacing:2 }}>NO RESULTS</div>
            <div style={{ fontSize:12 }}>Try a different search or filter</div>
          </div>
        ) : (
          <div style={{ flex:1, overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1a3a5c' }}>
                  {['TX Hash','Block','Type','Owner / Buyer','Value','Gas Used','Time'].map(h=>(
                    <th key={h} style={{
                      padding:'11px 16px', textAlign:'left',
                      fontFamily:"'Orbitron',monospace", fontSize:10,
                      fontWeight:400, letterSpacing:3, textTransform:'uppercase',
                      color:'#2a5a7a', background:'#050d15', position:'sticky', top:0, zIndex:2,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <tr
                    key={tx.txHash + i}
                    className="txe-tr"
                    style={{ borderBottom:'1px solid #1a3a5c33', animationDelay:`${i*35}ms` }}
                    onClick={()=>setDetail(tx)}
                  >
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:'#00d4ff' }}>
                        {shortHash(tx.txHash)}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{
                        fontFamily:"'Orbitron',monospace", fontSize:12, fontWeight:700, color:'#00a8cc',
                        background:'#00d4ff18', border:'1px solid #00d4ff33', padding:'2px 8px', borderRadius:4,
                      }}>#{tx.blockNumber}</span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span className={tx.type === 'REGISTER' ? 'txe-badge-reg' : 'txe-badge-buy'}>
                        {tx.type === 'REGISTER' ? '⬡ REGISTER' : '🛒 BUY'}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'#5a8aaa' }}>
                        {tx.newOwner ? shortAddr(tx.newOwner) : shortAddr(tx.contractAddress)}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:'#00ffaa' }}>
                        {tx.pricePaid ? fmtWei(tx.pricePaid) : '—'}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:'#ffd700' }}>
                        {tx.gasUsed ? Number(tx.gasUsed).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:12, color:'#5a8aaa' }}>
                      {fmtTime(tx.blockTimestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TX Detail Panel */}
        {detail && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(3,10,22,.98)',
            animation:'txFadeIn .2s ease', overflowY:'auto', zIndex:10,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 28px', borderBottom:'1px solid #1a3a5c' }}>
              <button className="txe-btn txe-btn-ghost" onClick={()=>setDetail(null)}>← Back</button>
              <div style={{ fontFamily:"'Orbitron',monospace", fontSize:15, fontWeight:700, color:'#e0f4ff', letterSpacing:2 }}>
                TRANSACTION DETAIL
              </div>
              <span className={detail.type==='REGISTER'?'txe-badge-reg':'txe-badge-buy'} style={{marginLeft:8}}>
                {detail.type==='REGISTER'?'⬡ REGISTER':'🛒 BUY'}
              </span>
            </div>
            <div style={{ padding:'28px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, maxWidth:860 }}>
              {[
                { label:'Transaction Hash',  value:detail.txHash,           full:true },
                { label:'Block Number',      value:`#${detail.blockNumber}`, accent:true },
                { label:'Gas Used',          value:detail.gasUsed ? Number(detail.gasUsed).toLocaleString():'—', yellow:true },
                { label:'Timestamp',         value:fmtTime(detail.blockTimestamp) },
                { label:'Contract Address',  value:detail.contractAddress,  full:true },
                ...(detail.newOwner ? [
                  { label:'New Owner',       value:detail.newOwner,         full:true, green:true },
                  { label:'Price Paid',      value:fmtWei(detail.pricePaid), green:true },
                ] : []),
              ].map((f,i)=>(
                <div key={i} className="txe-detail-card" style={f.full?{gridColumn:'1 / -1'}:{}}>
                  <div style={{ fontSize:10, letterSpacing:3, textTransform:'uppercase', color:'#2a5a7a', fontFamily:"'Orbitron',monospace", marginBottom:8 }}>
                    {f.label}
                  </div>
                  <div style={{
                    fontFamily: f.accent ? "'Orbitron',monospace" : "'Share Tech Mono',monospace",
                    fontSize: f.accent ? 26 : 13,
                    fontWeight: f.accent ? 700 : 400,
                    color: f.accent ? '#00d4ff' : f.green ? '#00ffaa' : f.yellow ? '#ffd700' : '#e0f4ff',
                    wordBreak:'break-all', lineHeight:1.6,
                  }}>
                    {f.value || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding:'10px 28px', borderTop:'1px solid #1a3a5c33',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
      }}>
        <div style={{ fontSize:11, color:'#2a5a7a', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#00ffaa', display:'inline-block', animation:'txBlink 1.5s infinite' }}/>
          Ganache Local Network · Only your real on-chain transactions
        </div>
        <div style={{ fontSize:11, color:'#2a5a7a' }}>Click any row to inspect · ESC to close</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
function App() {
  const [models, setModels]           = useState([]);
  const [accounts, setAccounts]       = useState([]);
  const [page, setPage]               = useState('home');
  const [form, setForm]               = useState({
    name:'', description:'', modelHash:'', price:'',
    accuracy:'', modelSize:'', parameters:'', trainingTime:'', valLoss:''
  });
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [buyState, setBuyState]       = useState({});
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [proof, setProof]             = useState(null);

  // ── Real transactions only ──
  const [txHistory, setTxHistory]     = useState([]);
  const [showExplorer, setShowExplorer] = useState(false);

  const addTx = useCallback((blockchainData, type) => {
    if (!blockchainData?.txHash) return;
    setTxHistory(prev => {
      if (prev.find(t => t.txHash === blockchainData.txHash)) return prev;
      return [{ ...blockchainData, type }, ...prev];
    });
  }, []);

  useEffect(() => { fetchModels(); fetchAccounts(); }, []);

  useEffect(() => {
    const fn = e => e.key === 'Escape' && setShowExplorer(false);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const fetchModels = async () => {
    try { const r = await axios.get('http://127.0.0.1:5000/models'); setModels(r.data.models); } catch(e){}
  };
  const fetchAccounts = async () => {
    try {
      const r = await axios.get('http://127.0.0.1:5000/accounts');
      setAccounts(r.data.accounts);
      if (r.data.accounts.length > 1) setSelectedBuyer(r.data.accounts[1].address);
    } catch(e){}
  };

  const handleRegister = async () => {
    setLoading(true); setResult(null);
    try {
      const r = await axios.post('http://127.0.0.1:5000/register', form);
      setResult(r.data);
      if (r.data.blockchain) {
        setProof(r.data.blockchain);
        addTx(r.data.blockchain, 'REGISTER');   // ← real TX recorded
      }
      fetchModels();
    } catch(e) { setResult({ success: false, error: 'Make sure Ganache & Flask are running!' }); }
    setLoading(false);
  };

  const handleBuy = async (modelId) => {
    if (!selectedBuyer) return;
    setBuyState(p => ({...p, [modelId]: 'loading'}));
    try {
      const r = await axios.post('http://127.0.0.1:5000/buy', { modelId, buyerAddress: selectedBuyer });
      if (r.data.success) {
        setBuyState(p => ({...p, [modelId]: 'success'}));
        setProof(r.data.blockchain);
        addTx(r.data.blockchain, 'BUY');         // ← real TX recorded
        fetchModels();
      }
    } catch(e) { setBuyState(p => ({...p, [modelId]: 'error'})); }
  };

  const getQuality = s => s > 70 ? {label:'HIGH',cls:'q-high'} : s > 40 ? {label:'MED',cls:'q-med'} : {label:'LOW',cls:'q-low'};
  const fmtTime    = ts => new Date(ts * 1000).toLocaleString();

  return (
    <div className="app">

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="brand">
          <div className="brand-icon">⬡</div>
          <span className="brand-name">AI<span>Chain</span></span>
        </div>
        <div className="nav-tabs">
          {['home','register','marketplace','proof'].map(p=>(
            <button key={p} className={page===p?'tab active':'tab'} onClick={()=>{ setPage(p); if(p==='marketplace') fetchModels(); }}>
              {p==='home'?'Home':p==='register'?'Register':p==='marketplace'?'Marketplace':'⛓ Chain Proof'}
            </button>
          ))}
        </div>
        <div className="nav-status"><span className="dot"></span> LIVE ON ETHEREUM</div>
      </nav>

      {/* HOME */}
      {page==='home' && (
        <div className="hero">
          <div className="hero-eyebrow">BLOCKCHAIN × AI × OWNERSHIP</div>
          <h1 className="hero-title">The Future of<br/><span>AI Ownership</span></h1>
          <p className="hero-sub">Register, protect and monetize your AI models on Ethereum blockchain. Our AI detects plagiarism and scores quality — all stored permanently on-chain.</p>
          <div className="stats-row">
            <div className="stat-box"><div className="stat-val">{models.length}</div><div className="stat-lbl">MODELS REGISTERED</div></div>
            <div className="stat-box"><div className="stat-val">{models.filter(m=>!m.isForSale).length}</div><div className="stat-lbl">MODELS SOLD</div></div>
            <div className="stat-box"><div className="stat-val">2</div><div className="stat-lbl">AI ALGORITHMS</div></div>
            <div className="stat-box"><div className="stat-val">∞</div><div className="stat-lbl">TAMPER PROOF</div></div>
          </div>
          <div className="how-it-works">
            <div className="how-title">HOW IT WORKS</div>
            <div className="steps">
              <div className="step"><div className="step-num">01</div><div className="step-icon">📤</div><div className="step-title">Upload Model Info</div><div className="step-desc">Developer submits model metrics — accuracy, size, parameters, training time, validation loss</div></div>
              <div className="step-arrow">→</div>
              <div className="step"><div className="step-num">02</div><div className="step-icon">🧠</div><div className="step-title">AI Analysis</div><div className="step-desc">RandomForest scores quality. Cosine Similarity checks plagiarism against all registered models</div></div>
              <div className="step-arrow">→</div>
              <div className="step"><div className="step-num">03</div><div className="step-icon">🔗</div><div className="step-title">Blockchain Storage</div><div className="step-desc">Scores + ownership stored permanently on Ethereum. Transaction hash = tamper-proof certificate</div></div>
              <div className="step-arrow">→</div>
              <div className="step"><div className="step-num">04</div><div className="step-icon">🛒</div><div className="step-title">Buy & Sell</div><div className="step-desc">Smart contracts handle payments automatically. Ownership transfers on-chain with zero middlemen</div></div>
            </div>
          </div>
          <div className="ai-explainer">
            <div className="ai-exp-title">🧠 Our 2 Real AI Algorithms</div>
            <div className="ai-exp-grid">
              <div className="ai-exp-card">
                <div className="ai-exp-name">Algorithm 1 — RandomForest Regressor</div>
                <div className="ai-exp-desc">Trained on 800 synthetic data points. Takes 5 inputs (accuracy, size, parameters, training time, validation loss) and predicts a quality score using an ensemble of 150 decision trees.</div>
                <div className="ai-exp-tag">scikit-learn RandomForestRegressor</div>
              </div>
              <div className="ai-exp-card">
                <div className="ai-exp-name">Algorithm 2 — Cosine Similarity Plagiarism Detector</div>
                <div className="ai-exp-desc">Converts model metrics into a feature vector. Uses cosine similarity to compare it against ALL registered models and returns a plagiarism risk score.</div>
                <div className="ai-exp-tag">sklearn.metrics.pairwise.cosine_similarity</div>
              </div>
            </div>
          </div>
          <button className="cta-btn" onClick={()=>setPage('register')}>Register Your AI Model →</button>
        </div>
      )}

      {/* REGISTER */}
      {page==='register' && (
        <div className="register">
          <div className="page-hdr">
            <div className="page-eyebrow">// REGISTER MODEL</div>
            <h2>List Your AI Model</h2>
            <p>Fill in the details. Our AI will run plagiarism detection + quality scoring before registering on blockchain.</p>
          </div>
          <div className="form-wrap">
            <div className="form-block">
              <div className="form-block-title">MODEL DETAILS</div>
              <div className="field"><label>MODEL NAME</label><input placeholder="e.g. ResNet Image Classifier" onChange={e=>setForm({...form,name:e.target.value})}/></div>
              <div className="field"><label>DESCRIPTION</label><input placeholder="What does your model do?" onChange={e=>setForm({...form,description:e.target.value})}/></div>
              <div className="field"><label>MODEL HASH (unique fingerprint)</label><input placeholder="e.g. sha256:abc123..." onChange={e=>setForm({...form,modelHash:e.target.value})}/></div>
              <div className="field"><label>LISTING PRICE (Wei)</label><input type="number" placeholder="e.g. 5000" onChange={e=>setForm({...form,price:e.target.value})}/></div>
            </div>
            <div className="form-block">
              <div className="form-block-title">🧠 AI METRICS <span className="tag">Used by both AI algorithms</span></div>
              <div className="ai-note">These values are fed into our RandomForest and Cosine Similarity models to generate quality + plagiarism scores.</div>
              <div className="field-grid">
                <div className="field"><label>ACCURACY (0-100)</label><input type="number" placeholder="e.g. 94" onChange={e=>setForm({...form,accuracy:e.target.value})}/></div>
                <div className="field"><label>MODEL SIZE (MB)</label><input type="number" placeholder="e.g. 120" onChange={e=>setForm({...form,modelSize:e.target.value})}/></div>
                <div className="field"><label>PARAMETERS (Millions)</label><input type="number" placeholder="e.g. 25" onChange={e=>setForm({...form,parameters:e.target.value})}/></div>
                <div className="field"><label>TRAINING TIME (Hours)</label><input type="number" placeholder="e.g. 48" onChange={e=>setForm({...form,trainingTime:e.target.value})}/></div>
                <div className="field full"><label>VALIDATION LOSS (e.g. 0.15)</label><input type="number" step="0.01" placeholder="e.g. 0.15" onChange={e=>setForm({...form,valLoss:e.target.value})}/></div>
              </div>
            </div>
            <button className="submit-btn" onClick={handleRegister} disabled={loading}>
              {loading ? '⏳ Running AI Analysis + Blockchain Registration...' : '🔗 Analyse & Register on Blockchain →'}
            </button>
          </div>
          {result && (
            <div className={`result-wrap ${result.success?'res-ok':'res-err'}`}>
              {result.success ? (<>
                <div className="res-title">✅ Registered Successfully!</div>
                <div className="res-scores">
                  <div className="score-card">
                    <div className="score-card-title">🧠 RandomForest Quality Score</div>
                    <div className="score-card-val">{result.ai?.qualityScore}/100</div>
                    <div className="score-bar"><div className="score-fill" style={{width:`${result.ai?.qualityScore}%`}}></div></div>
                    <div className="score-card-note">Higher accuracy, more parameters, lower loss = higher score</div>
                  </div>
                  <div className="score-card">
                    <div className="score-card-title">🔍 Cosine Similarity Uniqueness</div>
                    <div className="score-card-val">{result.ai?.uniquenessScore}%</div>
                    <div className="score-bar green"><div className="score-fill green" style={{width:`${result.ai?.uniquenessScore}%`}}></div></div>
                    <div className="score-card-note">
                      Plagiarism Risk: <strong className={`risk-${result.ai?.plagiarismRisk?.toLowerCase()}`}>{result.ai?.plagiarismRisk}</strong>
                      {result.ai?.matchedModelId && ` — Most similar to Model #${result.ai.matchedModelId}`}
                    </div>
                  </div>
                </div>
                <div className="chain-proof-mini">
                  <div className="cp-title">🔗 Blockchain Proof</div>
                  <div className="cp-row"><span>TX HASH</span><code>{result.blockchain?.txHash}</code></div>
                  <div className="cp-row"><span>BLOCK</span><code>#{result.blockchain?.blockNumber}</code></div>
                  <div className="cp-row"><span>GAS USED</span><code>{result.blockchain?.gasUsed}</code></div>
                  <div className="cp-row"><span>TIME</span><code>{result.blockchain && fmtTime(result.blockchain.blockTimestamp)}</code></div>
                  <button className="view-proof-btn" onClick={()=>setPage('proof')}>View Full Chain Proof →</button>
                </div>
              </>) : (
                <div className="res-title">❌ {result.error}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MARKETPLACE */}
      {page==='marketplace' && (
        <div className="marketplace">
          <div className="page-hdr">
            <div className="page-eyebrow">// MARKETPLACE</div>
            <h2>Browse AI Models</h2>
          </div>
          <div className="buyer-bar">
            <div className="buyer-label">🔑 BUYING WITH ETHEREUM ACCOUNT</div>
            <select value={selectedBuyer} onChange={e=>setSelectedBuyer(e.target.value)}>
              {accounts.map((a,i)=>(
                <option key={a.address} value={a.address}>
                  Account {i} — {a.address.slice(0,20)}... ({parseFloat(a.balance).toFixed(1)} ETH)
                </option>
              ))}
            </select>
            <div className="buyer-note">In production this would be your MetaMask wallet. Here we use Ganache test accounts.</div>
          </div>
          {models.length===0 ? (
            <div className="empty"><div className="empty-ico">🤖</div><h3>No models yet</h3><p>Register the first one!</p></div>
          ) : (
            <div className="cards-grid">
              {models.map((m,i)=>{
                const q  = getQuality(m.qualityScore);
                const bs = buyState[m.id];
                return (
                  <div className="mcard" key={m.id} style={{animationDelay:`${i*0.08}s`}}>
                    <div className="mcard-top">
                      <div className="mcard-name">{m.name}</div>
                      <div className={`q-badge ${q.cls}`}>{q.label}</div>
                    </div>
                    <div className="mcard-desc">{m.description}</div>
                    <div className="mcard-score">
                      <div className="mcard-score-row"><span>AI QUALITY SCORE</span><span className="score-num">{m.qualityScore}/100</span></div>
                      <div className="mcard-bar"><div className="mcard-fill" style={{width:`${m.qualityScore}%`}}></div></div>
                    </div>
                    <div className="mcard-meta">
                      <div className="mmeta"><span>PRICE</span>{m.price} Wei</div>
                      <div className="mmeta"><span>MODEL ID</span>#{m.id}</div>
                      <div className="mmeta"><span>OWNER</span>{m.owner.slice(0,12)}...</div>
                      <div className="mmeta"><span>REGISTERED</span>{fmtTime(m.timestamp)}</div>
                    </div>
                    <div className="mcard-footer">
                      {m.isForSale ? (
                        <button
                          className={`buy-btn ${bs==='loading'?'b-loading':''} ${bs==='success'?'b-success':''}`}
                          onClick={()=>handleBuy(m.id)}
                          disabled={bs==='loading'||bs==='success'}
                        >
                          {bs==='loading'?'⏳ Processing Blockchain Transaction...':bs==='success'?'✅ Ownership Transferred on Chain!':`🛒 Buy for ${m.price} Wei`}
                        </button>
                      ) : (
                        <div className="sold-tag">🔴 SOLD — Ownership Transferred on Blockchain</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CHAIN PROOF */}
      {page==='proof' && (
        <div className="proof-page">
          <div className="page-hdr">
            <div className="page-eyebrow">// BLOCKCHAIN PROOF</div>
            <h2>On-Chain Verification</h2>
            <p>Every registration and purchase creates a permanent cryptographic record on Ethereum that nobody can alter.</p>
          </div>

          {/* ── VIEW ALL TRANSACTIONS BUTTON ── */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:32 }}>
            <button
              onClick={()=>setShowExplorer(true)}
              style={{
                display:'inline-flex', alignItems:'center', gap:12,
                padding:'14px 32px', borderRadius:12,
                border:'1px solid #00d4ff66',
                background:'linear-gradient(135deg,#00d4ff18,transparent)',
                color:'#00d4ff',
                fontFamily:"'Orbitron','Share Tech Mono',monospace",
                fontSize:14, fontWeight:700, letterSpacing:2,
                cursor:'pointer', transition:'all .25s',
              }}
              onMouseEnter={e=>{
                e.currentTarget.style.borderColor='#00d4ff';
                e.currentTarget.style.boxShadow='0 0 28px #00d4ff33,0 0 60px #00d4ff18';
                e.currentTarget.style.transform='translateY(-2px)';
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.borderColor='#00d4ff66';
                e.currentTarget.style.boxShadow='none';
                e.currentTarget.style.transform='translateY(0)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4M7 7h10M7 11h6"/>
              </svg>
              VIEW ALL TRANSACTIONS
              {txHistory.length > 0 && (
                <span style={{
                  background:'#00d4ff', color:'#050d15',
                  borderRadius:'50%', width:22, height:22,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:900,
                }}>{txHistory.length}</span>
              )}
            </button>
          </div>

          {proof ? (
            <div className="proof-card">
              <div className="proof-verified">⛓ VERIFIED ON ETHEREUM BLOCKCHAIN</div>
              <div className="proof-main">
                <div className="proof-field full">
                  <div className="pf-label">TRANSACTION HASH</div>
                  <code className="pf-hash">{proof.txHash}</code>
                  <div className="pf-note">This is a SHA-256 cryptographic hash. It uniquely identifies this transaction and is mathematically impossible to forge or alter.</div>
                </div>
                <div className="proof-field">
                  <div className="pf-label">BLOCK NUMBER</div>
                  <div className="pf-val">#{proof.blockNumber}</div>
                </div>
                <div className="proof-field">
                  <div className="pf-label">GAS USED</div>
                  <div className="pf-val">{proof.gasUsed}</div>
                </div>
                <div className="proof-field">
                  <div className="pf-label">TIMESTAMP</div>
                  <div className="pf-val">{fmtTime(proof.blockTimestamp)}</div>
                </div>
                <div className="proof-field">
                  <div className="pf-label">CONTRACT</div>
                  <div className="pf-val" style={{fontSize:'13px'}}>{proof.contractAddress?.slice(0,20)}...</div>
                </div>
                {proof.newOwner && <>
                  <div className="proof-field full">
                    <div className="pf-label">NEW OWNER (Ownership Transferred To)</div>
                    <code className="pf-hash">{proof.newOwner}</code>
                  </div>
                  <div className="proof-field">
                    <div className="pf-label">PRICE PAID</div>
                    <div className="pf-val">{proof.pricePaid} Wei</div>
                  </div>
                </>}
              </div>
              <div className="proof-explain">
                <div className="pe-title">🔒 Why This Proves Ownership Forever</div>
                <p>This transaction is written into block <strong>#{proof.blockNumber}</strong> of the Ethereum blockchain. Each block contains the cryptographic hash of the previous block — forming a chain. Changing any record would require recalculating every block that came after it, on thousands of computers simultaneously. This is computationally impossible — making blockchain records permanent and tamper-proof.</p>
              </div>
            </div>
          ) : (
            <div className="empty">
              <div className="empty-ico">⛓</div>
              <h3>No proof yet</h3>
              <p>Register or buy a model to see the blockchain proof here!</p>
              <button className="cta-btn" style={{marginTop:'24px'}} onClick={()=>setPage('register')}>Register a Model</button>
            </div>
          )}
        </div>
      )}

      {/* CHAIN EXPLORER OVERLAY */}
      {showExplorer && (
        <ChainExplorer txHistory={txHistory} onClose={()=>setShowExplorer(false)} />
      )}

    </div>
  );
}

export default App;