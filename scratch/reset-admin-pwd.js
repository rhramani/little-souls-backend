const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();

  const newPassword = 'AdminPassword123!';
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const updated = await prisma.user.update({
    where: { email: 'admin@littlesouls.com' },
    data: {
      passwordHash: passwordHash,
      plainPassword: newPassword,
    },
  });

  console.log('Password for admin@littlesouls.com successfully updated to:', newPassword);
  console.log('User ID:', updated.id);

  await prisma.$disconnect();
  pool.end();
}

main().catch(console.error);
