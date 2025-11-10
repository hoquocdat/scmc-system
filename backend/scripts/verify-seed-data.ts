import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyData() {
  console.log('🔍 Verifying seed data...\n');

  // Check customers using Prisma
  const customers = await prisma.customers.findMany({
    select: {
      id: true,
      full_name: true,
      phone: true,
      email: true,
    },
    take: 5,
  });

  console.log('👥 Sample Customers:');
  console.table(customers);

  // Check bikes using Prisma
  const bikes = await prisma.bikes.findMany({
    select: {
      id: true,
      license_plate: true,
      brand: true,
      model: true,
      year: true,
    },
    take: 5,
  });

  console.log('\n🏍️  Sample Bikes:');
  console.table(bikes);

  // Check service orders using Prisma
  const orders = await prisma.service_orders.findMany({
    select: {
      id: true,
      status: true,
      priority: true,
      description: true,
      estimated_cost: true,
    },
    take: 5,
  });

  console.log('\n📋 Sample Service Orders:');
  console.table(orders);

  // Count totals using Prisma
  console.log('\n📊 Total Counts:');
  const [customerCount, bikeCount, orderCount] = await Promise.all([
    prisma.customers.count(),
    prisma.bikes.count(),
    prisma.service_orders.count(),
  ]);

  console.log(`   • Customers: ${customerCount}`);
  console.log(`   • Bikes: ${bikeCount}`);
  console.log(`   • Service Orders: ${orderCount}`);

  console.log('\n✅ Verification complete!');
}

verifyData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
