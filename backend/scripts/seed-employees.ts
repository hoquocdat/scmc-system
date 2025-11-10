import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { log } from 'console';

const prisma = new PrismaClient();

// Supabase Auth client (only for auth operations)
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const employees = [
  // Technicians
  {
    full_name: 'Khánh Gara',
    email: 'khanhgara@saigonclassic.com',
    phone: '0901234567',
    role: 'technician' as const,
    password: '123456',
  },
  {
    full_name: 'Đen',
    email: 'den@saigonclassic.com',
    phone: '0901234568',
    role: 'technician' as const,
    password: '123456',
  },
  {
    full_name: 'Lê Hoàng Cường',
    email: 'technician3@saigonclassic.com',
    phone: '0901234569',
    role: 'technician' as const,
    password: '123456',
  },
  {
    full_name: 'Phạm Đức Dũng',
    email: 'technician4@saigonclassic.com',
    phone: '0901234570',
    role: 'technician' as const,
    password: '123456',
  },
  {
    full_name: 'Võ Thành Đạt',
    email: 'technician5@saigonclassic.com',
    phone: '0901234571',
    role: 'technician' as const,
    password: '123456',
  },
  // Sales Staff
  {
    full_name: 'Hoàng Thị Lan',
    email: 'sales1@saigonclassic.com',
    phone: '0902345678',
    role: 'sales' as const,
    password: 'sales123',
  },
  {
    full_name: 'Luân',
    email: 'luan@saigonclassic.com',
    phone: '0902345679',
    role: 'sales' as const,
    password: '123456',
  },
  // Manager
  {
    full_name: 'Tom Hoàng',
    email: 'manager2@saigonclassic.com',
    phone: '0903456789',
    role: 'manager' as const,
    password: '123456',
  },
  // Finance
  {
    full_name: 'doanh',
    email: 'finance@saigonclassic.com',
    phone: '0904567890',
    role: 'manager' as const,
    password: '123456',
  },
];

async function seedEmployees() {
  console.log('🌱 Seeding employees...\n');

  for (const employee of employees) {
    // First, create auth user via Supabase Auth
    const { data: authData, error: authError } = await supabaseAuth.auth.admin.createUser({
      email: employee.email,
      password: employee.password,
      email_confirm: true,
      user_metadata: {
        full_name: employee.full_name,
        phone: employee.phone,
        role: employee.role,
      },
    });

    if (authError) {
      console.error(`❌ Error creating auth for ${employee.full_name}:`, authError.message);
      continue;
    }

    if (!authData.user) {
      console.error(`❌ No user data returned for ${employee.full_name}`);
      continue;
    }

    // Then insert user profile using Prisma
    try {
      await prisma.user_profiles.upsert({
        where: { id: authData.user.id },
        update: {
          full_name: employee.full_name,
          email: employee.email,
          phone: employee.phone,
          role: employee.role,
          is_active: true,
        },
        create: {
          id: authData.user.id,
          full_name: employee.full_name,
          email: employee.email,
          phone: employee.phone,
          role: employee.role,
          is_active: true,
        },
      });
      console.log(`✅ Created ${employee.full_name} (${employee.role}) - ${employee.email}:${employee.password}`);
    } catch (profileError: any) {
      log(profileError);
      console.error(`❌ Error creating profile for ${employee.full_name}:`, profileError.message);
    }
  }

  // Display all employees using Prisma
  console.log('\n📋 All Employees:');
  const allEmployees = await prisma.user_profiles.findMany({
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      is_active: true,
    },
    orderBy: [
      { role: 'asc' },
      { full_name: 'asc' },
    ],
  });

  console.table(allEmployees);
  console.log('\n✨ Done!');
}

seedEmployees()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
