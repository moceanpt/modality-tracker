/* ── src/lib/constants.ts ───────────────────────────────────── */

/** Backend base URL */
export const API =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';

/* --------------------------------------------------------------
 *  Optimisation keys ⇄ human-readable labels
 * ------------------------------------------------------------ */
export const KEY_TO_LABEL = {
  // Row 1
  CIRC_BACK   : 'CIRCULATION (BACK)',
  CIRC_FRONT  : 'CIRCULATION (FRONT)',
  PHYSICAL    : 'PHYSICAL',

  // Row 2
  CELL        : 'CELL',
  ENERGY      : 'ENERGY',
  BRAIN       : 'BRAIN',

  // Row 3
  GUT_LASER   : 'GUT (LASER)',
  GUT_EMS     : 'GUT (EMS)',
  STRESS      : 'STRESS',

  // Row 4  – one-off modalities that were missing
  INFRA_SAUNA : 'INFRARED SAUNA',
  CRYO        : 'CRYO',
  HBOT        : 'HBOT',
} as const;

/** reverse lookup — e.g.  LABEL_TO_KEY['CRYO'] → 'CRYO' */
export const LABEL_TO_KEY = Object.fromEntries(
  Object.entries(KEY_TO_LABEL).map(([k, v]) => [v, k]),
) as Record<
  (typeof KEY_TO_LABEL)[keyof typeof KEY_TO_LABEL],
  keyof typeof KEY_TO_LABEL
>;

/** Flat list of labels for check-box grids and editors */
export const OPT_LIST = Object.values(KEY_TO_LABEL);