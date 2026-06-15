import { PrismaClient, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@littlesouls.com';
  const adminMobile = '9999999999';
  const adminPassword = 'AdminPassword123!';

  // Check if admin already exists
  let admin = await prisma.user.findFirst({
    where: {
      OR: [{ email: adminEmail }, { mobile: adminMobile }],
    },
  });

  if (admin) {
    console.log('An admin user already exists!');
    console.log('Email:', admin.email);
    console.log('Mobile:', admin.mobile);
    console.log('Password is unchanged from when you set it.');
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Create StaffProfile for Admin
  const staffProfile = await prisma.staffProfile.create({
    data: {
      employeeCode: 'ADM-001',
      name: 'Super Admin',
      email: adminEmail,
      mobile: adminMobile,
      designation: 'Super Administrator',
      department: 'Management',
      isActive: true,
    },
  });

  // Create User
  admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: adminEmail,
      mobile: adminMobile,
      passwordHash: passwordHash,
      userType: UserType.SUPER_ADMIN,
      isActive: true,
      isVerified: true,
      staffId: staffProfile.id,
    },
  });

  console.log('====================================');
  console.log('✅ SUPER ADMIN CREATED SUCCESSFULLY!');
  console.log('====================================');
  console.log('Login Email:   ', adminEmail);
  console.log('Login Mobile:  ', adminMobile);
  console.log('Login Password:', adminPassword);
  console.log('====================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
