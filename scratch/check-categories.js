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

  const categories = await prisma.category.findMany();
  console.log('Categories:', categories.map(c => ({ id: c.id, name: c.name, slug: c.slug })));

  const catalogues = await prisma.catalogue.findMany();
  console.log('Catalogues:', catalogues.map(c => ({ id: c.id, name: c.name })));

  await prisma.$disconnect();
  pool.end();
}

main().catch(console.error);
