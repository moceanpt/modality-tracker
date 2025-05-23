/* pages/index.tsx – queue-level MT / OP / Manual */

import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import DurationPicker from '../components/DurationPicker';

/* ─── socket & API ─── */
const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3002');
const API    =       process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3002';

/* ─── helpers ─── */
const pad = (n: number) => n.toString().padStart(2, '0');
const pretty = (s: number) => `${pad((s / 60) | 0)}:${pad(s % 60)} left`;

/* ─── types ─── */
type Cell = {
  type: 'MT' | 'OP';
  startAt: string;
  duration: number;
  clientName: string;
  left?: number;
  done?: boolean;
};
type Map = Record<string, Record<number, Cell | undefined>>;
type PlanStep = { modality: string; status: 'PENDING' | 'ACTIVE' | 'DONE'; left?: number };
type PlanClient = { id: string; name: string; steps: PlanStep[] };

/* ─── static layout ─── */
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
export default function Board() {
  /* board state */
  const [data, setData] = useState<Map>({});
  const [pick, setPick] = useState<{ c: string; i: number } | null>(null);
  const [manual, setManual] = useState<{ c: string; i: number; cid: string } | null>(null);

  /* plan list */
  const [clients, setClients] = useState<PlanClient[]>([]);

  /* intake form */
  const [showIntake, setShowIntake] = useState(false);
  const [first, setFirst] = useState('');
  const [opts, setOpts] = useState<string[]>([]);

   /* toast */
  const [err, setErr] = useState<string | null>(null);
  
  const firstRef = useRef<HTMLInputElement>(null);

  /* ─── socket lifecycle ─── */
useEffect(() => {
  
  /** when either modal is up we must not mutate data-state ➜ keeps input focused */
  const modalOpen = () => showIntake || manual;

  /* -------- helper wrappers to skip updates while typing -------- */
  const safeSetData = (fn: (p: Map) => Map) => {
    if (!modalOpen()) setData(fn);
  };
  const safeSetClients = (fn: (p: PlanClient[]) => PlanClient[]) => {
    if (!modalOpen()) setClients(fn);
  };

  /* ---- register listeners ---- */
  socket.on('station:update', ({ category, index, data }: any) => {
    safeSetData(p => ({
      ...p,
      [category]: { ...(p[category] ?? {}), [index]: data },
    }));
  });

  socket.on('station:batch', (map: Map) => safeSetData(() => map));

  socket.on('plan:list',   (all: PlanClient[]) => safeSetClients(() => all));

  socket.on('plan:update', (one: PlanClient) =>
    safeSetClients(p => p.map(c => (c.id === one.id ? one : c))),
  );

  socket.on('plan:remove', ({ clientId }: { clientId: string }) =>
    safeSetClients(p => p.filter(c => c.id !== clientId)),
  );

  socket.emit('init');

  /* ---- cleanup ---- */
  return () => {
    socket.off('station:update');
    socket.off('station:batch');
    socket.off('plan:list');
    socket.off('plan:update');
    socket.off('plan:remove');
  };
/* 👇 re-run listeners whenever a modal opens/closes so modalOpen() stays fresh */
}, [showIntake, manual]);

/* ─── focus the first-name box when the intake modal opens ─── */
useEffect(() => {
  if (showIntake) {
    // wait one tick so the DOM element exists, then focus it
    setTimeout(() => firstRef.current?.focus(), 0);
  }
}, [showIntake]);

/* ─── 1-second timers ─── */
useEffect(() => {
  const id = setInterval(() => {
    // ⏸  Don’t mutate state while a text-field is active
    if (showIntake || manual) return;

    const now = Date.now();

    /* board countdowns --------------------------------------------------- */
    setData(prev => {
      const clone: Map = JSON.parse(JSON.stringify(prev));
      for (const cat in clone)
        for (const idx in clone[cat]) {
          const cell = clone[cat][+idx];
          if (!cell || cell.done) continue;

          const left =
            cell.duration - ((now - +new Date(cell.startAt)) / 1000) | 0;

          if (left <= 0) {
            cell.left = 0;
            cell.done = true;
          } else {
            cell.left = left;
          }
        }
      return clone;
    });

    /* plan countdowns ---------------------------------------------------- */
    setClients(prev =>
      prev.map(cl => ({
        ...cl,
        steps: cl.steps.map(s => {
          if (s.status === 'ACTIVE' && s.left !== undefined) {
            const l = Math.max(s.left - 1, 0);
            return { ...s, left: l, status: l === 0 ? 'DONE' : s.status };
          }
          return s;
        }),
      })),
    );
  }, 1000);

  return () => clearInterval(id);
}, [showIntake, manual]);

  /* ─── derived helpers ─── */
  const queueFor = (mod: string) =>
    clients.filter((c) => c.steps.some((s) => s.status === 'PENDING' && s.modality === mod));

  const clientBusy = (cid: string) =>
    clients.some((cl) => cl.id === cid && cl.steps.some((s) => s.status === 'ACTIVE'));

  const firstWaitingClientId = (mod: string) => queueFor(mod)[0]?.id;

  /* ─── socket emits ─── */
const start = (
  c: string,
  i: number,
  t: 'MT' | 'OP',
  clientId?: string,
  seconds?: number,
) => {
  /* 1 ▸ tell the server to start the session */
  socket.emit(
    'optim:start',
    {
      category: c,
      index:    i,
      type:     t,
      clientId,
      ...(seconds ? { durationSec: seconds } : {}),
    },
    (ack: any) => {
      if (!ack?.ok) setErr(ack.msg || 'Failed');
    },
  );

  /* 2 ▸ optimistic paint so the cell appears immediately */
  if (seconds) {
    const clientName =
      clients.find(cl => cl.id === clientId)?.name ?? '—';

    const optimistic: Cell = {
      type:      t,
      startAt:   new Date().toISOString(),
      duration:  seconds,
      clientName,
      left:      seconds,
      done:      false,
    };

    setData(prev => ({
      ...prev,
      [c]: { ...(prev[c] ?? {}), [i]: optimistic },
    }));
  }

  /* 3 ▸ close the picker */
  setPick(null);
};

  const stopAck = (c: string, i: number) => socket.emit('session:stop', { category: c, index: i });
  const terminate = (id: string) => socket.emit('plan:terminate', { clientId: id });

  /* ─── intake submit ─── */
  const disabled = !first.trim() || opts.length === 0;
  async function submitPlan() {
    // ➊ upsert client
    const { clientId } = await fetch(`${API}/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: first.trim(), lastInitial: '' }),
    }).then((r) => r.json());

    // ➋ create today’s plan (no mode)
    await fetch(`${API}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, optimizations: opts }),
    });

    setShowIntake(false);
    setFirst('');
    setOpts([]);
  }

  /* ─── render helpers ─── */
