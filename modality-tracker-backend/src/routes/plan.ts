import { FastifyInstance } from 'fastify';
import { PrismaClient, StepStatus } from '@prisma/client';
import { today00 }                 from '../utils/dates';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

/**
 * Registers /client  and /plan routes
 * Exports a function so index.ts can app.register() it
 */
export default async function planRoutes(app: FastifyInstance) {
  /* 1️⃣  Create (or upsert) a client */
  app.post('/client', async (req, rep) => {
    const { firstName, lastInitial } = req.body as { firstName: string; lastInitial: string };

    const client = await prisma.client.upsert({
      where : { firstName_lastInitial: { firstName, lastInitial } },
      update: {},
      create: { id: uuid(), firstName, lastInitial },
    });

    rep.send({
      clientId: client.id,
      name    : `${client.firstName} ${client.lastInitial}.`,
    });
  });

/* 2️⃣  Create today’s optimization plan */
app.post('/plan', async (req, rep) => {
  const { clientId, optimizations, mode } =
    req.body as {
      clientId: string;
      optimizations: string[];
      mode: 'MT' | 'OP' | 'UNSPEC';
    };

  const today = today00();   // one session per client per day

  /* ── everything inside one atomic transaction ────────── */
  await prisma.$transaction(async (tx) => {
    const session = await tx.session.upsert({
      where : { clientId_date: { clientId, date: today } },
      update: { mode },
      create: { id: uuid(), clientId, date: today, mode },
    });

    for (const modName of optimizations) {
      const modality = await tx.modality.findFirst({ where: { name: modName } });
      if (!modality) continue;                        // skip unknown names

      await tx.sessionStep.upsert({
        where  : { sessionId_modalityId: { sessionId: session.id, modalityId: modality.id } },
        update : {},
        create : {
          id        : uuid(),
          sessionId : session.id,
          modalityId: modality.id,
          duration  : 0,
          status    : StepStatus.PENDING,
        },
      });
    }
  });
  /* ────────────────────────────────────────────────────── */

  // --- notify sockets & reply ---
  const plans = await getTodayPlans();
  app.io.emit('plan:list', plans);               // full refresh
  const me = plans.find(p => p.id === clientId); // single-client patch
  if (me) app.io.emit('plan:update', me);

  rep.send({ ok: true });
});

    // Insert a SessionStep (PENDING) for each requested optimization
    for (const modName of optimizations) {
      const modality = await prisma.modality.findFirst({ where: { name: modName } });
      if (!modality) continue;   // ignore unknown names

      await prisma.sessionStep.upsert({
        where : { sessionId_modalityId: { sessionId: session.id, modalityId: modality.id } }, // add unique if you like
        update: {},
        create: {
          id        : uuid(),
          sessionId : session.id,
          modalityId: modality.id,
          
          duration  : 0,
          status    : StepStatus.PENDING,
        },
      });
    }

    // Send the latest plan list to all clients
    const plans = await getTodayPlans();
    app.io.emit('plan:list', plans);
    const me = plans.find(p => p.id === clientId); 
    if (me) app.io.emit('plan:update', me);
    rep.send({ ok: true });
  });
}

/* helper: gather all sessions for today, shape them for the UI */
async function getTodayPlans() {
  const today = today00();  

  const sessions = await prisma.session.findMany({
    where: { date: today },
    include: {
      client: true,
      steps : { include: { modality: true } },
    },
  });

  return sessions.map(s => ({
    id   : s.client.id,
    name : `${s.client.firstName} ${s.client.lastInitial}.`,
    mode : s.mode,
    steps: s.steps.map(st => ({
      modality: st.modality.name,
      status  : st.status,
      left    : st.status === StepStatus.ACTIVE && st.startAt
                  ? st.duration - ((Date.now() - +st.startAt) / 1000 | 0)
                  : undefined,
    })),
  }));
}