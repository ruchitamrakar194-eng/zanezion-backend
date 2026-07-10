import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const order = await prisma.order.findUnique({
    where: { id: 42 },
    include: { client: true }
  });
  console.log('Order 42 details:', order);
  console.log('Order 42 metadata details:', JSON.stringify(order.metadata, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
