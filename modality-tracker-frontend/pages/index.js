"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Board;
/* pages/index.tsx – Phase-1 (A–D) */
const react_1 = require("react");
const socket_io_client_1 = require("socket.io-client");
/* socket */
const socket = (0, socket_io_client_1.io)('http://localhost:3002', { transports: ['websocket'] });
/* helpers */
const pad = (n) => n.toString().padStart(2, '0');
const pretty = (s) => `${pad((s / 60) | 0)}:${pad(s % 60)} left`;
/* ───────── static data ───────── */
const LAYOUT = [
    { category: 'CIRCULATION (BACK)', count: 4 },
    { category: 'CIRCULATION (FRONT)', count: 3 },
    { category: 'BRAIN', count: 4 },
    { category: 'ENERGY', count: 3 },
    { category: 'CELL', count: 2 },
    { category: 'PHYSICAL', count: 3 },
    { category: 'GUT (EMS)', count: 2 },
    { category: 'GUT (LASER)', count: 2 },
    { category: 'STRESS', count: 2 },
];
const OPT_LIST = [
    'PHYSICAL',
    'GUT (LASER)',
    'GUT (EMS)',
    'STRESS',
    'CIRCULATION (BACK)',
    'CIRCULATION (FRONT)',
    'ENERGY',
    'CELL',
    'BRAIN',
];
/* ═════════ component ═════════ */
function Board() {
    /* board */
    const [data, setData] = (0, react_1.useState)({});
    const [pick, setPick] = (0, react_1.useState)(null);
    /* plan list */
    const [clients, setClients] = (0, react_1.useState)([]);
    /* intake */
    const [showIntake, setShowIntake] = (0, react_1.useState)(false);
    const [first, setFirst] = (0, react_1.useState)('');
    const [lastI, setLastI] = (0, react_1.useState)('');
    const [opts, setOpts] = (0, react_1.useState)([]);
    const [mode, setMode] = (0, react_1.useState)('MT');
    /* toast */
    const [err, setErr] = (0, react_1.useState)(null);
    /* ─── socket lifecycle ─── */
    (0, react_1.useEffect)(() => {
        socket.on('station:update', ({ category, index, data }) => setData(p => ({ ...p, [category]: { ...(p[category] ?? {}), [index]: data } })));
        socket.on('plan:list', (all) => setClients(all));
        socket.on('station:batch', (map) => setData(map));
        socket.on('plan:update', (one) => setClients(p => p.map(c => c.id === one.id ? one : c)));
        socket.on('plan:remove', ({ clientId }) => setClients(p => p.filter(c => c.id !== clientId)));
        socket.emit('init');
        return () => socket.disconnect();
    }, []);
    /* ─── 1-sec tick ─── */
    (0, react_1.useEffect)(() => {
        const id = setInterval(() => {
            const now = Date.now();
            /* board timers */
            setData(prev => {
                const clone = JSON.parse(JSON.stringify(prev));
                for (const cat in clone)
                    for (const idx in clone[cat]) {
                        const cell = clone[cat][+idx];
                        if (!cell || cell.done)
                            continue;
                        const left = cell.duration - ((now - new Date(cell.startAt).getTime()) / 1000 | 0);
                        if (left <= 0) {
                            cell.left = 0;
                            cell.done = true;
                        }
                        else
                            cell.left = left;
                    }
                return clone;
            });
            /* plan timers */
            setClients(prev => prev.map(cl => ({
                ...cl, steps: cl.steps.map(s => {
                    if (s.status === 'ACTIVE' && s.left !== undefined) {
                        const l = Math.max(s.left - 1, 0);
                        return { ...s, left: l, status: l === 0 ? 'DONE' : s.status };
                    }
                    return s;
                })
            })));
        }, 1000);
        return () => clearInterval(id);
    }, []);
    /* ─── derived helpers ─── */
    // 1) anyone still waiting for <mod>
    const queueFor = (mod) => clients.filter(c => c.steps.some(s => s.status === 'PENDING' && s.modality === mod));
    // 2) is that client already ACTIVE on some station?
    const clientBusy = (cid) => clients.some(cl => cl.id === cid &&
        cl.steps.some(s => s.status === 'ACTIVE'));
    // 3) first waiting client whose mode is compatible with the desired type
    const firstWaitingClientId = (mod, want) => {
        const queued = queueFor(mod).find(q => q.mode === 'UNSPEC' || q.mode === want);
        return queued?.id; // might be undefined
    };
    /* ─── emits ─── */
    const start = (c, i, t, clientId) => {
        socket.emit('optim:start', { category: c, index: i, type: t, clientId }, (ack) => {
            if (!ack?.ok)
                setErr(ack.msg || 'Failed');
        });
        setPick(null);
    };
    const stopAck = (c, i) => socket.emit('session:stop', { category: c, index: i });
    const terminate = (id) => socket.emit('plan:terminate', { clientId: id });
    /* ─── render helpers ─── */
    const cell = (c, i) => {
        const st = data[c]?.[i];
        const busy = !!st;
        const done = busy && st.done;
        let bg = 'bg-white hover:bg-sky-50';
        if (busy && !done)
            bg = st.type === 'MT' ? 'bg-orange-500 text-white' : 'bg-indigo-600 text-white';
        if (done)
            bg = 'bg-red-600 text-white';
        return (<div key={i} className="relative">
        <button disabled={busy && !done} onClick={() => !busy && setPick({ c, i })} className={`w-40 h-20 border rounded flex flex-col items-center justify-center transition-colors ${bg}`}>
          {busy
                ? (<>
                <span className="text-xs font-semibold">{st.clientName}</span>
                <span className="text-xs">{pretty(st.left ?? st.duration)}</span>
              </>)
                : (<>
                <span className="font-semibold">Table {i + 1}</span>
                <span className="text-xs text-gray-400">Available</span>
              </>)}
          {done && <span className="text-sm font-semibold">DONE</span>}
        </button>
        {busy && <button onClick={() => stopAck(c, i)} className="absolute -top-2 -right-2 bg-red-700 text-white w-6 h-6 rounded-full">×</button>}
      </div>);
    };
    /* ─── intake helpers ─── */
    const disabled = !first.trim() || opts.length === 0;
    async function submitPlan() {
        // ➊ create / upsert client (lastInitial = '')
        const { clientId } = await fetch('http://localhost:3002/client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: first.trim(), lastInitial: '' })
        }).then(r => r.json());
        // ➋ create today’s plan
        await fetch('http://localhost:3002/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, optimizations: opts, mode })
        });
        // reset
        setShowIntake(false);
        setFirst('');
        setOpts([]);
        setMode('MT');
    }
    /* ═══ render ═══ */
    return (<>
      <div className="flex flex-col ipad:flex-row h-screen">

    {/* ───────────────── main grid ───────────────── */}
    <main className="flex-1 overflow-y-auto p-4 ipad:p-6">
    <div className="space-y-8">
  {/* ---- header ---- */}
  <header className="flex items-center justify-between">
    <h1 className="flex-1 text-center text-2xl font-bold">
      MOCEAN · Optimization Monitor
    </h1>
    <button onClick={() => setShowIntake(true)} className="px-4 py-1 bg-emerald-600 text-white rounded">
      ＋ Client
    </button>
  </header>

  {/* ---- optimisation grid ---- */}
  {LAYOUT.map(({ category, count }) => (<section key={category} className="space-y-2">
      <h2 className="font-semibold">{category}</h2>
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: count }).map((_, idx) => cell(category, idx))}
      </div>
    </section>))}
    </div>
    </main>

    {/* ───────────────── side-panel ───────────────── */}
    <aside className="shrink-0 h-[45vh] ipad:h-screen overflow-y-auto border-t ipad:border-t-0 ipad:border-l
             w-full xs:w-[220px] sm:w-[240px] ipad:w-[260px] lg:w-[300px] p-3 space-y-4">
  {clients.map(c => (<ClientCard key={c.id} c={c} dataMap={data} onX={() => terminate(c.id)}/>))}
    </aside>

    </div>

      {/* MT/OP + queue modal */}
      {pick && <Backdrop onClose={() => setPick(null)}>
        <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg p-6 space-y-4">
          <div className="flex gap-4 justify-center">
            {/* MT button */}
  <Btn col="orange" txt="MT" on={() => {
                const cid = firstWaitingClientId(pick.c, 'MT');
                start(pick.c, pick.i, 'MT', cid); // cid may be undefined
            }}/>

  {/* OP button */}
  <Btn col="indigo" txt="OP" on={() => {
                const cid = firstWaitingClientId(pick.c, 'OP');
                start(pick.c, pick.i, 'OP', cid);
            }}/>
          </div>

          {/* queue list */}
          <h3 className="text-sm font-semibold mt-4 mb-1">Waiting list:</h3>
          <ul className="space-y-1 max-h-56 overflow-y-auto">
  {queueFor(pick.c).map(q => (<li key={q.id}>
      <button disabled={clientBusy(q.id)} // <-- NEW: prevent double-booking
             onClick={() => start(pick.c, pick.i, q.mode === 'UNSPEC' ? 'MT' : q.mode, // UNSPEC → MT, else keep real mode
                q.id)} className={`w-full flex justify-between px-2 py-1 border rounded
              ${clientBusy(q.id)
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-sky-50'}`}>
        <span>{q.name}</span>
        <span className={q.mode === 'MT'
                    ? 'text-orange-600'
                    : q.mode === 'OP'
                        ? 'text-indigo-600'
                        : 'text-gray-400'}>
          {q.mode}
        </span>
      </button>
    </li>))}
        </ul>
        </div>
      </Backdrop>}

      {/* intake modal */}
      {showIntake && <Backdrop onClose={() => setShowIntake(false)}>
        <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg p-6 w-[28rem] space-y-4 relative">
          <button onClick={() => setShowIntake(false)} className="absolute top-2 right-3 text-2xl">×</button>
          <h2 className="text-lg font-bold">New Client Plan</h2>

          <input value={first} onChange={e => setFirst(e.target.value)} className="w-full border p-2 rounded bg-white" placeholder="First name"/>
          

          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-1">
              <input type="radio" name="mode" checked={mode === 'MT'} onChange={() => setMode('MT')}/> MT
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="mode" checked={mode === 'OP'} onChange={() => setMode('OP')}/> OP
            </label>
            
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            {OPT_LIST.map(opt => (<label key={opt} className="flex items-center gap-1">
                <input type="checkbox" checked={opts.includes(opt)} onChange={e => setOpts(p => e.target.checked ? [...p, opt] : p.filter(x => x !== opt))}/>
                {opt}
              </label>))}
          </div>

          <button disabled={disabled} onClick={submitPlan} className={`w-full py-2 rounded text-white ${disabled ? 'bg-emerald-400 opacity-50' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            Create Plan
          </button>
        </div>
      </Backdrop>}

      {err && <Toast msg={err}/>}
    </>);
}
/* helper components */
function Backdrop({ children, onClose }) {
    return (<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>{children}</div>);
}
function Btn({ col, txt, on }) {
    const clr = {
        orange: 'bg-orange-600 hover:bg-orange-700',
        indigo: 'bg-indigo-600 hover:bg-indigo-700',
    }[col];
    return (<button onClick={on} className={`px-8 py-4 ${clr} text-white rounded font-semibold`}>
      {txt}
    </button>);
}
function ClientCard({ c, dataMap, onX }) {
    const hdr = c.mode === 'MT' ? 'bg-orange-500'
        : c.mode === 'OP' ? 'bg-indigo-600'
            : c.steps.every(s => s.status === 'DONE') ? 'bg-emerald-600'
                : c.steps.some(s => s.status === 'ACTIVE') ? 'bg-orange-500'
                    : 'bg-slate-500';
    return (<div className="border rounded shadow text-xs">
      <div className={`px-2 py-1 text-white font-semibold flex justify-between items-center ${hdr}`}>
        {c.name}<button onClick={onX} className="text-lg leading-none">×</button>
      </div>
      <ul className="bg-white divide-y">
        {c.steps.map(s => {
            const avail = LAYOUT.find(l => l.category === s.modality)?.count ?? 0;
            const busy = Object.values(dataMap[s.modality] ?? {}).filter(x => x).length;
            const free = avail - busy;
            return (<li key={s.modality} className={`
    flex justify-between px-2 py-1
    ${s.status === 'ACTIVE' ? 'bg-orange-50' : ''}
    ${s.status === 'DONE' ? 'bg-emerald-50' : ''}
  `}>
            <span className={s.status === 'ACTIVE' ? 'font-semibold' : ''}>
            {s.modality}
            {/* show while PENDING **or** if someone else is occupying a table */}
            {(s.status !== 'DONE' && free !== avail) && ` (${free})`}
          </span>
         <span>
            {s.status === 'PENDING' && '•'}
            {s.status === 'ACTIVE' && `⏳ ${pretty(s.left ?? 0)}`}
            {s.status === 'DONE' && '✅'}
          </span>
            </li>);
        })}
      </ul>
    </div>);
}
function Toast({ msg }) { return (<div className="fixed bottom-4 left-4 bg-red-500 text-white p-3 rounded">{msg}</div>); }
