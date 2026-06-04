import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const prods = await prisma.product.findMany({ select: { id: true, sku: true, isActive: true, catalogues: { select: { catalogue: { select: { name: true } } } } } });
  console.log('Total products:', prods.length);
  console.log(JSON.stringify(prods, null, 2));
}
main().finally(() => prisma.$disconnect());
