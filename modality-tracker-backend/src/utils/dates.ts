// src/utils/dates.ts
export function today00(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  