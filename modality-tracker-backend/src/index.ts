//  backend/src/index.ts  – Phase-1 (A–D)
import Fastify from 'fastify';
import cors    from '@fastify/cors';
import { PrismaClient, Status, StepStatus, Mode } from '@prisma/client';
import { Server } from 'socket.io';
import planRoutes from './routes/plan';

/* ───────── front-end origin (change only if your FE URL changes) ───────── */
const FRONT_ORIGIN = 'https://modality-tracker-frontend.onrender.com';


/* ───────── static config ───────── */
const TIMER: Record<string, { MT: number; OP: number }> = {
  'CIRCULATION (BACK)':  { MT: 15, OP: 25 },
  'CIRCULATION (FRONT)': { MT: 15, OP: 25 },
  BRAIN:                 { MT: 15, OP: 25 },
  ENERGY:                { MT: 15, OP: 25 },
  CELL:                  { MT: 15, OP: 15 },
  PHYSICAL:              { MT: 15, OP: 25 },
  'GUT (EMS)':           { MT: 20, OP: 35 },
  'GUT (LASER)':         { MT: 20, OP: 35 },
  STRESS:                { MT: 15, OP: 25 },
};

const app    = Fastify({ logger: true });
const prisma = new PrismaClient();

/* ── CORS for every REST request ────────────────────────────────────────── */
await app.register(cors, {
  origin : FRONT_ORIGIN,                  // <<< exact origin
  methods: ['GET', 'POST', 'HEAD', 'OPTIONS']
});

/* ── tiny health-check so Render stops getting 404 on “/” ──────────────── */
app.head('/', (_, reply) => reply.code(204).send());
app.get ('/', (_, reply) => reply.send({ ok: true }));

/* --- REST routes --- */
app.register(planRoutes, { prefix: '/' });

declare module 'fastify' { interface FastifyInstance { io: Server } }
app.decorate('io', null as any);

/* ───────── helpers ───────── */
const mins = (cat: string, t: 'MT' | 'OP') => TIMER[cat]?.[t] ?? null;
function today00() { const d=new Date(); d.setHours(0,0,0,0); return d; }

/** get *first pending* step for a modality, optionally for a given clientId */
async function getNextPendingStep(
    modalityId : string,
    type       : 'MT' | 'OP',
    clientId  ?: string,
  ) {
    return prisma.sessionStep.findFirst({
      where : {
        modalityId,
        status: StepStatus.PENDING,
        session: {
          ...(clientId && { clientId }),
          mode: { in: [type, Mode.UNSPEC] }   // 🆕 respect client mode
        }
      },
      orderBy: { session: { date: 'asc' } },
      include: { session: { include: { client: true } } },
    });
  }

/* ───────── NEW helper ───────── */
/** mark every ACTIVE step of a client DONE and free their stations  */
async function forceFinishClient(clientId: string) {
  const activeSteps = await prisma.sessionStep.findMany({
    where: {
      status : StepStatus.ACTIVE,
      session: { clientId, date: today00() },
    },
    include: { station: true },
  });

  for (const stp of activeSteps) {
    // 1) close the step
    await prisma.sessionStep.update({
      where: { id: stp.id },
      data : { status: StepStatus.DONE, endAt: new Date() },
    });

    // 2) free the station (if any)
    if (stp.stationId) {
      await prisma.station.update({
        where: { id: stp.stationId },
        data : { status: Status.AVAILABLE },
      });

      // 3) update the grid
      app.io.emit('station:update', {
        category: stp.station!.category,
        index   : stp.station!.index,
        data    : undefined,
      });
    }
  }
}  


/** whole board for FE */
async function getTodayPlans() {
  const sessions = await prisma.session.findMany({
    where: { date: today00() },
    include: { client: true, steps: { include: { modality: true } } },
  });
  return sessions.map(s => ({
    id   : s.client.id,
    name : `${s.client.firstName} ${s.client.lastInitial}.`,
    mode : s.mode,                                // ← A
    steps: s.steps.map(st => ({
      modality: st.modality.name,
      status  : st.status,
      left    : st.status === StepStatus.ACTIVE && st.startAt
                  ? st.duration - ((Date.now() - +st.startAt) / 1000 | 0)
                  : undefined,
    })),
  }));
}


