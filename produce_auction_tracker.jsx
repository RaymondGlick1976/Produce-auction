import { useState, useEffect, useRef, useMemo } from "react";

const DEFAULT_PRODUCE = [
  'Acorn Squash','Apples','Asparagus','Avocados','Bananas','Beets',
  'Bell Peppers','Blueberries','Broccoli','Brussels Sprouts','Butternut Squash',
  'Cabbage','Cantaloupe','Carrots','Cauliflower','Celery','Cherries',
  'Collard Greens','Corn','Cucumbers','Eggplant','Garlic','Grapes',
  'Green Beans','Green Onions','Honeydew','Iceberg Lettuce','Jalapeños',
  'Kale','Kohlrabi','Lemons','Limes','Mangos','Mushrooms','Nectarines',
  'Okra','Onions','Oranges','Parsnips','Peaches','Pears','Peas',
  'Pineapples','Plums','Potatoes','Pumpkins','Radishes','Raspberries',
  'Red Onions','Romaine Lettuce','Roma Tomatoes','Russet Potatoes',
  'Spinach','Strawberries','Summer Squash','Sweet Corn','Sweet Peppers',
  'Sweet Potatoes','Swiss Chard','Tomatoes','Turnips','Watermelon',
  'Yellow Squash','Yellow Tomatoes','Zucchini'
];

const UNITS = [
  '25 lb. box','40 lb. box','50 lb. bag','bu. crate','bunch',
  'flat','half-box','lug','peck','pint flat','quart flat',
  'bag','crate','sack','barrel','carton','hamper','wirebound crate'
];

const GRADES = ['No. 1','No. 2','No. 3','Canners'];
const COLORS = ['N/A','Green','Yellow','Red','Mixed'];
const COLOR_DOT = { Green:'#1D9E75', Yellow:'#EF9F27', Red:'#E24B4A', Mixed:'#888780' };
const CS = {
  'Green':  { bg:'#E1F5EE', color:'#085041', border:'#5DCAA5', dot:'#1D9E75' },
  'Yellow': { bg:'#FAEEDA', color:'#633806', border:'#EF9F27', dot:'#EF9F27' },
  'Red':    { bg:'#FCEBEB', color:'#501313', border:'#F09595', dot:'#E24B4A' },
  'Mixed':  { bg:'#F1EFE8', color:'#2C2C2A', border:'#B4B2A9', dot:'#888780' },
};

const GS = {
  'No. 1':  { bg:'#E1F5EE', color:'#085041', border:'#5DCAA5' },
  'No. 2':  { bg:'#E6F1FB', color:'#0C447C', border:'#85B7EB' },
  'No. 3':  { bg:'#EEEDFE', color:'#26215C', border:'#AFA9EC' },
  'Canners':{ bg:'#FAEEDA', color:'#633806', border:'#EF9F27' },
};

