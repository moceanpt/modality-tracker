// components/ClientCard.tsx
import React from 'react';
import { PlanClient, Map } from '../types';   //  ⬅ see step 2
import { CAPACITY }  from '../src/lib/layout';               // 🔝 add at top

/* helper ─ 00:00 formatter (same logic Board uses) */
const pad   = (n: number) => n.toString().padStart(2, '0');
const pretty = (s: number) => `${pad((s / 60) | 0)}:${pad(s % 60)}`;

export default function ClientCard({
  c, dataMap, onX,
}: {
  c: PlanClient;
  dataMap: Map;
  onX?: () => void;
}) {
  const headerClr =
    c.steps.every(s => s.status === 'DONE')
      ? 'bg-emerald-600'
      : c.steps.some(s => s.status === 'ACTIVE')
      ? 'bg-orange-500'
      : 'bg-slate-500';

  return (
    <div className="border rounded shadow text-xs w-56">
      <div className={`px-2 py-1 flex justify-between items-center text-white ${headerClr}`}>
        <span>{c.name}</span>
        {onX && (
          <button onClick={onX} className="text-lg leading-none">×</button>
        )}
      </div>

      <ul className="bg-white divide-y">
        {c.steps.map(s => {
                   
          const total = CAPACITY[s.modality] ?? 0;
          const used  = Object.values(dataMap[s.modality] ?? {})
                         .filter(cell => cell && !cell.done)   // ignore empty & DONE
                         .length;
          const free  = Math.max(total - used, 0);   
          
          return (
            <li key={s.modality}
                className={`flex justify-between px-2 py-1 ${
                  s.status === 'ACTIVE' ? 'bg-orange-50'
                : s.status === 'DONE'   ? 'bg-emerald-50' : ''}`}>
              <span className={s.status === 'ACTIVE' ? 'font-semibold' : ''}>
                {s.modality}{s.status !== 'DONE' && free !== total && ` (${free})`}
              </span>
              <span>
                {s.status === 'PENDING' && '•'}
                {s.status === 'ACTIVE'  && `⏳ ${pretty(s.left ?? 0)}`}
                {s.status === 'DONE'    && '✅'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}