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

  const users = await prisma.user.findMany();
  console.log('Users in database:', users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    userType: u.userType,
    isActive: u.isActive,
    isVerified: u.isVerified,
    passwordHash: u.passwordHash,
    plainPassword: u.plainPassword,
  })));

  await prisma.$disconnect();
  pool.end();
}

main().catch(console.error);
