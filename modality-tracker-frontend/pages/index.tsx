/* pages/index.tsx – queue-level MT / OP / Manual */

import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import DurationPicker from '../components/DurationPicker';
import ClientCard             from '../components/ClientCard';
import { PlanClient, Map }    from '../types';
import Link from 'next/link';
import BoardView from '../components/BoardView';
import { API } from '../src/lib/constants';
import PlanEditorModal from '../components/PlanEditorModal';
import { KEY_TO_LABEL, LABEL_TO_KEY, OPT_LIST } from '../src/lib/constants';
import ModalPortal from '../components/ModalPortal';   

/* ─── socket ─── */
const socket = io(API);

// one source of truth
/* ─── helpers ─── */
const pad = (n: number) => n.toString().padStart(2, '0');
const pretty = (s: number) => `${pad((s / 60) | 0)}:${pad(s % 60)} left`;

/* ─── helper: hide keyboard unless the focused element is the name box ─── */
const blurIfNotNameInput = (skipEl?: HTMLElement | null) => {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === skipEl) return;                 // keep focus for name box
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.blur();
};




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

/** pastel backgrounds for each optimisation */
const CAT_BG: Record<string, string> = {
  'CIRCULATION (BACK)' : 'bg-rose-50',
  'CIRCULATION (FRONT)': 'bg-rose-50',
  PHYSICAL             : 'bg-orange-50',

  CELL                 : 'bg-teal-50',
  ENERGY               : 'bg-emerald-50',
  BRAIN                : 'bg-sky-50',

  'GUT (LASER)'        : 'bg-violet-50',
  'GUT (EMS)'          : 'bg-violet-50',
  STRESS               : 'bg-yellow-50',

  'INFRARED SAUNA'     : 'bg-amber-50',
  CRYO                 : 'bg-cyan-50',
  HBOT                 : 'bg-indigo-50',
};

const DEFAULT_MIN: Record<string, { MT: number; OP: number }> = {
  // regular 15/30 group
  'CIRCULATION (BACK)':  { MT: 15, OP: 30 },
  'CIRCULATION (FRONT)': { MT: 15, OP: 30 },
  'PHYSICAL':            { MT: 15, OP: 30 },
  'ENERGY':              { MT: 15, OP: 30 },
  'BRAIN':               { MT: 15, OP: 30 },
  'GUT (LASER)':         { MT: 15, OP: 30 },
  'GUT (EMS)':           { MT: 15, OP: 30 },
  'STRESS':              { MT: 15, OP: 30 },
  'CELL':           { MT: 15, OP: 15 },
  'CRYO':           { MT: 3,  OP: 3  },
  'INFRARED SAUNA': { MT: 30, OP: 55 },
  'HBOT':           { MT: 30, OP: 55 },
  
};

/* ═════════ component ═════════ */
export default function Board() {
  /* ---------- refs & helpers ---------- */
  const firstRef = useRef<HTMLInputElement>(null);
  const firstCache = useRef('');
  
  /** blur the on-screen keyboard unless the name box itself is focused */
  const blurKbBeforeCheckbox = () => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === firstRef.current) return;          // keep focus if name box
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.blur();
  };

  /* ---------- top-level state ---------- */

  /* ① mount-gate (declare first) */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* board state */
  const [data,    setData   ] = useState<Map>({});
  const [pick,    setPick   ] = useState<{ c: string; i: number } | null>(null);
  const [manual,  setManual ] = useState<{ c: string; i: number; cid: string; t: 'MT'|'OP'  } | null>(null);

  /* plan list */
  const [clients, setClients] = useState<PlanClient[]>([]);

  /* intake form ---------------------------------------------------- */
  const [showIntake, setShowIntake] = useState(false);
  const [first,      setFirst     ] = useState('');          // controlled text field
  const [opts,       setOpts      ] = useState<string[]>([]);

  /* enable / disable the Create-Plan button */
  const createDisabled = firstCache.current.trim() === '';

  /* ------------- misc modal state ------------- */
  const [noteView,   setNoteView  ] = useState<string | null>(null);
  const [editing,    setEditing   ] = useState<PlanClient | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<PlanClient | null>(null);

  /* ------------- misc refs & helpers ---------- */
  const noteRef   = useRef<HTMLTextAreaElement>(null);
  const noteCache = useRef('');           // keeps the textarea’s draft
  const isDesktop = useIsDesktop();       // viewport ≥ 640 px ?
  const [err, setErr] = useState<string | null>(null);   // toast

  
  /* ─── socket lifecycle ─── */
