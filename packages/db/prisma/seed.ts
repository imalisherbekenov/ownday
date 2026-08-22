import { PrismaClient } from "../generated/client/index.js";
import { habitTemplates } from "../src/templates.js";
const prisma = new PrismaClient();
for (const template of habitTemplates) {
  await prisma.habitTemplate.upsert({
    where: { id: template.id },
    create: template,
    update: template,
  });
}
await prisma.$disconnect();
