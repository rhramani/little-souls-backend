import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const prods = await prisma.product.findMany({ 
    select: { 
      id: true, 
      sku: true, 
      name: true,
      isActive: true, 
      catalogue: { select: { name: true } }
    } 
  });
  console.log('Total products:', prods.length);
  
  const activeProds = prods.filter(p => p.isActive);
  const inactiveProds = prods.filter(p => !p.isActive);
  
  console.log('Active products:', activeProds.length);
  console.log('Inactive products:', inactiveProds.length);
  
  const inCatalog = prods.filter(p => p.catalogue !== null);
  const notInCatalog = prods.filter(p => p.catalogue === null);
  
  console.log('In a catalog:', inCatalog.length);
  console.log('Not in a catalog:', notInCatalog.length);

  console.log('\n--- Not in a catalog (First 5) ---');
  console.log(JSON.stringify(notInCatalog.slice(0, 5), null, 2));

  // If we should delete the not in catalog ones
  if (process.argv.includes('--delete-orphans')) {
    const res = await prisma.product.deleteMany({
      where: { catalogueId: null }
    });
    console.log('Deleted orphaned products:', res.count);
  }
}
main().finally(() => prisma.$disconnect());