/* ───────── boot ───────── */
const PORT = Number(process.env.PORT ?? 10000);
app.listen({ port:PORT, host:'0.0.0.0' }, err => {
  if (err) { app.log.error(err); process.exit(1); }
  app.log.info(`🚀 backend http://localhost:${PORT}`);

  /* Web-Sockets must use the same CORS policy */
  const io = new Server(app.server, {
    cors: { origin: FRONT_ORIGIN, methods: ['GET', 'POST'] }
  });

  app.io = io;

  io.on('connection', socket => {
    socket.on('init', async ()=> {
      socket.emit('plan:list', await getTodayPlans());
    
      /* ⇢ ALSO send a snapshot of every station so the grid re-hydrates */
  const stations = await prisma.station.findMany({
    include: {
      sessionSteps: {
        orderBy: { startAt: 'desc' },
        take: 1,
        include: { session: { include: { client: true } } }   // need client for name
      }
    }
  });

  const map: Record<string, Record<number, any>> = {};

  stations.forEach(st => {
    const step = st.sessionSteps[0];
    if (!map[st.category]) map[st.category] = {};

    map[st.category][st.index] = step && step.status !== 'DONE'
      ? {
          type      : step.duration >= 1200 ? 'OP' : 'MT',
          startAt   : step.startAt!.toISOString(),
          duration  : step.duration,
          clientName: step.session.client.firstName     // shows on the grid
        }
      : undefined;
  });

  socket.emit('station:batch', map);   // <— front-end listener updates the grid
    
    });

    /* ─── optim:start ─── */
    socket.on('optim:start',
      async (
        { category,index,type,clientId }:
        { category:string; index:number; type:'MT'|'OP'; clientId?:string },
        ack?: (r:{ok:boolean;msg?:string})=>void
      )=>{
        try{
          if (clientId) {
            const another = await prisma.sessionStep.findFirst({
              where: { status: StepStatus.ACTIVE, session: { clientId } },
            });
            if (another) throw new Error('Client already in another optimisation');
          }

          const st = await prisma.station.findFirst({ where:{ category,index } });
          if(!st) throw new Error('Station not found');

          const m = mins(category,type); if(!m) throw new Error('Unknown category/type');
          await prisma.station.update({ where:{id:st.id}, data:{ status:Status.IN_USE } });

          const step = await getNextPendingStep(st.modalityId!, type, clientId);
          if(!step) throw new Error('No pending step');

          const started = new Date(); const dur=m*60;
          await prisma.sessionStep.update({ where:{id:step.id},
            data:{ status:StepStatus.ACTIVE,startAt:started,duration:dur,stationId:st.id } });

          io.emit('station:update',{ category,index,
            data:{ type,startAt:started.toISOString(),duration:dur, clientName:step.session.client.firstName }});

          io.emit('plan:update',(await getTodayPlans())
            .find(p=>p.id===step.session.client.id));

          ack?.({ok:true});
        }catch(e:any){ ack?.({ok:false,msg:e.message}); }
      });

    /* ─── session:stop ─── */
    socket.on('session:stop',
      async ({category,index}:{category:string;index:number},ack?:(r:{ok:boolean;msg?:string})=>void)=>{
        try{
          const st = await prisma.station.findFirst({ where:{category,index} });
          if(!st) throw new Error('Station not found');

          const step = await prisma.sessionStep.findFirst({
            where:{ stationId:st.id, status:StepStatus.ACTIVE }, include:{ session:{include:{client:true}} }
          });
          if(step){
            await prisma.sessionStep.update({ where:{id:step.id},
              data:{ status:StepStatus.DONE,endAt:new Date() }});
            io.emit('plan:update',(await getTodayPlans())
              .find(p=>p.id===step.session.client.id));
          }
          await prisma.station.update({ where:{id:st.id}, data:{ status:Status.AVAILABLE } });
          io.emit('station:update',{category,index,data:undefined});
          ack?.({ok:true});
        }catch(e:any){ ack?.({ok:false,msg:e.message}); }
      });

    /* ─── plan:terminate (manual remove) ─── */
    socket.on('plan:terminate', async ({ clientId }: { clientId: string }) => {
      await forceFinishClient(clientId);   // finish anything still running
    
      // wipe today’s session + steps
      await prisma.sessionStep.deleteMany({
        where: { session: { clientId, date: today00() } },
      });
      await prisma.session.deleteMany({
        where: { clientId, date: today00() },
      });
    
      app.io.emit('plan:remove', { clientId });
    });
  }); 
}); 
    
/* graceful shutdown */
process.on('SIGINT', async ()=>{ await prisma.$disconnect(); process.exit(0); });