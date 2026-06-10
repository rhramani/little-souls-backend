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
  if (!customer) return;

  const order = await prisma.order.findFirst({
    where: { customerId: customer.id }
  });

  if (order) {
    await prisma.ledgerEntry.create({
      data: {
        customerId: customer.id,
        entryDate: new Date(),
        entryType: 'INVOICE',
        referenceType: 'ORDER',
        referenceId: order.id,
        debit: order.grandTotal,
        credit: 0,
        balanceAfterEntry: 4000,
        description: 'Initial Order Invoice',
      }
    });
    console.log("Ledger entry added!");
  }
}
main().finally(() => { prisma.$disconnect(); pool.end(); });
