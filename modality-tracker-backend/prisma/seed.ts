// prisma/seed.ts
import { PrismaClient, Status } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

const layout: [string, number][] = [
  /* row-1 */
  ['CIRCULATION (BACK)',  4],
  ['CIRCULATION (FRONT)', 3],
  ['PHYSICAL',            3],

  /* row-2 */
  ['CELL',                2],
  ['ENERGY',              3],
  ['BRAIN',               4],

  /* row-3 */
  ['GUT (LASER)',         2],
  ['GUT (EMS)',           2],
  ['STRESS',              2],

  /* row-4  – new */
  ['INFRARED SAUNA',      3],
  ['CRYO',                1],
  ['HBOT',                1],
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