import { useEffect, useState } from 'react';
import ClientCard      from '../components/ClientCard';
import { io }          from 'socket.io-client';
import { API } from '../src/lib/constants';
import type { PlanClient, Map } from '../types';
import Link            from 'next/link';

const socket = io(API);

export default function ClientsPage() {
    const [clients, setClients] = useState<PlanClient[]>([]);

    useEffect(() => {
      const id = setInterval(() => {
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
      }, 1_000);
    
      return () => clearInterval(id);      // ✅  cleans up on unmount
    }, []);
    
  const [data,    setData]    = useState<Map>({});

  /* hydrate – very similar to index.tsx ---------------------------- */
  useEffect(() => {
    socket.on('plan:list',   (all: PlanClient[]) => setClients(all));
    socket.on('plan:update', (one: PlanClient)  =>
      setClients(p => p.map(c => (c.id === one.id ? one : c))),
    );
    socket.on('plan:remove', ({ clientId }) =>
      setClients(p => p.filter(c => c.id !== clientId)),
    );

    socket.on('station:batch', (map: Map) => setData(map));
    socket.emit('init');
    return () => {
             socket.off('plan:list');
             socket.off('plan:update');
             socket.off('plan:remove');
             socket.off('station:batch');
           };
  }, []);

  /* render --------------------------------------------------------- */
  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">All Clients</h1>
        <Link href="/">
          <span className="px-3 py-1 rounded bg-slate-600 text-white">
            ⬅ Back to Board
          </span>
        </Link>
      </header>

      <div className="flex flex-wrap gap-4">
        {clients.map(c => (
          <ClientCard
            key={c.id}
            c={c}
            dataMap={data}
            onX={() => socket.emit('plan:terminate', { clientId: c.id })}
          />
        ))}
      </div>
    </div>
  );
}