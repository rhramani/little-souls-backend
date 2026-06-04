import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { userType: 'SUPER_ADMIN' } });
  if (!user) { console.log('No super admin found'); return; }

  const payload = {
    sub: user.id,
    email: user.email,
    mobile: user.mobile,
    type: user.userType,
    customerId: user.customerId,
    contactId: user.customerContactId,
    sessionId: "fake-session",
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET || 'little-souls-secret-key-2026');
  
  const res = await fetch('http://localhost:3000/api/order/pos-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      walkInName: "Test",
      walkInMobile: "9999999999",
      paymentMethod: "CASH",
      items: [
        {
          productId: "11a56bc3-851d-4464-9be1-081691238472", // Need a valid product ID
          quantity: 1,
          price: 100
        }
      ]
    })
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

main().catch(console.error);