useEffect(() => {

  
  /** when either modal is up we must not mutate data-state ➜ keeps input focused */
  const modalOpen = () => showIntake || manual || editing || noteView;

  /* -------- helper wrappers to skip updates while typing -------- */
 

  /* ---- register listeners ---- */
  socket.on('station:update', ({ category, index, data }: any) => {
    // if (modalOpen()) return;    
    setData(p => ({                           // ← just use the plain setter
        ...p,
        [category]: { ...(p[category] ?? {}), [index]: data },
      }));
    });

    socket.on('station:batch', (map: Map) => {
      if (modalOpen()) return;                    // ⬅️
      setData(() => map);
    });
    
    socket.on('plan:list', (all: PlanClient[]) => {
      if (modalOpen()) return;                    // ⬅️
      setClients(() => all);
    });
    
    socket.on('plan:update', (fresh: PlanClient | null) => {
      if (modalOpen() || !fresh?.id) return;
    
      setClients(prev =>
        prev.map(client => {
          if (client.id !== fresh.id) return client;   // leave others
    
          const mergedSteps = fresh.steps.map(freshStep => {
            const oldStep = client.steps.find(
              s => s.modality === freshStep.modality,
            );
    
            /* keep our ticking countdown */
            if (
                            oldStep?.status   === 'ACTIVE' &&
                            freshStep.status  === 'ACTIVE' &&
                            oldStep.left      === freshStep.left   // 👈 same remaining sec?
                          ) {
                            return { ...freshStep, left: oldStep.left };
                          }
    
            /* for all non-ACTIVE rows just take the server version */
            return freshStep;
          });
    
          return { ...client, steps: mergedSteps };
        }),
      );
    });
    /* ⇡⇡⇡  end of replacement block  ⇡⇡⇡ */
    
    socket.on('plan:remove', ({ clientId }: { clientId: string }) => {
      if (modalOpen()) return;
      setClients(p => p.filter(c => c.id !== clientId));
    });
    
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
}, [showIntake, manual, editing, noteView]);

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
    if (showIntake || manual || editing || noteView) return;

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
}, [showIntake, manual, editing, noteView]);

if (!mounted) return null;

  /* ─── derived helpers ─── */
  const queueFor = (mod: string) =>
    clients.filter(c =>
      c.steps.some(s => s.modality === mod && s.status !== 'DONE')
    );

  const clientBusy = (cid: string) =>
    clients.some((cl) => cl.id === cid && cl.steps.some((s) => s.status === 'ACTIVE'));

  const firstWaitingClientId = (mod: string) => queueFor(mod)[0]?.id;

  function activeClientIdFor(cat: string): string | undefined {
    return clients.find(
      cl => cl.steps.some(s => s.modality === cat && s.status === 'ACTIVE')
    )?.id;
  }

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
async function submitPlan() {
  const rawName = firstCache.current.trim();
  if (rawName === '') return;                 // safety guard

  /* 1 ▸ upsert client */
  const { clientId } = await fetch(`${API}/client`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ firstName: rawName, lastInitial: '' }),
  }).then(r => r.json());

  /* 2 ▸ create today’s plan */
  await fetch(`${API}/plan`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      clientId,
      optimizations: opts, 
      mode : 'UNSPEC',
      note : noteRef.current?.value ?? '',
    }),
  });

  /* 3 ▸ reset & close */
  firstCache.current = '';   // clear name box
  setOpts([]);               // clear ticks
  setShowIntake(false);
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
  
      {/* 🛠 adjust-timer button – show only while table is busy */}
      {busy && (
  <button
    title="Adjust time"
    onClick={() => {
      const cid = activeClientIdFor(c);
      if (!cid) return;                    // just in case

      setManual({
        c,
        i,
        cid,
        t: st!.type as 'MT' | 'OP',        // 👈 keep original type
      });
    }}
    className="absolute -bottom-2 -right-2 bg-gray-700 text-white
               w-6 h-6 rounded-full text-[10px] leading-none"
  >
    🛠
  </button>
)}

    {/* existing red × stop button */}
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
  <div className="p-3 space-y-6">
    {/* board (⇣ keep under the list) */}
    <div className="relative z-0">
      <BoardView
        layout={LAYOUT}
        cell={cell}
        onNewClient={() => setShowIntake(true)}
      />
    </div>

    {/* client list – sits OVER the board */}
    <section className="relative z-50 space-y-3">
      
      
      {clients.map((c) => (
        <ClientCard
          key={c.id}
          c={c}
          dataMap={data}
          onX={() => {
            const allDone = c.steps.every((s) => s.status === 'DONE');
            allDone ? terminate(c.id) : setConfirmEnd(c);
          }}
          onViewNote={(note) => setNoteView(note)}
          onEdit={() => setEditing(c)}
        />
      ))}
    </section>
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
  <section
    key={category}
    className={`space-y-2 p-3 rounded-lg shadow-sm ${
      CAT_BG[category] ?? 'bg-white'
    }`}
  >
    <h2 className="font-semibold text-center">{category}</h2>

    <div className="grid grid-cols-2 gap-3 justify-center">
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
              onX={() => {
                   /* if every step is DONE we can end immediately */
                   const allDone = c.steps.every(s => s.status === 'DONE');
                   allDone ? terminate(c.id) : setConfirmEnd(c);
                 }}
              onViewNote={(note) => setNoteView(note)}
              onEdit={() => setEditing(c)}
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
  <ModalPortal>
    <Backdrop onClose={() => setShowIntake(false)}>
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-white rounded-lg p-6 w-[28rem] space-y-4 relative"
    >
      {/* ── close (×) ── */}
      <button
        onClick={() => setShowIntake(false)}
        className="absolute top-2 right-3 text-2xl"
      >
        ×
      </button>

      <h2 className="text-lg font-bold">New Client Plan</h2>

