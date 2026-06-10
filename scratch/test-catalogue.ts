import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const id = '7d8afdd4-adc7-4f6c-a835-5f39dbfde5f3';
  const productWhere = {};
  
  try {
    const result = await prisma.catalogue.findUnique({
      where: { id },
      include: {
        products: {
          where: productWhere,
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            pricing: { include: { pricingGroup: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    console.log("Catalogue query successful:", result ? "Found" : "Not Found");
    
    const count = await prisma.product.count({
      where: {
        catalogueId: id,
        ...productWhere
      }
    });
    console.log("Count query successful:", count);
  } catch (e) {
    console.error("Error executing query:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
