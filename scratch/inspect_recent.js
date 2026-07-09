import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:ERHffeIUyiChSeUdyJHAbRvMtUKXSlvw@reseau.proxy.rlwy.net:42055/railway"
    }
  }
});

async function main() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { id: 'desc' },
      take: 10
    });
    console.log("REPLAY RECENT ORDERS:");
    for (const o of orders) {
      console.log(`ID: ${o.id}, orderNumber: ${o.orderNumber}, status: ${o.status}, createdAt: ${o.createdAt}`);
    }

    const deliveries = await prisma.delivery.findMany({
      orderBy: { id: 'desc' },
      take: 10,
      include: { order: true }
    });
    console.log("\nREPLAY RECENT DELIVERIES:");
    for (const d of deliveries) {
      console.log(`ID: ${d.id}, deliveryNumber: ${d.deliveryNumber}, orderId: ${d.orderId}, orderNumber: ${d.order?.orderNumber}, createdAt: ${d.createdAt}`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
