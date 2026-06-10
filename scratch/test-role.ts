import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const role = await prisma.role.findFirst({ where: { name: 'Sales Manager' } });
  if (!role) { console.log('Role not found'); return; }
  
  // Try to update permission
  let permissionRecord = await prisma.permission.findUnique({
    where: { module_action: { module: 'Dashboard', action: 'manage' } },
  });
  if (!permissionRecord) {
    permissionRecord = await prisma.permission.create({
      data: { module: 'Dashboard', action: 'manage' },
    });
  }

  await prisma.rolePermission.create({
    data: { roleId: role.id, permissionId: permissionRecord.id }
  });
  console.log('Permission added!');
}
main().finally(() => { prisma.$disconnect(); pool.end(); });
