import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { API } from '../src/lib/constants';


export default function Intake() {
  const [first, setFirst] = useState('');
  const [lastI, setLastI] = useState('');
  const [opts,  setOpts]  = useState<string[]>([]);
  const [note,  setNote]  = useState('');
  const router = useRouter();
  const firstRef = useRef<HTMLInputElement>(null);

  const LIST = [
    'PHYSICAL','GUT (LASER)','GUT (EMS)','STRESS',
    'CIRCULATION (BACK)','CIRCULATION (FRONT)',
    'ENERGY','CELL','BRAIN','INFRARED SAUNA', 'HBOT', 'CRYO',
  ];


  async function submit() {
    if (!first.trim() || !lastI.trim() || opts.length === 0) return;

    /* 1) create / upsert client */
    const { clientId } = await fetch(`${API}/client`, {
      method : 'POST',
      headers: { 'Content-Type':'application/json' },
      body   : JSON.stringify({
        firstName  : first.trim(),
        lastInitial: lastI.trim().toUpperCase()
      })
    }).then(r=>r.json());

    /* 2) create today’s plan */
    await fetch(`${API}/plan`, {
            method : 'POST',
            headers: { 'Content-Type':'application/json' },
            body   : JSON.stringify({
              clientId,
              optimizations: opts,
              mode: 'UNSPEC',
              note,                          // ← send the note
            })
    });

    /* 3) go back to the board */
    router.push('/');
  }

  /* decide whether the button should be disabled */
  const disabled = !first.trim() || !lastI.trim() || opts.length === 0;

  return (
    <div className="p-6 space-y-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold">New Client</h1>

      <input
        autoFocus
        className="w-full border p-2 rounded"
        placeholder="First name"
        value={first}
        onChange={e=>setFirst(e.target.value)}
      />

      <input
        className="w-24 border p-2 rounded"
        placeholder="Last initial"
        maxLength={1}
        value={lastI}
        onChange={e=>setLastI(e.target.value)}
      />

      <div className="flex flex-wrap gap-3">
        {LIST.map(opt=>(
          <label key={opt} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={opts.includes(opt)}
              onChange={e=>{
                setOpts(p=>e.target.checked
                  ? [...p,opt]
                  : p.filter(x=>x!==opt));
              }}
            />
            {opt}
          </label>
        ))}
      </div>

 {/* NEW note text-area */}
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        placeholder="Session note (optional)…"
        className="w-full border p-2 rounded resize-none text-sm"
      />

      <button
        onClick={submit}
        disabled={disabled}
        className={`px-4 py-2 rounded text-white
                    ${disabled
                      ? 'bg-emerald-400 opacity-50'
                      : 'bg-emerald-600 hover:bg-emerald-700'}`}
      >
        Create Plan
      </button>
    </div>
  );
}