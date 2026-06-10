const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();

  // Get our catalogue
  const cat = await prisma.catalogue.findFirst({ where: { name: 'baby cap' } });
  if (!cat) {
    console.error('Catalogue not found');
    await prisma.$disconnect();
    return;
  }

  console.log('Associating products to catalogue:', cat.id);

  // Set catalogueId for all products
  await prisma.product.updateMany({
    data: { catalogueId: cat.id }
  });

  const products = await prisma.product.findMany({ where: { catalogueId: cat.id } });
  console.log('Associated products:', products.map(p => ({ id: p.id, sku: p.sku, name: p.name, barcodeUrl: p.barcodeUrl })));

  await prisma.$disconnect();
}

main().catch(console.error);
