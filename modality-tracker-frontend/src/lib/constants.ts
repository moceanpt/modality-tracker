// src/lib/constants.ts
export const API =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';

  /** Master list of optimisations, used by both the intake form and the plan editor */
export const OPT_LIST = [
  // Row 1
  'CIRCULATION (BACK)',
  'CIRCULATION (FRONT)',
  'PHYSICAL',

  // Row 2
  'CELL',
  'ENERGY',
  'BRAIN',

  // Row 3
  'GUT (LASER)',
  'GUT (EMS)',
  'STRESS',

  // Row 4
  'INFRARED SAUNA',
  'CRYO',
  'HBOT',
];