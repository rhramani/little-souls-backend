const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("--- USERS IN DATABASE ---");
  users.forEach(u => {
    console.log(`ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.userType} | CustomerID: ${u.customerId}`);
  });

  const customers = await prisma.customer.findMany();
  console.log("\n--- CUSTOMERS IN DATABASE ---");
  customers.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.businessName} | Code: ${c.customerCode} | Phone: ${c.mainContactNumber}`);
  });

  const orders = await prisma.order.findMany();
  console.log("\n--- ORDERS IN DATABASE ---");
  orders.forEach(o => {
    console.log(`ID: ${o.id} | No: ${o.orderNumber} | CustomerID: ${o.customerId} | Source: ${o.orderSource} | Total: ${o.grandTotal} | Status: ${o.orderStatus}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
