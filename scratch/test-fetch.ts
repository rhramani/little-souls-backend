import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const c = await prisma.customer.findFirst();
  const orders = await prisma.order.findMany({ where: { customerId: c!.id } });
  console.log("Customer ID:", c!.id);
  console.log("Orders count:", orders.length);
  console.log(orders);
}
main().finally(() => { prisma.$disconnect(); pool.end(); });
