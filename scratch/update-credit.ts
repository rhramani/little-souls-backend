import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const customer = await prisma.customer.findFirst({
    where: { businessName: { contains: 'SWFT', mode: 'insensitive' } }
  });
  if (!customer) {
    console.log('Customer not found!');
    return;
  }
  await prisma.customer.update({
    where: { id: customer.id },
    data: { creditLimit: 500000 }
  });
  console.log('Updated credit limit to 500,000 for', customer.businessName);
}
main().finally(() => { prisma.$disconnect(); pool.end(); });
