// prisma/seed.ts
import { PrismaClient, Status } from '@prisma/client';
const { v4: uuid } = require('uuid');   

const prisma = new PrismaClient();

const layout: [string, number][] = [
  ['CIRCULATION (BACK)',  4],
  ['CIRCULATION (FRONT)', 3],
  ['BRAIN',               4],
  ['ENERGY',              3],
  ['CELL',                2],
  ['PHYSICAL',            3],
  ['GUT (EMS)',           2],
  ['GUT (LASER)',         2],
  ['STRESS',              2],
];

async function main() {
  for (const [category, count] of layout) {
    // 1️⃣  Ensure a Modality row exists (name is unique)
    const modality = await prisma.modality.upsert({
      where:  { name: category },
      update: {},
      create: { id: uuid(), name: category, defaultDuration: 15 },
    });

    // 2️⃣  Create / update Stations for this category
    for (let i = 0; i < count; i++) {
      await prisma.station.upsert({
        where:  { category_index: { category, index: i } },
        update: {},
        create: {
          id        : uuid(),
          category,
          index     : i,
          label     : `Table ${i + 1}`,
          status    : Status.AVAILABLE,   // board starts with all tables free
          modalityId: modality.id,
        },
      });
    }
  }

  console.log('✅ Stations and modalities seeded');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());