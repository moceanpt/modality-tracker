// components/PlanEditorModal.tsx
import React, { useState } from 'react';
import { PlanClient }     from '../types';
import { OPT_LIST, API }  from '../src/lib/constants';

export default function PlanEditorModal({
  client,
  onClose,
}: {
  client : PlanClient;
  onClose: () => void;
}) {
  /** only PENDING steps */
  const initialPending = client.steps
    .filter(s => s.status === 'PENDING')
    .map(s => s.modality);

  const [checked, setChecked] = useState<string[]>(initialPending);
  const [saving , setSaving ] = useState(false);

 /* ─── helper: hide keyboard unless it’s the “name” input we still need ─── */
const blurIfNotNameInput = (skipEl?: HTMLElement | null) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === skipEl) return;                 // keep focus if it’s that element
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.blur();
    };
  
  /* toggle helper */
  const toggle = (opt: string, on: boolean) =>
    setChecked(prev => (on ? [...prev, opt] : prev.filter(x => x !== opt)));

  /* ─── save (PATCH) ─── */
const save = async () => {
    setSaving(true);
  
    const add    = checked.filter(o => !initialPending.includes(o));
    const remove = initialPending.filter(o => !checked.includes(o));
  
    // nothing changed → just close the modal
    if (!add.length && !remove.length) {
      onClose();
      return;
    }
  
    const url  = `${API}/plan`;
    const body = { clientId: client.id, add, remove };
  
    try {
      const res = await fetch(url, {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(body),
      });
  
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }
  
      onClose();                     // success
    } catch (err) {
      console.error('[PlanEditor] fetch failed:', err);
      alert('Failed to update plan, please try again.');
      setSaving(false);              // let user retry
    }
  };

  return (
    <div
   className="bg-white rounded-lg p-6 w-96 space-y-4 relative"
   onClick={e => e.stopPropagation()} 
 >
      {/* close (×) */}
      <button
        onClick={onClose}
        className="absolute top-2 right-3 text-xl leading-none"
      >
        ×
      </button>

      <h2 className="text-lg font-bold">{client.name}</h2>

      {client.note && (
        <div className="bg-yellow-50 border border-yellow-300 p-3 rounded text-sm whitespace-pre-wrap">
          {client.note}
        </div>
      )}

      {/* optimisation list */}
      <div className="grid grid-cols-2 gap-3 text-xs">
  {OPT_LIST.map(opt => {
    const step = client.steps.find(s => s.modality === opt);
    const status   = step?.status;                 // PENDING | ACTIVE | DONE | undefined
    const locked   = status && status !== 'PENDING';
    const labelCls =
      locked
        ? 'opacity-40 cursor-not-allowed line-through'   // visual cue
        : '';

    return (
        <label key={opt} className={`flex items-center gap-1 ${labelCls}`}>
        <input
          type="checkbox"
          disabled={locked}
          checked={
            locked            // finished steps stay checked
              ? true
              : checked.includes(opt)
          }
          onChange={(e) => {
            if (locked) return;    // safeguard
            blurIfNotNameInput();     // 👈 hide the keyboard
            setChecked((prev) =>
              e.target.checked
                ? [...prev, opt]
                : prev.filter((x) => x !== opt)
            );
          }}
        />
        {opt}
      </label>
    );
  })}
</div>

      <button
        disabled={saving}
        onClick={save}
        className="w-full py-2 bg-emerald-600 text-white rounded
                   hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}