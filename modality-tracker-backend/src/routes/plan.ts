// backend/src/routes/plan.ts
import { FastifyInstance } from 'fastify'
import { PrismaClient, StepStatus } from '@prisma/client'
import { today00 } from '../utils/dates'
import { v4 as uuid } from 'uuid'

const prisma = new PrismaClient()

export default async function planRoutes(app: FastifyInstance) {
  /* ────────────────────────────────────────────────────────────────
     1️⃣  CLIENT CREATE / UPSERT
  ────────────────────────────────────────────────────────────────── */
  app.post('/client', async (req, rep) => {
    const { firstName, lastInitial } = req.body as {
      firstName: string
      lastInitial: string
    }

    const client = await prisma.client.upsert({
      where: { firstName_lastInitial: { firstName, lastInitial } },
      update: {},
      create: { id: uuid(), firstName, lastInitial },
    })

    rep.send({
      clientId: client.id,
      name: `${client.firstName} ${client.lastInitial}.`,
    })
  })

  /* ────────────────────────────────────────────────────────────────
     2️⃣  PLAN CREATE  (original behaviour)
  ────────────────────────────────────────────────────────────────── */
  app.post('/plan', async (req, rep) => {
    const { clientId, optimizations, mode, note = '' } = req.body as {
      clientId: string
      optimizations: string[]
      mode: 'MT' | 'OP' | 'UNSPEC'
      note?: string
    }

    const today = today00()

    await prisma.$transaction(async tx => {
      const session = await tx.session.upsert({
        where: { clientId_date: { clientId, date: today } },
        update: { mode, note },
        create: { id: uuid(), clientId, date: today, mode, note },
      })

      for (const modName of optimizations) {
        const modality = await tx.modality.findFirst({ where: { name: modName } })
        if (!modality) continue

        await tx.sessionStep.upsert({
          where: {
            sessionId_modalityId: {
              sessionId:  session.id,
              modalityId: modality.id,
            },
          },
          update: {},
          create: {
            id: uuid(),
            sessionId:  session.id,
            modalityId: modality.id,
            duration:   0,
            status:     StepStatus.PENDING,
          },
        })
      }
    })

    // broadcast
    const plans = await getTodayPlans()
    app.io.emit('plan:list', plans)
    const me = plans.find(p => p.id === clientId)
    if (me) app.io.emit('plan:update', me)

    rep.send({ ok: true })
  }) /* ← POST handler ends here */

  /* ────────────────────────────────────────────────────────────────
     2️⃣-B  PLAN PATCH  (add / remove steps + note)
  ────────────────────────────────────────────────────────────────── */
  app.patch('/plan', async (req, rep) => {
    const { clientId, add = [], remove = [], note } = req.body as {
      clientId: string
      add?: string[]
      remove?: string[]
      note?: string
    }

    const today = today00()

    await prisma.$transaction(async tx => {
      const session = await tx.session.findUniqueOrThrow({
        where: { clientId_date: { clientId, date: today } },
      })

      /* 1. note ----------------------------------------------------- */
      if (typeof note === 'string') {
        await tx.session.update({
          where: { id: session.id },
          data:  { note },
        })
      }

      /* 2. delete pending steps ------------------------------------ */
      if (remove.length) {
        await tx.sessionStep.deleteMany({
          where: {
            sessionId: session.id,
            modality:  { name: { in: remove } },
            status:    StepStatus.PENDING,
          },
        })
      }

      /* 3. add (ignore duplicates) --------------------------------- */
      for (const modName of add) {
        const modality = await tx.modality.findFirst({ where: { name: modName } })
        if (!modality) continue

        await tx.sessionStep.upsert({
          where: {
            sessionId_modalityId: {
              sessionId:  session.id,
              modalityId: modality.id,
            },
          },
          update: {},
          create: {
            id: uuid(),
            sessionId:  session.id,
            modalityId: modality.id,
            duration:   0,
            status:     StepStatus.PENDING,
          },
        })
      }
    })

    // broadcast fresh plans
    const plans = await getTodayPlans()
    app.io.emit('plan:list', plans)
    const me = plans.find(p => p.id === clientId)
    if (me) app.io.emit('plan:update', me)

    rep.send({ ok: true })
  })
}

/* ──────────────────────────────────────────────────────────────────
   helper – today’s full plan list
─────────────────────────────────────────────────────────────────── */
async function getTodayPlans() {
  const today = today00()

  const sessions = await prisma.session.findMany({
    where: { date: today },
    include: {
      client: true,
      steps: { include: { modality: true } },
    },
  })

  return sessions.map(s => ({
    id:   s.client.id,
    name: `${s.client.firstName} ${s.client.lastInitial}.`,
    note: s.note,
    mode: s.mode,
    steps: s.steps.map(st => ({
      modality: st.modality.name,
      status:   st.status,
      left:
        st.status === StepStatus.ACTIVE && st.startAt
          ? st.duration - ((Date.now() - +st.startAt) / 1000 | 0)
          : undefined,
    })),
  }))
}