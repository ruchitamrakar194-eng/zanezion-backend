import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: {
        name: { in: ['BUSINESS_CLIENT', 'CLIENT'] }
      }
    },
    include: { role: true }
  });
  console.log(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role.name, tenantId: u.tenantId })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
