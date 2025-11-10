import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignEmployeesToServiceOrders() {
  console.log('🔧 Assigning employees to service orders...\n');

  // Get all technicians using Prisma
  const technicians = await prisma.user_profiles.findMany({
    where: {
      role: 'technician',
      is_active: true,
    },
    select: {
      id: true,
      full_name: true,
      email: true,
    },
  });

  if (!technicians || technicians.length === 0) {
    console.error('❌ No technicians found');
    return;
  }

  console.log(`Found ${technicians.length} technicians:`);
  technicians.forEach((tech) => {
    console.log(`  - ${tech.full_name} (${tech.email})`);
  });
  console.log('');

  // Get all service orders using Prisma
  const serviceOrders = await prisma.service_orders.findMany({
    select: {
      id: true,
      order_number: true,
      status: true,
      assigned_employee_id: true,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (!serviceOrders || serviceOrders.length === 0) {
    console.error('❌ No service orders found');
    return;
  }

  console.log(`Found ${serviceOrders.length} service orders\n`);

  // Assign technicians to service orders in a round-robin fashion
  let updated = 0;
  for (let i = 0; i < serviceOrders.length; i++) {
    const order = serviceOrders[i];
    const techIndex = i % technicians.length;
    const technician = technicians[techIndex];

    try {
      // Update the service order with assigned employee using Prisma
      await prisma.service_orders.update({
        where: { id: order.id },
        data: {
          assigned_employee_id: technician.id,
          updated_at: new Date(),
        },
      });

      console.log(`✅ Assigned ${order.order_number} (${order.status}) → ${technician.full_name}`);

      // Also add to service_order_employees table
      try {
        await prisma.service_order_employees.upsert({
          where: {
            service_order_id_employee_id: {
              service_order_id: order.id,
              employee_id: technician.id,
            },
          },
          update: {
            is_primary: true,
          },
          create: {
            service_order_id: order.id,
            employee_id: technician.id,
            is_primary: true,
          },
        });
      } catch (employeeError: any) {
        console.log(`  ⚠️  Could not add to service_order_employees: ${employeeError.message}`);
      }

      updated++;
    } catch (updateError: any) {
      console.error(`❌ Error assigning ${order.order_number}:`, updateError.message);
    }
  }

  console.log(`\n✨ Updated ${updated} service orders`);

  // Show summary using Prisma
  console.log('\n📊 Assignment Summary:');
  const summary = await prisma.service_orders.findMany({
    select: {
      order_number: true,
      status: true,
      user_profiles: {
        select: {
          full_name: true,
          email: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 10,
  });

  console.table(
    summary.map((s) => ({
      order_number: s.order_number,
      status: s.status,
      technician: s.user_profiles?.full_name || 'Unassigned',
    }))
  );
}

assignEmployeesToServiceOrders()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
