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

  const cat = await prisma.catalogue.findFirst({ where: { name: 'baby cap' }, include: { products: true } });
  console.log('Catalogue:', cat.name, 'ID:', cat.id);
  console.log('Products:', cat.products.map(p => ({ id: p.id, sku: p.sku, name: p.name, barcode: p.barcode, barcodeUrl: p.barcodeUrl })));

  await prisma.$disconnect();
}

main().catch(console.error);
