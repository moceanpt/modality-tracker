/* pages/index.tsx – queue-level MT / OP / Manual */

import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { io } from 'socket.io-client';
import DurationPicker from '../components/DurationPicker';
import ClientCard             from '../components/ClientCard';
import { PlanClient, Map }    from '../types';
import Link from 'next/link';
import BoardView from '../components/BoardView';
import { API } from '../src/lib/constants';

/* ─── socket ─── */
const socket = io(API);

// one source of truth
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

/* ─── static layout ─── */
const LAYOUT = [
 /* row 1 */
 { category: 'CIRCULATION (BACK)',  count: 4 },
 { category: 'CIRCULATION (FRONT)', count: 3 },
 { category: 'PHYSICAL',            count: 3 },

 /* row 2 */
 { category: 'CELL',                count: 2 },
 { category: 'ENERGY',              count: 3 },
 { category: 'BRAIN',               count: 4 },

 /* row 3 */
 { category: 'GUT (LASER)',         count: 2 },
 { category: 'GUT (EMS)',           count: 2 },
 { category: 'STRESS',              count: 2 },

 /* row 4 */
 { category: 'INFRARED SAUNA',      count: 3 },
 { category: 'CRYO',                count: 1 },
 { category: 'HBOT',                count: 1 },

];
const OPT_LIST = [
  'CIRCULATION (BACK)',  // row 1
  'CIRCULATION (FRONT)',
  'PHYSICAL',

  'CELL',                // row 2
  'ENERGY',
  'BRAIN',

  'GUT (LASER)',         // row 3
  'GUT (EMS)',
  'STRESS',

  'INFRARED SAUNA',      // row 4
  'CRYO',
  'HBOT',
];

const DEFAULT_MIN: Record<
  string,
  { MT: number; OP: number }
> = {
  // “one-off” modalities first …
  'CRYO':             { MT: 3,  OP: 3  },
  'INFRARED SAUNA':   { MT: 30, OP: 55 },
  'HBOT':             { MT: 30, OP: 55 },
  'CELL':             { MT: 15, OP: 15 },

  // everything else uses the common rule MT 15 / OP 30
  'CIRCULATION (BACK)':  { MT: 15, OP: 30 },
  'CIRCULATION (FRONT)': { MT: 15, OP: 30 },
  'PHYSICAL':            { MT: 15, OP: 30 },
  'ENERGY':              { MT: 15, OP: 30 },
  'BRAIN':               { MT: 15, OP: 30 },
  'GUT (LASER)':         { MT: 15, OP: 30 },
  'GUT (EMS)':           { MT: 15, OP: 30 },
  'STRESS':              { MT: 15, OP: 30 },
};

/* ═════════ component ═════════ */
export default function Board() {
/* ① mount-gate (declare first) */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);   // always runs
 
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

  const isDesktop = useIsDesktop(); 

  /* ─── socket lifecycle ─── */
useEffect(() => {

  
  /** when either modal is up we must not mutate data-state ➜ keeps input focused */
  const modalOpen = () => showIntake || manual;

  /* -------- helper wrappers to skip updates while typing -------- */
 

  /* ---- register listeners ---- */
  socket.on('station:update', ({ category, index, data }: any) => {
      setData(p => ({                           // ← just use the plain setter
        ...p,
        [category]: { ...(p[category] ?? {}), [index]: data },
      }));
    });

    socket.on('station:batch', (map: Map) => setData(() => map));

    socket.on('plan:list',   (all: PlanClient[]) => setClients(() => all));

    socket.on('plan:update', (one: PlanClient | null) => {
        if (!one?.id) return;                       // ignore bogus payloads
        setClients(p => p.map(c => (c.id === one.id ? one : c)));
      });

      socket.on('plan:remove', ({ clientId }: { clientId: string }) =>
          setClients(p => p.filter(c => c.id !== clientId)),
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

if (!mounted) return null;

  /* ─── derived helpers ─── */
  const queueFor = (mod: string) =>
    clients.filter(c =>
      c.steps.some(s => s.modality === mod && s.status !== 'DONE')
    );

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
  const secs = seconds ?? (DEFAULT_MIN[c]?.[t] ?? 15) * 60;

  /* 1 ▸ tell the server to start the session */
  socket.emit(
    'optim:start',
    {
      category: c,
      index:    i,
      type:     t,
      clientId,
      durationSec: secs,
    },
    (ack: any) => {
      if (!ack?.ok) setErr(ack.msg || 'Failed');
    },
  );

  /* 2 ▸ optimistic paint so the cell appears immediately */
  if (secs) {  
    const clientName =
      clients.find(cl => cl.id === clientId)?.name ?? '—';

    const optimistic: Cell = {
      type:      t,
      startAt:   new Date().toISOString(),
      duration:  secs,
      clientName,
      left:      secs,
      done:      false,
    };

    setData(prev => ({
      ...prev,
      [c]: { ...(prev[c] ?? {}), [i]: optimistic },
    }));
    setClients(prev =>
      prev.map(cl =>
        cl.id !== clientId
          ? cl
          : {
              ...cl,
              steps: cl.steps.map(s =>
                /* match step by modality name */
                s.modality === c
                  ? { ...s, status: 'ACTIVE', left: secs }
                  : s
              ),
            }
      )
    );

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
      body: JSON.stringify({ clientId, optimizations: opts, mode: 'UNSPEC' }),
    });

    setShowIntake(false);
    setFirst('');
    setOpts([]);
  }

  /* ─── render helpers ─── */
const cell = (c: string, i: number) => {
  const st        = data[c]?.[i];
  const done      = !!st && st.done;
  const busy      = !!st && !done;
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
        /* ⬇ conditional colours */
        className={`w-full sm:w-40 h-16 sm:h-20 border rounded flex flex-col
                    items-center justify-center transition-colors
                    ${bg} ${critical ? 'blink-last-minute' : ''}`}
      > {/*  <<< THIS is the missing character  */}
  
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
  
      {st && (
        <button
          onClick={() => stopAck(c, i)}
          className="absolute -top-2 -right-2 bg-red-700 text-white w-6 h-6 rounded-full"
        >
          ×
        </button>
      )}
    </div>
  );
}

