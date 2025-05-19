"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// prisma/seed.ts
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
const layout = [
    ['CIRCULATION (BACK)', 4],
    ['CIRCULATION (FRONT)', 3],
    ['BRAIN', 4],
    ['ENERGY', 3],
    ['CELL', 2],
    ['PHYSICAL', 3],
    ['GUT (EMS)', 2],
    ['GUT (LASER)', 2],
    ['STRESS', 2],
];
async function main() {
    for (const [category, count] of layout) {
        // 1️⃣  Ensure a Modality row exists (name is unique)
        const modality = await prisma.modality.upsert({
            where: { name: category },
            update: {},
            create: { id: (0, uuid_1.v4)(), name: category, defaultDuration: 15 },
        });
        // 2️⃣  Create / update Stations for this category
        for (let i = 0; i < count; i++) {
            await prisma.station.upsert({
                where: { category_index: { category, index: i } },
                update: {},
                create: {
                    id: (0, uuid_1.v4)(),
                    category,
                    index: i,
                    label: `Table ${i + 1}`,
                    status: client_1.Status.AVAILABLE, // board starts with all tables free
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
