import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Finding a customer...');
  const customer = await prisma.customer.findFirst();
  
  if (!customer) {
    console.log('No customer found!');
    return;
  }
  
  console.log(`Found Customer: ${customer.businessName} (ID: ${customer.id})`);
  
  console.log('Creating mock Category...');
  const category = await prisma.category.create({
    data: {
      name: 'Summer Collection',
      slug: 'summer-collection-' + Date.now(),
      isActive: true,
    }
  });

  console.log('Creating mock Products...');
  const p1 = await prisma.product.create({
    data: {
      sku: 'SUMMER-01-' + Date.now(),
      name: 'Summer Breeze T-Shirt',
      slug: 'summer-breeze-tshirt-' + Date.now(),
      description: 'Cool cotton summer t-shirt',
      productPrice: 450,
      stockQuantity: 150,
      stockStatus: 'IN_STOCK',
      isActive: true,
      categoryId: category.id,
      moq: 5,
    }
  });

  const p2 = await prisma.product.create({
    data: {
      sku: 'SUMMER-02-' + Date.now(),
      name: 'Linen Shorts',
      slug: 'linen-shorts-' + Date.now(),
      description: 'Breathable linen shorts',
      productPrice: 650,
      stockQuantity: 200,
      stockStatus: 'IN_STOCK',
      isActive: true,
      categoryId: category.id,
      moq: 10,
    }
  });

  console.log('Creating mock Catalogue...');
  const catalogue = await prisma.catalogue.create({
    data: {
      name: 'B2B Summer Catalog',
      products: {
        connect: [{ id: p1.id }, { id: p2.id }]
      }
    }
  });

  console.log('Creating mock Order...');
  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      orderNumber: 'ORD-' + Date.now(),
      orderStatus: 'SHIPPED',
      orderSource: 'WEBSITE',
      totalQuantity: 2,
      discountTotal: 0,
      taxTotal: 0,
      shippingCharge: 0,
      subTotal: 1100,
      grandTotal: 1100,
      paymentStatus: 'UNPAID',
      items: {
        create: [
          {
            productId: p1.id,
            sku: p1.sku,
            productName: p1.name,
            moq: p1.moq,
            quantity: 1,
            price: 450,
            lineSubTotal: 450,
            lineTaxTotal: 0,
            lineTotal: 450,
            fulfillmentStatus: 'IN_STOCK'
          },
          {
            productId: p2.id,
            sku: p2.sku,
            productName: p2.name,
            moq: p2.moq,
            quantity: 1,
            price: 650,
            lineSubTotal: 650,
            lineTaxTotal: 0,
            lineTotal: 650,
            fulfillmentStatus: 'IN_STOCK'
          }
        ]
      }
    }
  });

  console.log('Updating Customer Balance...');
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      currentBalance: 1100,
    }
  });

  console.log('Creating Ledger Entry...');
  await prisma.ledgerEntry.create({
    data: {
      customerId: customer.id,
      entryType: 'INVOICE',
      referenceType: 'ORDER',
      debit: 1100,
      credit: 0,
      balanceAfterEntry: 1100,
      referenceId: order.id,
      description: 'Invoice for order ' + order.orderNumber,
      entryDate: new Date(),
    }
  });

  console.log('Done populating dynamic data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
