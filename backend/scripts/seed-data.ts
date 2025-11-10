import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Customer data - Big bike owners
const customers = [
  {
    full_name: 'Nguyễn Văn Thành',
    id_number: '079123456789',
    phone: '+84901234501',
    email: 'thanh.nguyen@gmail.com',
    address: '123 Nguyễn Huệ, Q1, TP.HCM',
    notes: 'VIP customer - owns multiple bikes',
  },
  {
    full_name: 'Trần Minh Tuấn',
    id_number: '079234567890',
    phone: '+84901234502',
    email: 'tuan.tran@yahoo.com',
    address: '456 Lê Lợi, Q1, TP.HCM',
    notes: 'Prefers weekend appointments',
  },
  {
    full_name: 'Lê Hoàng Long',
    id_number: '079345678901',
    phone: '+84901234503',
    email: 'long.le@hotmail.com',
    address: '789 Hai Bà Trưng, Q3, TP.HCM',
    notes: 'Track day enthusiast',
  },
  {
    full_name: 'Phạm Đức Anh',
    id_number: '079456789012',
    phone: '+84901234504',
    email: 'anh.pham@gmail.com',
    address: '321 Võ Văn Tần, Q3, TP.HCM',
    notes: null,
  },
  {
    full_name: 'Hoàng Minh Khoa',
    id_number: '079567890123',
    phone: '+84901234505',
    email: 'khoa.hoang@outlook.com',
    address: '654 Trần Hưng Đạo, Q5, TP.HCM',
    notes: 'Racing modifications',
  },
  {
    full_name: 'Vũ Quang Huy',
    id_number: '079678901234',
    phone: '+84901234506',
    email: 'huy.vu@gmail.com',
    address: '987 Cách Mạng Tháng 8, Q10, TP.HCM',
    notes: null,
  },
  {
    full_name: 'Đỗ Thành Công',
    id_number: '079789012345',
    phone: '+84901234507',
    email: 'cong.do@yahoo.com',
    address: '147 Lý Thường Kiệt, Q10, TP.HCM',
    notes: 'Cafe racer builder',
  },
  {
    full_name: 'Bùi Văn Nam',
    id_number: '079890123456',
    phone: '+84901234508',
    email: 'nam.bui@gmail.com',
    address: '258 Điện Biên Phủ, Q3, TP.HCM',
    notes: null,
  },
  {
    full_name: 'Ngô Minh Tâm',
    id_number: '079901234567',
    phone: '+84901234509',
    email: 'tam.ngo@hotmail.com',
    address: '369 Cộng Hòa, Q. Tân Bình, TP.HCM',
    notes: 'Ducati collector',
  },
  {
    full_name: 'Trương Văn Đại',
    id_number: '079012345678',
    phone: '+84901234510',
    email: 'dai.truong@gmail.com',
    address: '741 Hoàng Văn Thụ, Q. Tân Bình, TP.HCM',
    notes: null,
  },
  {
    full_name: 'Lý Thanh Sơn',
    id_number: '079112345678',
    phone: '+84901234511',
    email: 'son.ly@outlook.com',
    address: '852 Phan Văn Trị, Q. Gò Vấp, TP.HCM',
    notes: 'BMW enthusiast',
  },
  {
    full_name: 'Phan Quốc Việt',
    id_number: '079212345678',
    phone: '+84901234512',
    email: 'viet.phan@gmail.com',
    address: '963 Võ Thị Sáu, Q3, TP.HCM',
    notes: 'Harley owner',
  },
];

