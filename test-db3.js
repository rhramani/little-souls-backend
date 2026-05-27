const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { plainPassword: true, mobile: true, customerId: true } });
  console.log(users.filter(u => u.plainPassword));
}
main().then(() => prisma.$disconnect());