function useStickyState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [state, _setState] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initial;
    } catch {
      /* SSR or private-mode fallback */
      return initial;
    }
  });

  const setState = (v: T) => {
    _setState(v);
    try { sessionStorage.setItem(key, JSON.stringify(v)); } catch {}
  };

  return [state, setState];
}

//horizontal & phonepager deleteed here, if something dont workout put it back here //


 /* ═══ UI ═══ */
return (
  <>
    {/* ───────── phone (< 640 px) ───────── */}
    {!isDesktop && (   
    <div>
    <BoardView
    layout={LAYOUT}
    cell={cell}
    onNewClient={() => setShowIntake(true)}
  />
    </div>
)}
    {/* ───────── tablet / desktop (≥ 640 px) ───────── */}
    <div className="hidden sm:block">
      <div className="flex h-screen">
        {/* ▸ BOARD ───────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6">
          <div
            className="
              space-y-8 lg:space-y-0
              lg:grid lg:grid-cols-3
              auto-rows-min
              gap-x-8 gap-y-6
            "
          >
            {/* header ─ spans all three columns */}
            <header className="flex items-center justify-between lg:col-span-3">
              <h1 className="flex-1 text-center text-2xl font-bold">
                MOCEAN · Optimization Monitor
              </h1>
              <button
                onClick={() => setShowIntake(true)}
                className="px-4 py-1 bg-emerald-600 text-white rounded"
              >
                ＋ Client
              </button>
            </header>

            {/* optimisation blocks */}
            {LAYOUT.map(({ category, count }) => (
              <section key={category} className="space-y-2 with-divider">
                <h2 className="font-semibold">{category}</h2>

                {/* 2-col mini grid (2 × 2 fits 4 tables) */}
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: count }).map((_, idx) =>
                    cell(category, idx)
                  )}
                </div>
              </section>
            ))}
          </div>
        </main>

        {/* ▸ SIDEBAR ─────────────────────────────────── */}
        <aside
          className="
            flex-none w-fit max-w-[260px]
            lg:h-screen lg:border-l
            overflow-y-auto p-3 space-y-4
          "
        >
          {clients.map(c => (
            <ClientCard
              key={c.id}
              c={c}
              dataMap={data}
              onX={() => terminate(c.id)}
            />
          ))}
        </aside>
      </div>
    </div>

    {/* ────────────── modals & toast ────────────── */}

    {/* table-picker modal */}
    {pick && (
      <Backdrop onClose={() => setPick(null)}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-lg p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold">Waiting list:</h3>
          <ul className="space-y-1 max-h-56 overflow-y-auto">
            {queueFor(pick.c).map((q) => (
              <li
                      key={q.id}
                      className={
                        'flex gap-2 items-center ' +
                        (clientBusy(q.id) ? 'opacity-40 cursor-not-allowed pointer-events-none' : '')
                      }
                    >
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

<div className="grid grid-cols-3 gap-3 text-sm">
  {OPT_LIST.map(opt => (
    <label
      key={opt}
      className="flex items-center gap-1 
                 whitespace-normal break-words 
                 leading-tight text-xs max-w-[7rem]"
    >
      <input
        type="checkbox"
        checked={opts.includes(opt)}
        onChange={e =>
          setOpts(p =>
            e.target.checked ? [...p, opt] : p.filter(x => x !== opt)
          )
        }
      />
      {opt}
    </label>
  ))}
</div>      

          <button
            disabled={!first.trim() || opts.length === 0}
            onClick={submitPlan}
            className={`w-full py-2 rounded text-white ${
              !first.trim() || opts.length === 0
                ? 'bg-emerald-400 opacity-50'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            Create Plan
          </button>
        </div>
      </Backdrop>
    )}

    {/* manual-timer modal */}
    {manual && (
      <Backdrop onClose={() => setManual(null)}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-lg p-6 space-y-4"
        >
          <button
            onClick={() => setManual(null)}
            className="absolute top-2 right-3 text-xl leading-none"
          >
            ×
          </button>
          <h3 className="font-semibold text-sm">Custom minutes</h3>
          <DurationPicker
            defaultMin={10}
            onChange={(sec) => {
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

/* helper – true when viewport ≥ 640 px (Tailwind “sm”) */
function useIsDesktop() {
  const [desk, setDesk] = useState(
    () =>
      typeof window === 'undefined'
        ? false
        : window.matchMedia('(min-width: 640px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const cb = (e: MediaQueryListEvent) => setDesk(e.matches);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, []);

  return desk;
}


/* ——— quick inline toast ——— */
function Toast({ msg }: { msg: string }) {
  return (
    <div
      className="
        fixed bottom-4 left-1/2 -translate-x-1/2
        px-4 py-2 rounded shadow-lg
        bg-red-600 text-white text-sm
        animate-fade-in-out            /* optional little fade */
        z-[60]
      "
    >
      {msg}
    </div>
  );
}

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