// Bike data - Big bikes: Triumph, BMW, Ducati, Harley-Davidson
const bikes = [
  {
    license_plate: '59A1-12345',
    brand: 'Triumph',
    model: 'Bonneville T120',
    year: 2021,
    color: 'Jet Black',
    vin: 'SMTB0T120ABC12345',
    engine_number: 'T120ENG12345',
    notes: 'Classic British twin',
  },
  {
    license_plate: '59A1-23456',
    brand: 'BMW',
    model: 'R1250GS Adventure',
    year: 2022,
    color: 'Racing Blue',
    vin: 'WB10AB020ABC12345',
    engine_number: 'R1250ENG23456',
    notes: 'Adventure touring bike',
  },
  {
    license_plate: '59A1-34567',
    brand: 'Ducati',
    model: 'Panigale V4 S',
    year: 2023,
    color: 'Ducati Red',
    vin: 'ZDMH6B0W0AB123456',
    engine_number: 'V4SENG34567',
    notes: 'Track-focused superbike',
  },
  {
    license_plate: '59A1-45678',
    brand: 'Triumph',
    model: 'Street Triple RS',
    year: 2022,
    color: 'Matte Silver Ice',
    vin: 'SMTB0ST3ABC12346',
    engine_number: 'ST3ENG45678',
    notes: 'Naked sport bike',
  },
  {
    license_plate: '59A1-56789',
    brand: 'BMW',
    model: 'S1000RR',
    year: 2023,
    color: 'M Sport',
    vin: 'WB10AB020ABC12347',
    engine_number: 'S1000ENG56789',
    notes: 'Racing exhaust installed',
  },
  {
    license_plate: '59B1-12345',
    brand: 'Triumph',
    model: 'Tiger 900 Rally Pro',
    year: 2021,
    color: 'Sapphire Black',
    vin: 'SMTB0T90ABC12348',
    engine_number: 'T900ENG67890',
    notes: 'Adventure bike',
  },
  {
    license_plate: '59A1-67890',
    brand: 'Ducati',
    model: 'Monster 937',
    year: 2022,
    color: 'Thrilling Black',
    vin: 'ZDMH6M93ABC12350',
    engine_number: 'M937ENG78901',
    notes: 'Naked street bike',
  },
  {
    license_plate: '59A1-78901',
    brand: 'Harley-Davidson',
    model: 'Street Bob 114',
    year: 2021,
    color: 'Vivid Black',
    vin: '1HD1LEY19AB123451',
    engine_number: 'HD114ENG89012',
    notes: 'Custom pipes',
  },
  {
    license_plate: '59A1-89012',
    brand: 'Triumph',
    model: 'Thruxton RS',
    year: 2023,
    color: 'Silver Ice & Diablo Red',
    vin: 'SMTB0THRABC12352',
    engine_number: 'THRXENG90123',
    notes: 'Cafe racer style',
  },
  {
    license_plate: '59A1-90123',
    brand: 'Ducati',
    model: 'Streetfighter V4',
    year: 2022,
    color: 'Dark Stealth',
    vin: 'ZDMH6SF4ABC12353',
    engine_number: 'SF4ENG01234',
    notes: 'Aggressive naked bike',
  },
  {
    license_plate: '59B1-34567',
    brand: 'BMW',
    model: 'R nineT Scrambler',
    year: 2021,
    color: 'Option 719',
    vin: 'WB10AB020ABC12354',
    engine_number: 'R9TENG12345',
    notes: 'Retro scrambler',
  },
  {
    license_plate: '59A1-91234',
    brand: 'Harley-Davidson',
    model: 'Fat Bob 114',
    year: 2022,
    color: 'Billiard Red',
    vin: '1HD1LEY20AB123452',
    engine_number: 'FBENG23456',
    notes: 'Custom paint',
  },
];

// Service order data - one per bike with various statuses
const serviceOrders = [
  {
    mileage_in: 11950,
    mileage_out: 12020,
    status: 'delivered',
    priority: 'normal',
    description: 'Regular maintenance - 12,000km service',
    customer_demand: 'No issues, just scheduled maintenance',
    estimated_cost: 3500000,
    final_cost: 3420000,
    drop_off_days_ago: 15,
    pickup_days_ago: 12,
  },
  {
    mileage_in: 28500,
    mileage_out: null,
    status: 'in_progress',
    priority: 'high',
    description: 'Tire replacement and wheel alignment',
    customer_demand: 'Tires worn out before long trip',
    estimated_cost: 8500000,
    final_cost: null,
    drop_off_days_ago: 2,
    pickup_days_ago: null,
  },
  {
    mileage_in: 5280,
    mileage_out: null,
    status: 'confirmed',
    priority: 'urgent',
    description: 'Pre-track day inspection and service',
    customer_demand: 'Track day preparation',
    estimated_cost: 5200000,
    final_cost: null,
    drop_off_days_ago: -2,
    pickup_days_ago: null,
  },
  {
    mileage_in: 8920,
    mileage_out: 8940,
    status: 'delivered',
    priority: 'normal',
    description: 'Exhaust system installation - Arrow Pro-Race titanium',
    customer_demand: 'Wants more power and better sound',
    estimated_cost: 18500000,
    final_cost: 18350000,
    drop_off_days_ago: 25,
    pickup_days_ago: 19,
  },
  {
    mileage_in: 19980,
    mileage_out: 20005,
    status: 'quality_check',
    priority: 'normal',
    description: 'Major service - 20,000km',
    customer_demand: 'Major service interval reached',
    estimated_cost: 6800000,
    final_cost: 6750000,
    drop_off_days_ago: 5,
    pickup_days_ago: null,
  },
  {
    mileage_in: 15200,
    mileage_out: null,
    status: 'waiting_parts',
    priority: 'normal',
    description: 'Crash bar replacement and cosmetic repair',
    customer_demand: 'Minor accident, cosmetic damage only',
    estimated_cost: 4200000,
    final_cost: null,
    drop_off_days_ago: 10,
    pickup_days_ago: null,
  },
  {
    mileage_in: 14950,
    mileage_out: null,
    status: 'in_progress',
    priority: 'high',
    description: 'Desmo service 15,000km',
    customer_demand: 'Desmo service due',
    estimated_cost: 12000000,
    final_cost: null,
    drop_off_days_ago: 3,
    pickup_days_ago: null,
  },
  {
    mileage_in: 6540,
    mileage_out: 6560,
    status: 'delivered',
    priority: 'normal',
    description: 'Custom exhaust and tuning - Vance & Hines',
    customer_demand: 'Wants louder sound and more torque',
    estimated_cost: 22000000,
    final_cost: 21800000,
    drop_off_days_ago: 18,
    pickup_days_ago: 13,
  },
  {
    mileage_in: 3200,
    mileage_out: 3220,
    status: 'ready_for_pickup',
    priority: 'normal',
    description: 'Café racer customization',
    customer_demand: 'Cafe racer styling upgrades',
    estimated_cost: 5500000,
    final_cost: 5420000,
    drop_off_days_ago: 8,
    pickup_days_ago: null,
  },
  {
    mileage_in: 8100,
    mileage_out: null,
    status: 'confirmed',
    priority: 'normal',
    description: 'Quick service package',
    customer_demand: 'Quick service before weekend ride',
    estimated_cost: 2800000,
    final_cost: null,
    drop_off_days_ago: -1,
    pickup_days_ago: null,
  },
  {
    mileage_in: 12300,
    mileage_out: null,
    status: 'in_progress',
    priority: 'high',
    description: 'Custom parts installation - Öhlins suspension upgrade',
    customer_demand: 'Adventure touring upgrades',
    estimated_cost: 15500000,
    final_cost: null,
    drop_off_days_ago: 4,
    pickup_days_ago: null,
  },
  {
    mileage_in: 5000,
    mileage_out: null,
    status: 'pending',
    priority: 'low',
    description: 'Oil change and basic inspection',
    customer_demand: 'Routine maintenance',
    estimated_cost: 1800000,
    final_cost: null,
    drop_off_days_ago: -3,
    pickup_days_ago: null,
  },
];

