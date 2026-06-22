import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(clients);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
