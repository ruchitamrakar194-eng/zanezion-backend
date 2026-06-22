import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const users = await prisma.user.findMany();
  console.log(users.map(u => ({ id: u.id, email: u.email })));
  await prisma.$disconnect();
})();
