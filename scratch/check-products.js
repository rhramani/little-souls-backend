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

  const count = await prisma.product.count();
  console.log('Total products count:', count);
  const products = await prisma.product.findMany({ take: 5, include: { catalogue: true } });
  console.log('Sample products:', products.map(p => ({ id: p.id, sku: p.sku, name: p.name, catalogue: p.catalogue?.name })));

  await prisma.$disconnect();
}

main().catch(console.error);