const cell = (c: string, i: number) => {
  const st        = data[c]?.[i];
  const busy      = !!st;
  const done      = busy && st!.done;
  const critical  = busy && !done && (st!.left ?? 0) < 60;   // <-- under 60 s


  let bg = 'bg-white hover:bg-sky-50';
  if (busy && !done)
    bg = st!.type === 'MT' ? 'bg-orange-500 text-white' : 'bg-indigo-600 text-white';
  if (done) bg = 'bg-red-600 text-white';


  return (
    <div key={i} className="relative">
      <button
        disabled={busy && !done}
        onClick={() => !busy && setPick({ c, i })}
        /* ⬇ add the conditional class */
        className={`w-40 h-20 border rounded flex flex-col items-center justify-center transition-colors ${bg} ${critical ? 'blink-last-minute' : ''}`}
      >
        {busy ? (
          <>
            <span className="text-xs font-semibold">{st!.clientName}</span>
            <span className="text-xs">{pretty(st!.left ?? st!.duration)}</span>
          </>
        ) : (
          <>
            <span className="font-semibold">Table {i + 1}</span>
            <span className="text-xs text-gray-400">Available</span>
          </>
        )}
        {done && <span className="text-sm font-semibold">DONE</span>}
      </button>

      {busy && (
        <button
          onClick={() => stopAck(c, i)}
          className="absolute -top-2 -right-2 bg-red-700 text-white w-6 h-6 rounded-full"
        >
          ×
        </button>
      )}
    </div>
  );
};

  /* ═══ UI ═══ */
  return (
    <>
      <div className="flex flex-col ipad:flex-row h-screen">
        {/* main grid */}
        <main className="flex-1 h-dvh overflow-y-auto overscroll-contain p-4 ipad:p-6">
          <div className="space-y-8">
            <header className="flex items-center justify-between">
              <h1 className="flex-1 text-center text-2xl font-bold">MOCEAN · Optimization Monitor</h1>
              <button
                onClick={() => setShowIntake(true)}
                className="px-4 py-1 bg-emerald-600 text-white rounded"
              >
                ＋ Client
              </button>
            </header>

            {/* optimisation grid */}
            {LAYOUT.map(({ category, count }) => (
              <section key={category} className="space-y-2 with-divider">
                <h2 className="font-semibold">{category}</h2>
                <div className="flex flex-wrap gap-4">
                  {Array.from({ length: count }).map((_, idx) => cell(category, idx))}
                </div>
              </section>
            ))}
          </div>
        </main>

        {/* side panel */}
        <aside className="shrink-0 h-[45vh] ipad:h-screen overflow-y-auto border-t ipad:border-t-0 ipad:border-l w-full xs:w-[220px] sm:w-[240px] ipad:w-[260px] lg:w-[300px] p-3 space-y-4">
          {clients.map((c) => (
            <ClientCard key={c.id} c={c} dataMap={data} onX={() => terminate(c.id)} />
          ))}
        </aside>
      </div>

      {/* table-picker modal */}
      {pick && (
        <Backdrop onClose={() => setPick(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold">Waiting list:</h3>
            <ul className="space-y-1 max-h-56 overflow-y-auto">
              {queueFor(pick.c).map((q) => (
                <li key={q.id} className="flex gap-2 items-center">
                  <span className="flex-1">{q.name}</span>
                  <button
                    disabled={clientBusy(q.id)}
                    onClick={() => start(pick.c, pick.i, 'MT', q.id)}
                    className="px-2 py-1 rounded bg-orange-500 text-white text-xs disabled:opacity-40"
                  >
                    MT
                  </button>
                  <button
                    disabled={clientBusy(q.id)}
                    onClick={() => start(pick.c, pick.i, 'OP', q.id)}
                    className="px-2 py-1 rounded bg-indigo-600 text-white text-xs disabled:opacity-40"
                  >
                    OP
                  </button>
                  <ManualBtn cid={q.id} />
                </li>
              ))}
            </ul>
          </div>
        </Backdrop>
      )}

      {/* intake modal */}
      {showIntake && (
        <Backdrop onClose={() => setShowIntake(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg p-6 w-[28rem] space-y-4 relative"
          >
            <button
              onClick={() => setShowIntake(false)}
              className="absolute top-2 right-3 text-2xl"
            >
              ×
            </button>
            <h2 className="text-lg font-bold">New Client Plan</h2>

            <input
              ref={firstRef}
              autoFocus 
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="w-full border p-2 rounded bg-white"
              placeholder="First name"
            />

            <div className="flex flex-wrap gap-3 text-sm">
              {OPT_LIST.map((opt) => (
                <label key={opt} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={opts.includes(opt)}
                    onChange={(e) =>
                      setOpts((p) => (e.target.checked ? [...p, opt] : p.filter((x) => x !== opt)))
                    }
                  />
                  {opt}
                </label>
              ))}
            </div>

            <button
              disabled={disabled}
              onClick={submitPlan}
              className={`w-full py-2 rounded text-white ${
                disabled ? 'bg-emerald-400 opacity-50' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              Create Plan
            </button>
          </div>
        </Backdrop>
      )}

{/* ──────────────────────────────────────────────
        manual-timer modal  ← add this whole block
        ────────────────────────────────────────────── */}
    {manual && (
  <Backdrop onClose={() => setManual(null)}>
    <div
      onClick={e => e.stopPropagation()}
      className="relative bg-white rounded-lg p-6 space-y-4"
    >
      {/* close (×) */}
      <button
        onClick={() => setManual(null)}
        className="absolute top-2 right-3 text-xl leading-none"
      >
        ×
      </button>

      <h3 className="font-semibold text-sm">Custom minutes</h3>

      <DurationPicker
        defaultMin={10}
        onChange={sec => {
          // treat manual as MT (change to 'OP' if needed)
          start(manual.c, manual.i, 'MT', manual.cid, sec);
          setManual(null);
        }}
      />
    </div>
      </Backdrop>
 )}

     {/* toast */}

      {err && <Toast msg={err} />}
    </>
  );

  /* ─── helper components ─── */

/* ————— global Backdrop ————— */
function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

/* Manual trigger button -------------------------------------------- */
function ManualBtn({ cid }: { cid: string }) {
  return (
    <button
      disabled={clientBusy(cid)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pick) setManual({ ...pick, cid });   // remember table + client
      }}
      className="px-2 py-1 rounded border text-xs disabled:opacity-40"
    >
      Manual
    </button>
  );
}
}

/* tiny Toast -------------------------------------------------------- */
function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-4 left-4 bg-red-500 text-white p-3 rounded">
      {msg}
    </div>
  );
}

/* Client card in sidebar ------------------------------------------- */
function ClientCard({
  c,
  dataMap,
  onX,
}: {
  c: PlanClient;
  dataMap: Map;
  onX: () => void;
}) {
  const hdr =
    c.steps.every((s) => s.status === 'DONE')
      ? 'bg-emerald-600'
      : c.steps.some((s) => s.status === 'ACTIVE')
      ? 'bg-orange-500'
      : 'bg-slate-500';

  return (
    <div className="border rounded shadow text-xs">
      <div
        className={`px-2 py-1 text-white font-semibold flex justify-between items-center ${hdr}`}
      >
        {c.name}
        <button onClick={onX} className="text-lg leading-none">
          ×
        </button>
      </div>
      <ul className="bg-white divide-y">
        {c.steps.map((s) => {
          const avail = LAYOUT.find((l) => l.category === s.modality)?.count ?? 0;
          const busy = Object.values(dataMap[s.modality] ?? {}).filter(Boolean).length;
          const free = avail - busy;
          return (
            <li
              key={s.modality}
              className={`flex justify-between px-2 py-1 ${
                s.status === 'ACTIVE'
                  ? 'bg-orange-50'
                  : s.status === 'DONE'
                  ? 'bg-emerald-50'
                  : ''
              }`}
            >
              <span className={s.status === 'ACTIVE' ? 'font-semibold' : ''}>
                {s.modality}
                {s.status !== 'DONE' && free !== avail && ` (${free})`}
              </span>
              <span>
                {s.status === 'PENDING' && '•'}
                {s.status === 'ACTIVE' && `⏳ ${pretty(s.left ?? 0)}`}
                {s.status === 'DONE' && '✅'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

