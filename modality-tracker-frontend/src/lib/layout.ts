// src/lib/layout.ts
// ──────────────────────────────────────────
// 1) single source for the board layout
// 2) quick lookup table { modality → #tables }
export const LAYOUT = [
    { category: 'CIRCULATION (BACK)',  count: 4 },
    { category: 'CIRCULATION (FRONT)', count: 3 },
    { category: 'PHYSICAL',            count: 3 },
  
    { category: 'CELL',                count: 2 },
    { category: 'ENERGY',              count: 3 },
    { category: 'BRAIN',               count: 4 },
  
    { category: 'GUT (LASER)',         count: 2 },
    { category: 'GUT (EMS)',           count: 2 },
    { category: 'STRESS',              count: 2 },
  
    { category: 'INFRARED SAUNA',      count: 3 },
    { category: 'CRYO',                count: 1 },
    { category: 'HBOT',                count: 1 },
  ];
  
  /** quick “how many tables does this modality have?” map */
  export const CAPACITY: Record<string, number> = Object.fromEntries(
    LAYOUT.map(({ category, count }) => [category, count]),
  );