const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true }
  });
  console.log(orders);
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