{/* ───────── first-name input ───────── */}
<input
  ref={firstRef}
  defaultValue={firstCache.current}                /* uncontrolled — keeps focus */
  onInput={e => { firstCache.current = e.currentTarget.value }}
  className="w-full border p-2 rounded bg-white"
  placeholder="First name"
/>

{/* ───────── optimisation check-boxes ───────── */}
<div className="grid grid-cols-3 gap-3 text-sm mt-2">
  {OPT_LIST.map(opt => (
    <label
      key={opt}
      className="flex items-center gap-1 whitespace-normal break-words
                 leading-tight text-xs max-w-[7rem]"
    >
      <input
        type="checkbox"
        onPointerDown={blurKbBeforeCheckbox}           /* hide keyboard first */
        checked={opts.includes(opt)}
        onChange={e =>
          setOpts(prev =>
            e.target.checked
              ? [...prev, opt]
              : prev.filter(x => x !== opt)
          )
        }
      />
      {opt}
    </label>
  ))}
</div>

{/* ───────── note textarea ───────── */}
<textarea
  ref={noteRef}
  defaultValue={noteCache.current}
  onInput={e => { noteCache.current = e.currentTarget.value }}
  rows={3}
  placeholder="Session note (optional)…"
  className="w-full border p-2 rounded resize-none text-sm"
/>

{/* ───────── create-plan button ───────── */}
<button
  disabled={createDisabled}
  onClick={submitPlan}
  className={`w-full py-2 rounded text-white mt-4 ${
    createDisabled
      ? 'bg-emerald-400 opacity-50'
      : 'bg-emerald-600 hover:bg-emerald-700'
  }`}
>
  Create Plan
</button>
    </div>
  </Backdrop>
  </ModalPortal>
)}

{/* ───────── note viewer ───────── */}
{noteView && (
  <Backdrop onClose={() => setNoteView(null)}>
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-white rounded-lg p-6 w-80 space-y-4 relative"
    >
      <button
        onClick={() => setNoteView(null)}
        className="absolute top-2 right-3 text-xl leading-none"
      >
        ×
      </button>
      <h3 className="font-bold text-lg">Client Note</h3>
      <p className="whitespace-pre-wrap text-sm">{noteView}</p>
    </div>
  </Backdrop>
)}

{/* ───────── confirm end-early ───────── */}
{confirmEnd && (
  <Backdrop onClose={() => setConfirmEnd(null)}>
    <div
      onClick={e => e.stopPropagation()}
      className="bg-white rounded-lg p-6 w-80 space-y-4 relative text-center"
    >
      <button
        onClick={() => setConfirmEnd(null)}
        className="absolute top-2 right-3 text-xl leading-none"
      >
        ×
      </button>

      <h3 className="text-lg font-bold">End session early?</h3>
      <p className="text-sm">
        <strong>{confirmEnd.name}</strong> still has unfinished optimisations.
        Are you sure you want to terminate today’s plan?
      </p>

      <div className="flex justify-center gap-4 mt-4">
        <button
          onClick={() => {
            terminate(confirmEnd.id);     // reuse existing socket emit
            setConfirmEnd(null);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Yes, end now
        </button>

        <button
          onClick={() => setConfirmEnd(null)}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          No, keep running
        </button>
      </div>
    </div>
  </Backdrop>
)}



{/* ───────── plan editor ───────── */}
{editing && (
  <Backdrop onClose={() => setEditing(null)}>
    <PlanEditorModal
      client={editing}
      onClose={() => setEditing(null)}
    />
  </Backdrop>
)}

    {/* manual-timer modal */}
    {manual && (
  <ModalPortal>
    {/* backdrop */}
    <Backdrop onClose={() => setManual(null)}>
      <div
        onClick        ={e => e.stopPropagation()}  // keep clicks inside
        className="relative bg-white rounded-lg p-6 space-y-4 z-[70]"  // <- higher than backdrop
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
          onChange={sec => {                     // sec === minutes * 60
            start(manual.c, manual.i, manual.t ?? 'MT', manual.cid, sec);
            setManual(null);                    // close after starting
          }}
        />
      </div>
    </Backdrop>
  </ModalPortal>
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
  onClose : () => void;
}) {
  return (
    <div
    className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center"
    onClick={(e) => {
        /* close ONLY when the backdrop itself is clicked */
        if (e.target === e.currentTarget) onClose();
      }}
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
        if (pick) setManual({ ...pick, cid, t: 'MT' });   // remember table + client
      }}
      className="px-2 py-1 rounded border text-xs disabled:opacity-40"
    >
      Manual
    </button>
  );
}
}



