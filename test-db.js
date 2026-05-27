const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const customer = await prisma.customer.findFirst({
    where: { approvalStatus: 'APPROVED' },
    include: { users: true }
  });
  console.log(JSON.stringify(customer, null, 2));
}
main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
