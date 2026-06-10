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
  console.log('Seeding for:', customer.businessName);
  
  const category = await prisma.category.create({
    data: { name: 'Autumn Collection', slug: 'autumn-' + Date.now(), isActive: true }
  });

  const p1 = await prisma.product.create({
    data: {
      sku: 'AUT-01-' + Date.now(),
      name: 'Autumn Hoodie',
      slug: 'autumn-hoodie-' + Date.now(),
      description: 'Warm hoodie',
      productPrice: 800,
      stockQuantity: 50,
      stockStatus: 'IN_STOCK',
      isActive: true,
      categoryId: category.id,
      moq: 5,
    }
  });

  const catalogue = await prisma.catalogue.create({
    data: {
      name: 'B2B Autumn Catalog',
      products: { connect: [{ id: p1.id }] }
    }
  });

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      orderNumber: 'ORD-SWFT-' + Date.now(),
      orderStatus: 'SHIPPED',
      orderSource: 'WEBSITE',
      totalQuantity: 5,
      discountTotal: 0,
      taxTotal: 0,
      shippingCharge: 0,
      subTotal: 4000,
      grandTotal: 4000,
      paymentStatus: 'UNPAID',
      items: {
        create: [
          {
            productId: p1.id,
            sku: p1.sku,
            productName: p1.name,
            moq: p1.moq,
            quantity: 5,
            price: 800,
            lineSubTotal: 4000,
            lineTaxTotal: 0,
            lineTotal: 4000,
            fulfillmentStatus: 'IN_STOCK'
          }
        ]
      }
    }
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { currentBalance: 4000 }
  });

  console.log('Done!');
}
main().finally(() => { prisma.$disconnect(); pool.end(); });