async function seedData() {
  console.log('🌱 Seeding customers, bikes, and service orders...\n');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await supabase.from('service_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('bikes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Step 1: Insert customers
  console.log('\n👥 Creating customers...');
  const { data: customersData, error: customersError } = await supabase
    .from('customers')
    .insert(customers)
    .select();

  if (customersError) {
    console.error('❌ Error creating customers:', customersError);
    return;
  }

  console.log(`✅ Created ${customersData.length} customers`);

  // Step 2: Insert bikes (one per customer)
  console.log('\n🏍️  Creating bikes...');
  const bikesWithOwners = bikes.map((bike, index) => ({
    ...bike,
    owner_id: customersData[index].id,
  }));

  const { data: bikesData, error: bikesError } = await supabase
    .from('bikes')
    .insert(bikesWithOwners)
    .select();

  if (bikesError) {
    console.error('❌ Error creating bikes:', bikesError);
    return;
  }

  console.log(`✅ Created ${bikesData.length} bikes`);

  // Step 3: Get a technician to assign
  const { data: technicians } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('role', 'technician')
    .limit(1);

  const technicianId = technicians?.[0]?.id;

  if (!technicianId) {
    console.warn('⚠️  No technician found. Service orders will be created without assigned employee.');
  }

  // Step 4: Insert service orders (one per bike)
  console.log('\n📋 Creating service orders...');
  const serviceOrdersWithBikes = serviceOrders.map((order, index) => {
    const bike = bikesData[index];
    const dropOffDate = new Date();
    dropOffDate.setDate(dropOffDate.getDate() - order.drop_off_days_ago);

    const estimatedCompletionDate = new Date(dropOffDate);
    estimatedCompletionDate.setDate(
      estimatedCompletionDate.getDate() + (order.drop_off_days_ago > 0 ? 2 : 1),
    );

    const actualCompletionDate =
      order.status === 'delivered' || order.status === 'quality_check'
        ? new Date(dropOffDate.getTime() + 24 * 60 * 60 * 1000)
        : null;

    const pickupDate = order.pickup_days_ago
      ? new Date(Date.now() - order.pickup_days_ago * 24 * 60 * 60 * 1000)
      : null;

    return {
      motorcycle_id: bike.id,
      customer_id: bike.owner_id,
      assigned_employee_id: technicianId || null,
      status: order.status,
      priority: order.priority,
      description: order.description,
      customer_demand: order.customer_demand,
      mileage_in: order.mileage_in,
      mileage_out: order.mileage_out,
      drop_off_date: dropOffDate.toISOString(),
      estimated_completion_date: estimatedCompletionDate.toISOString(),
      actual_completion_date: actualCompletionDate?.toISOString() || null,
      pickup_date: pickupDate?.toISOString() || null,
      estimated_cost: order.estimated_cost,
      final_cost: order.final_cost,
    };
  });

  const { data: ordersData, error: ordersError } = await supabase
    .from('service_orders')
    .insert(serviceOrdersWithBikes)
    .select();

  if (ordersError) {
    console.error('❌ Error creating service orders:', ordersError);
    return;
  }

  console.log(`✅ Created ${ordersData.length} service orders`);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   • Customers: ${customersData.length}`);
  console.log(`   • Bikes: ${bikesData.length}`);
  console.log(`   • Service Orders: ${ordersData.length}`);

  // Show service orders by status
  const statusCounts = ordersData.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log('\n📈 Service Orders by Status:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   • ${status}: ${count}`);
  });

  console.log('\n✨ Seeding completed successfully!');
}

seedData().catch(console.error);
