// types.ts
export type PlanStep   = { modality: string; status: 'PENDING' | 'ACTIVE' | 'DONE'; left?: number };
export type PlanClient = { id: string; name: string; note?: string; steps: PlanStep[] };

export type Cell = {
  type: 'MT' | 'OP';
  startAt: string;
  duration: number;
  clientName: string;
  left?: number;
  done?: boolean;
};
export type Map = Record<string, Record<number, Cell | undefined>>;