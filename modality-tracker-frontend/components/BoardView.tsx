/* components/BoardView.tsx
   Phone-only board pager (portrait: 1 × 3, landscape: 2 × 3)
---------------------------------------------------------------- */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/* types ---------------------------------------------------------- */
export type CellRenderer = (cat: string, idx: number) => ReactNode;

interface Props {
  layout: { category: string; count: number }[];
  cell: CellRenderer;
  onNewClient: () => void;
}

/* Orientation hook ------------------------------------------------ */
function useOrientation() {
  const [portrait, setPortrait] = useState(
    () => typeof window === 'undefined'
      ? true
      : window.matchMedia('(orientation: portrait)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const cb = (e: MediaQueryListEvent) => setPortrait(e.matches);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, []);
  return portrait;
}

/* Main component -------------------------------------------------- */
export default function BoardView({ layout, cell, onNewClient }: Props) {
  /* pagination math */
  const portrait  = useOrientation();
  const PER_PAGE  = portrait ? 3 : 6;                // 1 row vs 2 rows
  const pageCount = Math.ceil(layout.length / PER_PAGE);

  const [page, setPage] = useState(0);
  const pagerRef = useRef<HTMLDivElement>(null);

  const catsThisPage = layout.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  /* scroll to top on page flip */
  useEffect(() => { pagerRef.current?.scrollTo(0, 0); }, [page]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ─── header ─── */}
      <header className="flex items-center justify-between p-3 border-b gap-2 bg-white">
        <button
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          className="px-2 text-lg disabled:opacity-30"
        >‹</button>

        <Link href="/clients"
              className="px-3 py-1 bg-slate-200 rounded text-sm">
          Clients ▸
        </Link>

        <span className="flex-1 text-center font-medium text-sm">
          {page + 1} / {pageCount}
        </span>

        <button
          onClick={onNewClient}
          className="px-3 py-1 bg-emerald-600 text-white rounded text-sm"
        >＋</button>

        <button
          disabled={page === pageCount - 1}
          onClick={() => setPage(page + 1)}
          className="px-2 text-lg disabled:opacity-30"
        >›</button>
      </header>

      {/* ─── category blocks ─── */}
      <main
        ref={pagerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain"
        style={{ overflowAnchor: 'none' }}
      >
        {catsThisPage.map(({ category, count }) => (
          <section key={category} className="space-y-2 with-divider">
            <h2 className="font-semibold">{category}</h2>

            <div
              className={portrait
                ? 'grid grid-cols-2 gap-3'
                : 'grid grid-cols-3 gap-3'}
            >
              {Array.from({ length: count }).map((_, i) => cell(category, i))}
            </div>
          </section>
        ))}
      </main>

      {/* ─── bottom pager ─── */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-t">
        <button
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          className="w-12 h-12 text-2xl bg-slate-200 rounded-full disabled:opacity-30"
        >‹</button>

        <div className="flex gap-1">
          {Array.from({ length: pageCount }).map((_, i) => (
            <span key={i}
                  className={`w-2 h-2 rounded-full ${
                    i === page ? 'bg-sky-600' : 'bg-slate-300'
                  }`}
            />
          ))}
        </div>

        <button
          disabled={page === pageCount - 1}
          onClick={() => setPage(page + 1)}
          className="w-12 h-12 text-2xl bg-slate-200 rounded-full disabled:opacity-30"
        >›</button>
      </div>
    </div>
  );
}