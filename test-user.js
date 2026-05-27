const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: "littlesoulsswft@gmail.com" }, { mobile: "littlesoulsswft@gmail.com" }] }
  });
  console.log("User:", user);
}
main().finally(() => prisma.$disconnect());