const fmt = v => '$' + (parseFloat(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const nowDate  = () => new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const nowShort = () => new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
const BLANK = { item:'', unit:'25 lb. box', grade:'No. 1', color:'N/A', grower:'', qty:'', price:'', total:'', description:'', is_loaded:false };

export default function ProduceTracker() {
  const [tab,           setTab]           = useState('add');
  const [db,            setDb]            = useState(DEFAULT_PRODUCE);
  const [savedLists,    setSavedLists]    = useState([]);
  const [listName,      setListName]      = useState(`Auction — ${nowShort()}`);
  const [lots,          setLots]          = useState([]);
  const [form,          setForm]          = useState({...BLANK});
  const [formOpen,      setFormOpen]      = useState(true);
  const [sugg,          setSugg]          = useState([]);
  const [editId,        setEditId]        = useState(null);
  const [confirmDelete,        setConfirmDelete]        = useState(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(null);
  const [toast,         setToast]         = useState('');
  const [loaded,        setLoaded]        = useState(false);
  const [editName,      setEditName]      = useState(false);
  const [newItem,       setNewItem]       = useState('');
  const [customUnit,    setCustomUnit]    = useState('');
  const itemRef = useRef(null);
  const nameRef = useRef(null);

  /* ── Load from storage ── */
  useEffect(() => {
    (async () => {
      try { const r=await window.storage.get('pdb');   if(r) setDb(JSON.parse(r.value)); } catch {}
      try { const r=await window.storage.get('alst');  if(r) setSavedLists(JSON.parse(r.value)); } catch {}
      try {
        const r=await window.storage.get('cur');
        if(r){ const d=JSON.parse(r.value); setListName(d.n||`Auction — ${nowShort()}`); setLots(d.l||[]); }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  /* ── Persist current session ── */
  useEffect(() => {
    if (!loaded) return;
    window.storage.set('cur', JSON.stringify({n:listName, l:lots})).catch(()=>{});
  }, [lots, listName, loaded]);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''), 2000); };

  /* ── Autocomplete ── */
  const handleItemInput = val => {
    setForm(f=>({...f, item:val}));
    setSugg(val.length >= 1
      ? db.filter(p=>p.toLowerCase().includes(val.toLowerCase())).slice(0,8)
      : []);
  };

  const pickSugg = s => { setForm(f=>({...f,item:s})); setSugg([]); };

  /* ── Calculated fields ── */
  const handlePrice = val => {
    const p=parseFloat(val), q=parseFloat(form.qty);
    setForm(f=>({...f, price:val, total:(!isNaN(p)&&!isNaN(q)) ? (p*q).toFixed(2) : f.total}));
  };
  const handleQty = val => {
    const p=parseFloat(form.price), q=parseFloat(val);
    setForm(f=>({...f, qty:val, total:(!isNaN(p)&&!isNaN(q)) ? (p*q).toFixed(2) : f.total}));
  };
  const handleTotal = val => {
    const q=parseFloat(form.qty), t=parseFloat(val);
    setForm(f=>({...f, total:val, price:(!isNaN(q)&&q>0&&!isNaN(t)) ? (t/q).toFixed(2) : f.price}));
  };

  /* ── Save lot ── */
  const saveLot = () => {
    if (!form.item.trim()) { itemRef.current?.focus(); return; }
    const unitVal = form.unit === '__custom__' ? customUnit.trim() || 'custom' : form.unit;

    // Auto-add new item to DB
    if (!db.some(p=>p.toLowerCase()===form.item.trim().toLowerCase())) {
      const ndb = [...db, form.item.trim()].sort((a,b)=>a.localeCompare(b));
      setDb(ndb);
      window.storage.set('pdb', JSON.stringify(ndb)).catch(()=>{});
    }

    const lot = {
      id: editId || Date.now(),
      item:        form.item.trim(),
      unit:        unitVal,
      grade:       form.grade,
      color:       form.color,
      grower:      form.grower.trim(),
      qty:         form.qty,
      price:       form.price,
      total:       form.total || '0',
      description: form.description.trim(),
      is_loaded:   false,
    };

    if (editId) {
      setLots(ls=>ls.map(l=>l.id===editId ? lot : l));
      setEditId(null);
      showToast('Lot updated');
    } else {
      setLots(ls=>[...ls, lot]);
      showToast('Saved ✓');
    }

    // Keep unit/grade/color/grower for fast repeat entry
    setForm(f=>({...BLANK, unit:f.unit, grade:f.grade, color:f.color, grower:f.grower}));
    setCustomUnit('');
    setSugg([]);
    setTimeout(()=>itemRef.current?.focus(), 80);
  };

  const startEdit = lot => {
    const isCustom = !UNITS.includes(lot.unit);
    setForm({item:lot.item, unit:isCustom?'__custom__':lot.unit, grade:lot.grade,
      color:lot.color||'N/A', grower:lot.grower, qty:lot.qty, price:lot.price,
      total:lot.total, description:lot.description||''});
    if (isCustom) setCustomUnit(lot.unit);
    setEditId(lot.id); setTab('add'); setFormOpen(true);
    setTimeout(()=>itemRef.current?.focus(), 80);
  };

  const deleteLot    = id => { setLots(ls=>ls.filter(l=>l.id!==id)); setConfirmDelete(null); };
  const toggleLoaded = id => setLots(ls=>ls.map(l=>l.id===id ? {...l,is_loaded:!l.is_loaded} : l));
  const runTotal     = lots.reduce((s,l)=>s+parseFloat(l.total||0), 0);
  const loadedCount  = lots.filter(l=>l.is_loaded).length;

  /* ── Report data ── */
  const reportItems = useMemo(() => {
    const map = {};
    lots.forEach(lot => {
      const key = lot.item.trim().toLowerCase();
      if (!map[key]) map[key] = {name:lot.item.trim(), totalCost:0, lotCount:0, units:{}};
      map[key].totalCost += parseFloat(lot.total)||0;
      map[key].lotCount++;
      const u = lot.unit||'unit';
      if (!map[key].units[u]) map[key].units[u] = {qty:0, cost:0, lots:0};
      map[key].units[u].qty  += parseFloat(lot.qty)||0;
      map[key].units[u].cost += parseFloat(lot.total)||0;
      map[key].units[u].lots++;
    });
    return Object.values(map).sort((a,b)=>b.totalCost-a.totalCost);
  }, [lots]);

  /* ── List management ── */
  const saveList = async () => {
    if (!lots.length) { showToast('No lots to save'); return; }
    const list = {id:Date.now(), name:listName, date:nowDate(), lots:[...lots], total:runTotal.toFixed(2)};
    const nl = [list, ...savedLists];
    setSavedLists(nl);
    await window.storage.set('alst', JSON.stringify(nl)).catch(()=>{});
    showToast('List saved!');
  };

  const loadList = list => {
    setListName(list.name);
    setLots(list.lots);
    setTab('add');
    showToast('List loaded');
  };

  const deleteList = async id => {
    const nl = savedLists.filter(l=>l.id!==id);
    setSavedLists(nl);
    await window.storage.set('alst', JSON.stringify(nl)).catch(()=>{});
    showToast('Deleted');
  };

  const newList = () => {
    setListName(`Auction — ${nowShort()}`);
    setLots([]); setEditId(null); setForm({...BLANK});
    setTab('add'); showToast('New list started');
  };

  /* ── Export text ── */
  const exportText = [
    listName, nowDate(), '='.repeat(44),
    ...lots.map((l,i)=>`${String(i+1).padStart(2,'0')}  ${l.item}\n    Grade: ${l.grade}  |  Grower: ${l.grower||'—'}  |  Qty: ${l.qty||'—'} × ${l.unit}\n    Lot total: ${fmt(l.total)}`),
    '='.repeat(44),
    `TOTAL: ${fmt(runTotal)}  (${lots.length} lot${lots.length!==1?'s':''})`
  ].join('\n\n');

  const copyExport = () => navigator.clipboard?.writeText(exportText).then(()=>showToast('Copied!'));

  /* ── DB management ── */
  const addDbItem = async () => {
    const v=newItem.trim();
    if (!v||db.some(p=>p.toLowerCase()===v.toLowerCase())) { setNewItem(''); return; }
    const ndb=[...db,v].sort((a,b)=>a.localeCompare(b));
    setDb(ndb);
    await window.storage.set('pdb', JSON.stringify(ndb)).catch(()=>{});
    setNewItem(''); showToast('Added!');
  };

  const removeDbItem = async item => {
    const ndb=db.filter(p=>p!==item);
    setDb(ndb);
    await window.storage.set('pdb', JSON.stringify(ndb)).catch(()=>{});
  };

  /* ── Shared input style ── */
  const inp = {
    background:'var(--color-background-secondary)',
    border:'0.5px solid var(--color-border-tertiary)',
    borderRadius:'var(--border-radius-md)',
    padding:'9px 11px', fontSize:14,
    color:'var(--color-text-primary)', outline:'none',
    width:'100%', fontFamily:'var(--font-sans)',
  };

  const lbl = { fontSize:11, color:'var(--color-text-tertiary)', marginBottom:3 };

  /* ══════════════════════════════════════════════════ RENDER */
  return (
    <div style={{fontFamily:'var(--font-sans)', maxWidth:500, margin:'0 auto', paddingBottom:76}}>

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',
          background:'#1D9E75',color:'#fff',padding:'8px 22px',borderRadius:24,
          fontSize:14,fontWeight:500,zIndex:1000,pointerEvents:'none',whiteSpace:'nowrap'}}>
          {toast}
        </div>
      )}

      {/* ── Sticky header ── */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'var(--color-background-primary)',
        borderBottom:'0.5px solid var(--color-border-tertiary)',padding:'10px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
          {editName ? (
            <input ref={nameRef} value={listName} onChange={e=>setListName(e.target.value)}
              onBlur={()=>setEditName(false)} onKeyDown={e=>e.key==='Enter'&&setEditName(false)}
              style={{...inp,fontSize:15,fontWeight:500,padding:'3px 6px',width:'auto',flex:1,marginRight:8}} autoFocus />
          ) : (
            <span onClick={()=>{setEditName(true);setTimeout(()=>nameRef.current?.select(),50);}}
              style={{fontSize:15,fontWeight:500,color:'var(--color-text-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              {listName}<span style={{fontSize:11,color:'var(--color-text-tertiary)'}}>✎</span>
            </span>
          )}
          <span style={{fontSize:20,fontWeight:500,color:'#1D9E75'}}>{fmt(runTotal)}</span>
        </div>
        <span style={{fontSize:12,color:'var(--color-text-secondary)'}}>
          {lots.length} lot{lots.length!==1?'s':''}
          {loadedCount>0 && <span style={{color:'#1D9E75',marginLeft:4}}>· {loadedCount} loaded</span>}
          {' · '}{nowDate()}
        </span>
      </div>

      {/* ════════════════════ TAB: ADD LOT */}
      {tab==='add' && (
        <div style={{padding:'12px 16px'}}>

          <div style={{background:'var(--color-background-primary)',borderRadius:'var(--border-radius-lg)',
            border:'0.5px solid var(--color-border-tertiary)',marginBottom:14,overflow:'hidden'}}>

            {/* Form header — always visible */}
            <div onClick={()=>setFormOpen(o=>!o)}
              style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'12px 14px',cursor:'pointer',userSelect:'none'}}>
              <span style={{fontSize:11,fontWeight:500,letterSpacing:'0.06em',color:'var(--color-text-secondary)'}}>
                {editId ? '✎  EDIT LOT' : 'NEW LOT'}
              </span>
              <span style={{fontSize:13,color:'var(--color-text-tertiary)',lineHeight:1}}>
                {formOpen ? '▲ hide' : '▼ show'}
              </span>
            </div>

            {/* Collapsible form body */}
            {formOpen && <div style={{padding:'0 14px 14px'}}>

            {/* ─ Item with autocomplete ─ */}
            <div style={{marginBottom:10,position:'relative'}}>
              <div style={lbl}>PRODUCE ITEM</div>
              <input ref={itemRef} value={form.item} onChange={e=>handleItemInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&saveLot()} placeholder="Start typing to search…"
                style={inp} autoComplete="off" autoCorrect="off" />
              {sugg.length > 0 && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,marginTop:2,
                  background:'var(--color-background-primary)',
                  border:'0.5px solid var(--color-border-secondary)',
                  borderRadius:'var(--border-radius-md)',zIndex:100,overflow:'hidden',
                  boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
                  {sugg.map(s=>(
                    <div key={s}
                      onMouseDown={()=>pickSugg(s)}
                      onTouchStart={e=>{e.preventDefault();pickSugg(s);}}
                      style={{padding:'11px 14px',fontSize:14,cursor:'pointer',
                        borderBottom:'0.5px solid var(--color-border-tertiary)',
                        color:'var(--color-text-primary)'}}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─ Unit + Grower ─ */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
              <div>
                <div style={lbl}>UNIT TYPE</div>
                <select value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}
                  style={{...inp,paddingRight:6,cursor:'pointer'}}>
                  {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
              </div>
              <div>
                <div style={lbl}>GROWER #</div>
                <input value={form.grower} onChange={e=>setForm(f=>({...f,grower:e.target.value}))}
                  placeholder="e.g. 4471" style={inp} />
              </div>
            </div>

            {/* Custom unit input (shown when Custom selected) */}
            {form.unit==='__custom__' && (
              <div style={{marginBottom:10}}>
                <div style={lbl}>CUSTOM UNIT</div>
                <input value={customUnit} onChange={e=>setCustomUnit(e.target.value)}
                  placeholder="e.g. wooden crate" style={inp} />
              </div>
            )}

            {/* ─ Grade quick-tap ─ */}
            <div style={{marginBottom:10}}>
              <div style={lbl}>GRADE</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
                {GRADES.map(g=>{
                  const gs=GS[g]; const on=form.grade===g;
                  return (
                    <button key={g} onClick={()=>setForm(f=>({...f,grade:g}))} style={{
                      padding:'9px 4px', fontSize:12, fontWeight:500,
                      borderRadius:'var(--border-radius-md)',
                      border: on ? `1.5px solid ${gs.border}` : '0.5px solid var(--color-border-tertiary)',
                      background: on ? gs.bg : 'var(--color-background-secondary)',
                      color: on ? gs.color : 'var(--color-text-secondary)',
                      cursor:'pointer', fontFamily:'var(--font-sans)', transition:'all 0.1s'
                    }}>{g}</button>
                  );
                })}
              </div>
            </div>

            {/* ─ Color dropdown ─ */}
            <div style={{marginBottom:10}}>
              <div style={lbl}>COLOR</div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {form.color!=='N/A'&&COLOR_DOT[form.color]&&(
                  <span style={{width:10,height:10,borderRadius:'50%',
                    background:COLOR_DOT[form.color],flexShrink:0}}/>
                )}
                <select value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                  style={{...inp,cursor:'pointer',width:'auto',flex:1}}>
                  {COLORS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* ─ Qty + Price ─ */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div>
                <div style={lbl}>QTY</div>
                <input value={form.qty} onChange={e=>handleQty(e.target.value)}
                  type="number" inputMode="decimal" placeholder="0" style={inp} />
              </div>
              <div>
                <div style={lbl}>PRICE / UNIT $</div>
                <input value={form.price} onChange={e=>handlePrice(e.target.value)}
                  type="number" inputMode="decimal" placeholder="0.00" style={inp} />
              </div>
            </div>

            {/* ─ Total lot cost ─ */}
            <div style={{marginBottom:10}}>
              <div style={lbl}>TOTAL LOT COST $</div>
              <input value={form.total} onChange={e=>handleTotal(e.target.value)}
                type="number" inputMode="decimal" placeholder="or enter lot total directly"
                style={{...inp, background:'#E1F5EE', border:'0.5px solid #5DCAA5',
                  color:'#085041', fontSize:17, fontWeight:500}} />
            </div>

            {/* ─ Notes ─ */}
            <div style={{marginBottom:12}}>
              <div style={lbl}>NOTES (optional)</div>
              <textarea value={form.description}
                onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                placeholder="e.g. slight bruising, early pick, good size…"
                rows={2}
                style={{...inp,resize:'vertical',lineHeight:1.5,padding:'8px 11px',fontSize:13,fontFamily:'var(--font-sans)'}} />
            </div>

            {/* ─ Buttons ─ */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:8}}>
              <button
                onClick={()=>{setForm(f=>({...BLANK,unit:f.unit,grade:f.grade,color:f.color,grower:f.grower}));setEditId(null);setSugg([]);}}
                style={{padding:11,fontSize:14,borderRadius:'var(--border-radius-md)',
                  border:'0.5px solid var(--color-border-secondary)',
                  background:'var(--color-background-secondary)',
                  color:'var(--color-text-secondary)',cursor:'pointer',fontFamily:'var(--font-sans)'}}>
                Clear
              </button>
              <button onClick={saveLot} style={{padding:11,fontSize:15,fontWeight:500,
                borderRadius:'var(--border-radius-md)',border:'none',
                background:'#1D9E75',color:'#fff',cursor:'pointer',fontFamily:'var(--font-sans)'}}>
                {editId ? 'Update Lot' : 'Save + Next ↵'}
              </button>
            </div>
          </div>}{/* end collapsible body */}
          </div>{/* end form card */}

          {/* ─ Lots list ─ */}
          {lots.length > 0 ? (
            <div>
              <div style={{fontSize:11,fontWeight:500,letterSpacing:'0.06em',
                color:'var(--color-text-secondary)',marginBottom:8}}>
                SAVED LOTS ({lots.length})
              </div>

              {[...lots].reverse().map(lot => {
                const gs = GS[lot.grade] || GS['No. 1'];
                const dot = COLOR_DOT[lot.color];
                return (
                  <div key={lot.id} style={{background: lot.is_loaded ? '#E1F5EE' : 'var(--color-background-primary)',
                    borderRadius:'var(--border-radius-lg)',
                    border: lot.is_loaded ? '0.5px solid #5DCAA5' : '0.5px solid var(--color-border-tertiary)',
                    padding:'10px 14px',marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {dot && <span style={{width:10,height:10,borderRadius:'50%',background:dot,flexShrink:0}}/>}
                        <span style={{fontSize:15,fontWeight:500,
                          color: lot.is_loaded ? '#085041' : 'var(--color-text-primary)',
                          textDecoration: lot.is_loaded ? 'line-through' : 'none',
                          opacity: lot.is_loaded ? 0.75 : 1}}>
                          {lot.item}
                        </span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                          background:gs.bg,color:gs.color,fontWeight:500,flexShrink:0}}>
                          {lot.grade}
                        </span>
                        <button onClick={()=>toggleLoaded(lot.id)}
                          style={{width:30,height:30,borderRadius:'50%',flexShrink:0,cursor:'pointer',
                            border: lot.is_loaded ? 'none' : '1.5px solid var(--color-border-secondary)',
                            background: lot.is_loaded ? '#1D9E75' : 'transparent',
                            color: lot.is_loaded ? '#fff' : 'var(--color-text-tertiary)',
                            fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',
                            fontWeight:600,fontFamily:'var(--font-sans)'}}>
                          {lot.is_loaded ? '✓' : '○'}
                        </button>
                      </div>
                    </div>
                    <div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:lot.description?4:6}}>
                      <b style={{color:'var(--color-text-primary)',fontWeight:500}}>{lot.qty||'—'}</b> × {lot.unit}
                      {lot.price ? <span style={{marginLeft:8}}>{fmt(lot.price)}/unit</span> : ''}
                    </div>
                    {lot.description && (
                      <div style={{fontSize:12,color:'var(--color-text-tertiary)',fontStyle:'italic',
                        marginBottom:6,lineHeight:1.4}}>
                        {lot.description}
                      </div>
                    )}
                    {confirmDelete===lot.id ? (
                      <div style={{paddingTop:8,borderTop:'0.5px solid var(--color-border-tertiary)',
                        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:12,color:'var(--color-text-secondary)'}}>Remove this lot?</span>
                        <div style={{display:'flex',gap:8}}>
                          <button onClick={()=>setConfirmDelete(null)}
                            style={{fontSize:12,padding:'5px 12px',borderRadius:'var(--border-radius-md)',
                              border:'0.5px solid var(--color-border-secondary)',
                              background:'var(--color-background-secondary)',
                              color:'var(--color-text-secondary)',cursor:'pointer',fontFamily:'var(--font-sans)'}}>
                            Cancel
                          </button>
                          <button onClick={()=>deleteLot(lot.id)}
                            style={{fontSize:12,padding:'5px 12px',borderRadius:'var(--border-radius-md)',
                              border:'none',background:'#A32D2D',color:'#fff',
                              cursor:'pointer',fontWeight:500,fontFamily:'var(--font-sans)'}}>
                            Yes, remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                        paddingTop:6,borderTop:'0.5px solid var(--color-border-tertiary)'}}>
                        <div style={{display:'flex',gap:10,alignItems:'center'}}>
                          {lot.grower && (
                            <span style={{fontSize:11,background:'var(--color-background-secondary)',
                              color:'var(--color-text-secondary)',padding:'2px 8px',borderRadius:20}}>
                              GR {lot.grower}
                            </span>
                          )}
                          <button onClick={()=>startEdit(lot)}
                            style={{fontSize:12,color:'#185FA5',background:'none',border:'none',
                              cursor:'pointer',padding:0,fontFamily:'var(--font-sans)'}}>Edit</button>
                          <button onClick={()=>setConfirmDelete(lot.id)}
                            style={{fontSize:12,color:'#A32D2D',background:'none',border:'none',
                              cursor:'pointer',padding:0,fontFamily:'var(--font-sans)'}}>Remove</button>
                        </div>
                        <span style={{fontSize:16,fontWeight:500,color:'var(--color-text-primary)'}}>{fmt(lot.total)}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',
                padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
                <span style={{fontSize:14,color:'var(--color-text-secondary)'}}>Total ({lots.length} lots)</span>
                <span style={{fontSize:18,fontWeight:500,color:'var(--color-text-primary)'}}>{fmt(runTotal)}</span>
              </div>
            </div>
          ) : (
            <div style={{textAlign:'center',padding:'40px 20px',
              color:'var(--color-text-tertiary)',fontSize:14}}>
              No lots yet — fill out the form above
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ TAB: MY LISTS */}
      {tab==='lists' && (
        <div style={{padding:'12px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span style={{fontSize:14,fontWeight:500,color:'var(--color-text-primary)'}}>Saved Lists</span>
            <button onClick={newList} style={{fontSize:13,padding:'6px 14px',
              borderRadius:'var(--border-radius-md)',border:'0.5px solid #1D9E75',
              background:'transparent',color:'#1D9E75',cursor:'pointer',
              fontFamily:'var(--font-sans)',fontWeight:500}}>
              + New List
            </button>
          </div>

          <button onClick={saveList} style={{width:'100%',padding:11,fontSize:14,fontWeight:500,
            borderRadius:'var(--border-radius-md)',border:'0.5px solid var(--color-border-secondary)',
            background:'var(--color-background-primary)',color:'var(--color-text-primary)',
            cursor:'pointer',marginBottom:14,fontFamily:'var(--font-sans)',
            display:'flex',justifyContent:'center',gap:8,alignItems:'center'}}>
            <span>Save current list</span>
            <span style={{fontSize:12,color:'var(--color-text-secondary)'}}>
              {lots.length} lots · {fmt(runTotal)}
            </span>
          </button>

          {savedLists.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px 20px',
              color:'var(--color-text-tertiary)',fontSize:14}}>
              No saved lists yet
            </div>
          ) : savedLists.map(list=>(
            <div key={list.id} style={{background:'var(--color-background-primary)',
              borderRadius:'var(--border-radius-lg)',
              border:'0.5px solid var(--color-border-tertiary)',padding:'12px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                <div>
                  <div style={{fontSize:15,fontWeight:500,color:'var(--color-text-primary)',marginBottom:2}}>{list.name}</div>
                  <div style={{fontSize:12,color:'var(--color-text-secondary)'}}>{list.date} · {list.lots.length} lots</div>
                </div>
                <span style={{fontSize:16,fontWeight:500,color:'var(--color-text-primary)'}}>{fmt(list.total)}</span>
              </div>
              <div style={{display:'flex',gap:14,marginTop:8,paddingTop:8,borderTop:'0.5px solid var(--color-border-tertiary)'}}>
                {confirmDeleteSession===list.id ? (
                  <>
                    <span style={{fontSize:12,color:'var(--color-text-secondary)',alignSelf:'center'}}>Delete this list?</span>
                    <button onClick={()=>setConfirmDeleteSession(null)}
                      style={{fontSize:12,padding:'5px 12px',borderRadius:'var(--border-radius-md)',
                        border:'0.5px solid var(--color-border-secondary)',
                        background:'var(--color-background-secondary)',
                        color:'var(--color-text-secondary)',cursor:'pointer',
                        fontFamily:'var(--font-sans)',marginLeft:'auto'}}>
                      Cancel
                    </button>
                    <button onClick={()=>{deleteList(list.id);setConfirmDeleteSession(null);}}
                      style={{fontSize:12,padding:'5px 12px',borderRadius:'var(--border-radius-md)',
                        border:'none',background:'#A32D2D',color:'#fff',
                        cursor:'pointer',fontWeight:500,fontFamily:'var(--font-sans)'}}>
                      Yes, delete
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>loadList(list)}
                      style={{fontSize:13,color:'#185FA5',background:'none',border:'none',
                        cursor:'pointer',fontFamily:'var(--font-sans)',padding:0}}>
                      Load
                    </button>
                    <button onClick={()=>setConfirmDeleteSession(list.id)}
                      style={{fontSize:13,color:'#A32D2D',background:'none',border:'none',
                        cursor:'pointer',fontFamily:'var(--font-sans)',padding:0}}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════ TAB: PRINT / EXPORT */}
      {tab==='export' && (
        <div style={{padding:'12px 16px'}}>
          <div style={{fontSize:14,fontWeight:500,color:'var(--color-text-primary)',marginBottom:12}}>
            Print / Export
          </div>
          {lots.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px 20px',
              color:'var(--color-text-tertiary)',fontSize:14}}>
              Add some lots first
            </div>
          ) : (
            <>
              <div style={{background:'var(--color-background-primary)',
                borderRadius:'var(--border-radius-lg)',
                border:'0.5px solid var(--color-border-tertiary)',padding:14,
                fontFamily:'var(--font-mono)',fontSize:12,lineHeight:1.8,
                color:'var(--color-text-primary)',whiteSpace:'pre-wrap',
                marginBottom:12,overflowX:'auto'}}>
                {exportText}
              </div>
              <button onClick={copyExport} style={{width:'100%',padding:11,fontSize:14,fontWeight:500,
                borderRadius:'var(--border-radius-md)',border:'0.5px solid #1D9E75',
                background:'transparent',color:'#1D9E75',cursor:'pointer',marginBottom:8,
                fontFamily:'var(--font-sans)'}}>
                Copy to clipboard
              </button>
            </>
          )}
        </div>
      )}

      {/* ════════════════════ TAB: ITEMS DB */}
      {tab==='db' && (
        <div style={{padding:'12px 16px'}}>
          <div style={{fontSize:14,fontWeight:500,color:'var(--color-text-primary)',marginBottom:4}}>
            Produce Database
          </div>
          <div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:12}}>
            {db.length} items · New items auto-save when you add a lot
          </div>

          <div style={{display:'flex',gap:8,marginBottom:14}}>
            <input value={newItem} onChange={e=>setNewItem(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addDbItem()}
              placeholder="Add item manually…"
              style={{...inp,flex:1,width:'auto'}} />
            <button onClick={addDbItem} style={{padding:'9px 18px',fontSize:14,fontWeight:500,
              borderRadius:'var(--border-radius-md)',border:'none',background:'#1D9E75',
              color:'#fff',cursor:'pointer',fontFamily:'var(--font-sans)',flexShrink:0}}>
              Add
            </button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
            {db.map(item=>(
              <div key={item} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                background:'var(--color-background-primary)',
                border:'0.5px solid var(--color-border-tertiary)',
                borderRadius:'var(--border-radius-md)',padding:'7px 10px'}}>
                <span style={{fontSize:13,color:'var(--color-text-primary)'}}>{item}</span>
                <button onClick={()=>removeDbItem(item)} style={{fontSize:18,lineHeight:1,
                  color:'var(--color-text-tertiary)',background:'none',border:'none',
                  cursor:'pointer',padding:'0 0 0 6px',fontFamily:'var(--font-sans)'}}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════ TAB: REPORTS */}
      {tab==='reports' && (
        <div style={{padding:'12px 16px'}}>
          <div style={{fontSize:14,fontWeight:500,color:'var(--color-text-primary)',marginBottom:4}}>Purchase Report</div>
          <div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:14}}>
            {listName} · {lots.length} lots · {fmt(runTotal)}
          </div>

          {lots.length===0 ? (
            <div style={{textAlign:'center',padding:'40px 20px',color:'var(--color-text-tertiary)',fontSize:14}}>
              Add some lots to see the report
            </div>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
                {[
                  {label:'Total Paid', value:fmt(runTotal)},
                  {label:'Lots',       value:lots.length},
                  {label:'Products',   value:reportItems.length},
                ].map(s=>(
                  <div key={s.label} style={{background:'var(--color-background-secondary)',
                    borderRadius:'var(--border-radius-md)',padding:'10px 8px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'var(--color-text-tertiary)',marginBottom:4,letterSpacing:'0.04em'}}>
                      {s.label.toUpperCase()}
                    </div>
                    <div style={{fontSize:17,fontWeight:500,color:'var(--color-text-primary)'}}>{s.value}</div>
                  </div>
                ))}
              </div>

              {reportItems.map(item=>(
                <div key={item.name} style={{background:'var(--color-background-primary)',
                  borderRadius:'var(--border-radius-lg)',
                  border:'0.5px solid var(--color-border-tertiary)',marginBottom:8,overflow:'hidden'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'10px 14px',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                    <span style={{fontSize:15,fontWeight:500,color:'var(--color-text-primary)'}}>{item.name}</span>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:15,fontWeight:500,color:'var(--color-text-primary)'}}>{fmt(item.totalCost)}</div>
                      <div style={{fontSize:11,color:'var(--color-text-tertiary)'}}>{item.lotCount} lot{item.lotCount!==1?'s':''}</div>
                    </div>
                  </div>
                  {Object.entries(item.units).map(([unit,data])=>(
                    <div key={unit} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                      padding:'8px 14px',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                      <div>
                        <span style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)'}}>
                          {Number.isInteger(data.qty)?data.qty:parseFloat(data.qty.toFixed(1))}
                        </span>
                        <span style={{fontSize:12,color:'var(--color-text-secondary)',marginLeft:4}}>× {unit}</span>
                        {data.lots>1&&<span style={{fontSize:11,color:'var(--color-text-tertiary)',marginLeft:8}}>({data.lots} lots)</span>}
                      </div>
                      <span style={{fontSize:13,color:'var(--color-text-secondary)'}}>{fmt(data.cost)}</span>
                    </div>
                  ))}
                  <div style={{padding:'6px 14px',background:'var(--color-background-secondary)'}}>
                    <div style={{height:4,borderRadius:2,background:'var(--color-background-tertiary)',overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:2,background:'#1D9E75',
                        width:(item.totalCost/runTotal*100).toFixed(1)+'%'}}/>
                    </div>
                    <div style={{fontSize:10,color:'var(--color-text-tertiary)',marginTop:3}}>
                      {(item.totalCost/runTotal*100).toFixed(1)}% of total spend
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Bottom nav (5 tabs) ── */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,
        background:'var(--color-background-primary)',
        borderTop:'0.5px solid var(--color-border-tertiary)',
        display:'flex',padding:'8px 0 10px'}}>
        {[
          {id:'add',     icon:'＋', label:'Add Lot' },
          {id:'lists',   icon:'☰',  label:'My Lists'},
          {id:'reports', icon:'≡',  label:'Reports' },
          {id:'export',  icon:'⎙',  label:'Print'   },
          {id:'db',      icon:'⊞',  label:'Items'   },
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              background:'none',border:'none',cursor:'pointer',
              padding:'4px 0',fontFamily:'var(--font-sans)'}}>
            <span style={{fontSize:20,lineHeight:1,
              color:tab===t.id?'#1D9E75':'var(--color-text-tertiary)'}}>
              {t.icon}
            </span>
            <span style={{fontSize:9,
              color:tab===t.id?'#1D9E75':'var(--color-text-tertiary)',
              fontWeight:tab===t.id?600:400}}>
              {t.label}
            </span>
            {tab===t.id && <div style={{width:4,height:4,borderRadius:'50%',background:'#1D9E75'}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}
