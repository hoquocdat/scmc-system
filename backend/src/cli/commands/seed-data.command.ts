import { Command, CommandRunner } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface CustomerData {
  full_name: string;
  id_number: string;
  phone: string;
  email: string;
  address: string;
  notes: string | null;
}

interface BikeData {
  customerIndex: number;
  brand: string;
  model: string;
  year: number;
  license_plate: string;
  vin: string;
  engine_number: string;
  color: string;
  notes: string;
}

interface ServiceOrderData {
  bikeIndex: number;
  status: string;
  priority: string;
  description: string;
  customer_demand: string;
  mileage_in: number;
  mileage_out: number | null;
  estimated_cost: number;
  final_cost: number | null;
  drop_off_days_ago: number;
  pickup_days_ago: number | null;
}

@Injectable()
@Command({
  name: 'seed:data',
  description: 'Seed service data (customers, bikes, service orders)',
})
export class SeedDataCommand extends CommandRunner {
  private supabase: SupabaseClient;

  private readonly customers: CustomerData[] = [
    {
      full_name: 'Nguyễn Văn Thành',
      id_number: '079123456789',
      phone: '+84901234501',
      email: 'thanh.nguyen@gmail.com',
      address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
      notes: 'VIP customer - owns multiple bikes',
    },
    {
      full_name: 'Trần Minh Tuấn',
      id_number: '079234567890',
      phone: '+84901234502',
      email: 'tuan.tran@yahoo.com',
      address: '456 Lê Lợi, Quận 1, TP.HCM',
      notes: 'Prefers weekend appointments',
    },
    {
      full_name: 'Lê Hoàng Long',
      id_number: '079345678901',
      phone: '+84901234503',
      email: 'long.le@hotmail.com',
      address: '789 Hai Bà Trưng, Quận 3, TP.HCM',
      notes: 'Track day enthusiast',
    },
    {
      full_name: 'Phạm Đức Anh',
      id_number: '079456789012',
      phone: '+84901234504',
      email: 'anh.pham@gmail.com',
      address: '321 Võ Văn Tần, Quận 3, TP.HCM',
      notes: null,
    },
    {
      full_name: 'Hoàng Minh Khoa',
      id_number: '079567890123',
      phone: '+84901234505',
      email: 'khoa.hoang@outlook.com',
      address: '654 Trần Hưng Đạo, Quận 5, TP.HCM',
      notes: 'Racing modifications',
    },
    {
      full_name: 'Vũ Quang Huy',
      id_number: '079678901234',
      phone: '+84901234506',
      email: 'huy.vu@gmail.com',
      address: '987 Cách Mạng Tháng 8, Quận 10, TP.HCM',
      notes: null,
    },
    {
      full_name: 'Đỗ Thành Công',
      id_number: '079789012345',
      phone: '+84901234507',
      email: 'cong.do@yahoo.com',
      address: '147 Lý Thường Kiệt, Quận 10, TP.HCM',
      notes: 'Cafe racer builder',
    },
    {
      full_name: 'Bùi Văn Nam',
      id_number: '079890123456',
      phone: '+84901234508',
      email: 'nam.bui@gmail.com',
      address: '258 Điện Biên Phủ, Quận 3, TP.HCM',
      notes: null,
    },
    {
      full_name: 'Ngô Minh Tâm',
      id_number: '079901234567',
      phone: '+84901234509',
      email: 'tam.ngo@hotmail.com',
      address: '369 Cộng Hòa, Quận Tân Bình, TP.HCM',
      notes: 'Ducati collector',
    },
    {
      full_name: 'Trương Văn Đại',
      id_number: '079012345678',
      phone: '+84901234510',
      email: 'dai.truong@gmail.com',
      address: '741 Hoàng Văn Thụ, Quận Tân Bình, TP.HCM',
      notes: null,
    },
    {
      full_name: 'Lý Thanh Sơn',
      id_number: '079112345678',
      phone: '+84901234511',
      email: 'son.ly@outlook.com',
      address: '852 Phan Văn Trị, Quận Gò Vấp, TP.HCM',
      notes: 'BMW enthusiast',
    },
    {
      full_name: 'Phan Quốc Việt',
      id_number: '079212345678',
      phone: '+84901234512',
      email: 'viet.phan@gmail.com',
      address: '963 Võ Thị Sáu, Quận 3, TP.HCM',
      notes: 'Harley owner',
    },
    {
      full_name: 'Võ Minh Quân',
      id_number: '079312345678',
      phone: '+84901234513',
      email: 'quan.vo@gmail.com',
      address: '159 Nguyễn Đình Chiểu, Quận 3, TP.HCM',
      notes: 'Adventure touring',
    },
    {
      full_name: 'Đặng Hoàng Phúc',
      id_number: '079412345678',
      phone: '+84901234514',
      email: 'phuc.dang@yahoo.com',
      address: '753 Trường Chinh, Quận Tân Bình, TP.HCM',
      notes: null,
    },
    {
      full_name: 'Trịnh Văn Hải',
      id_number: '079512345678',
      phone: '+84901234515',
      email: 'hai.trinh@gmail.com',
      address: '951 Lê Văn Sỹ, Quận 3, TP.HCM',
      notes: 'Custom paint specialist',
    },
  ];

  private readonly bikesData: BikeData[] = [
    {
      customerIndex: 0,
      brand: 'Triumph',
      model: 'Bonneville T120',
      year: 2021,
      license_plate: '59A1-12345',
      vin: 'SMTB0T120ABC12345',
      engine_number: 'T120ENG12345',
      color: 'Jet Black',
      notes: 'Classic British twin',
    },
    {
      customerIndex: 1,
      brand: 'BMW',
      model: 'R1250GS Adventure',
      year: 2022,
      license_plate: '59A1-23456',
      vin: 'WB10AB020ABC12345',
      engine_number: 'R1250ENG23456',
      color: 'Racing Blue',
      notes: 'Adventure touring bike',
    },
    {
      customerIndex: 2,
      brand: 'Ducati',
      model: 'Panigale V4 S',
      year: 2023,
      license_plate: '59A1-34567',
      vin: 'ZDMH6B0W0AB123456',
      engine_number: 'V4SENG34567',
      color: 'Ducati Red',
      notes: 'Track-focused superbike',
    },
    {
      customerIndex: 3,
      brand: 'Triumph',
      model: 'Street Triple RS',
      year: 2022,
      license_plate: '59A1-45678',
      vin: 'SMTB0ST3ABC12346',
      engine_number: 'ST3ENG45678',
      color: 'Matte Silver Ice',
      notes: 'Naked sport bike',
    },
    {
      customerIndex: 4,
      brand: 'BMW',
      model: 'S1000RR',
      year: 2023,
      license_plate: '59A1-56789',
      vin: 'WB10AB020ABC12347',
      engine_number: 'S1000ENG56789',
      color: 'M Sport',
      notes: 'Racing exhaust installed',
    },
    {
      customerIndex: 5,
      brand: 'Triumph',
      model: 'Tiger 900 Rally Pro',
      year: 2021,
      license_plate: '59B1-12345',
      vin: 'SMTB0T90ABC12348',
      engine_number: 'T900ENG67890',
      color: 'Sapphire Black',
      notes: 'Adventure bike',
    },
    {
      customerIndex: 6,
      brand: 'Ducati',
      model: 'Monster 937',
      year: 2022,
      license_plate: '59A1-67890',
      vin: 'ZDMH6M93ABC12350',
      engine_number: 'M937ENG78901',
      color: 'Thrilling Black',
      notes: 'Naked street bike',
    },
    {
      customerIndex: 7,
      brand: 'Harley-Davidson',
      model: 'Street Bob 114',
      year: 2021,
      license_plate: '59A1-78901',
      vin: '1HD1LEY19AB123451',
      engine_number: 'HD114ENG89012',
      color: 'Vivid Black',
      notes: 'Custom pipes',
    },
    {
      customerIndex: 8,
      brand: 'Triumph',
      model: 'Thruxton RS',
      year: 2023,
      license_plate: '59A1-89012',
      vin: 'SMTB0THRABC12352',
      engine_number: 'THRXENG90123',
      color: 'Silver Ice & Diablo Red',
      notes: 'Cafe racer style',
    },
    {
      customerIndex: 9,
      brand: 'Ducati',
      model: 'Streetfighter V4',
      year: 2022,
      license_plate: '59A1-90123',
      vin: 'ZDMH6SF4ABC12353',
      engine_number: 'SF4ENG01234',
      color: 'Dark Stealth',
      notes: 'Aggressive naked bike',
    },
    {
      customerIndex: 10,
      brand: 'BMW',
      model: 'R nineT Scrambler',
      year: 2021,
      license_plate: '59B1-34567',
      vin: 'WB10AB020ABC12354',
      engine_number: 'R9TENG12345',
      color: 'Option 719',
      notes: 'Retro scrambler',
    },
    {
      customerIndex: 11,
      brand: 'Harley-Davidson',
      model: 'Fat Bob 114',
      year: 2022,
      license_plate: '59A1-91234',
      vin: '1HD1LEY20AB123452',
      engine_number: 'FBENG23456',
      color: 'Billiard Red',
      notes: 'Custom paint',
    },
    {
      customerIndex: 12,
      brand: 'BMW',
      model: 'F850GS Adventure',
      year: 2023,
      license_plate: '59A1-92345',
      vin: 'WB10AB020ABC12355',
      engine_number: 'F850ENG34567',
      color: 'Rallye',
      notes: 'Off-road capable',
    },
    {
      customerIndex: 13,
      brand: 'Ducati',
      model: 'Multistrada V4 S',
      year: 2023,
      license_plate: '59A1-93456',
      vin: 'ZDMH6MV4ABC12356',
      engine_number: 'MV4SENG45678',
      color: 'Aviator Grey',
      notes: 'Sport touring',
    },
    {
      customerIndex: 14,
      brand: 'Triumph',
      model: 'Scrambler 1200 XE',
      year: 2022,
      license_plate: '59A1-94567',
      vin: 'SMTB0SC12ABC12357',
      engine_number: 'SC12ENG56789',
      color: 'Sandstorm',
      notes: 'Adventure scrambler',
    },
  ];

  private readonly serviceOrdersData: ServiceOrderData[] = [
    {
      bikeIndex: 0,
      status: 'delivered',
      priority: 'normal',
      description: 'Regular maintenance - 12,000km service',
      customer_demand: 'No issues, just scheduled maintenance',
      mileage_in: 11950,
      mileage_out: 12020,
      estimated_cost: 3500000,
      final_cost: 3420000,
      drop_off_days_ago: 15,
      pickup_days_ago: 12,
    },
    {
      bikeIndex: 1,
      status: 'in_progress',
      priority: 'high',
      description: 'Tire replacement and wheel alignment',
      customer_demand: 'Tires worn out before long trip',
      mileage_in: 28500,
      mileage_out: null,
      estimated_cost: 8500000,
      final_cost: null,
      drop_off_days_ago: 2,
      pickup_days_ago: null,
    },
    {
      bikeIndex: 2,
      status: 'confirmed',
      priority: 'urgent',
      description: 'Pre-track day inspection and service',
      customer_demand: 'Track day preparation - check brakes, suspension, tires',
      mileage_in: 5280,
      mileage_out: null,
      estimated_cost: 5200000,
      final_cost: null,
      drop_off_days_ago: -2, // Future appointment
      pickup_days_ago: null,
    },
    {
      bikeIndex: 3,
      status: 'delivered',
      priority: 'normal',
      description: 'Exhaust system installation - Arrow Pro-Race titanium',
      customer_demand: 'Wants more power and better sound',
      mileage_in: 8920,
      mileage_out: 8940,
      estimated_cost: 18500000,
      final_cost: 18350000,
      drop_off_days_ago: 25,
      pickup_days_ago: 19,
    },
    {
      bikeIndex: 4,
      status: 'quality_check',
      priority: 'normal',
      description: 'Major service - 20,000km',
      customer_demand: 'Major service interval reached',
      mileage_in: 19980,
      mileage_out: 20005,
      estimated_cost: 6800000,
      final_cost: 6750000,
      drop_off_days_ago: 5,
      pickup_days_ago: null,
    },
    {
      bikeIndex: 5,
      status: 'waiting_parts',
      priority: 'normal',
      description: 'Crash bar replacement and cosmetic repair',
      customer_demand: 'Minor accident, cosmetic damage only',
      mileage_in: 15200,
      mileage_out: null,
      estimated_cost: 4200000,
      final_cost: null,
      drop_off_days_ago: 10,
      pickup_days_ago: null,
    },
    {
      bikeIndex: 6,
      status: 'in_progress',
      priority: 'high',
      description: 'Desmo service 15,000km',
      customer_demand: 'Desmo service due',
      mileage_in: 14950,
      mileage_out: null,
      estimated_cost: 12000000,
      final_cost: null,
      drop_off_days_ago: 3,
      pickup_days_ago: null,
    },
    {
      bikeIndex: 7,
      status: 'delivered',
      priority: 'normal',
      description: 'Custom exhaust and tuning - Vance & Hines',
      customer_demand: 'Wants louder sound and more torque',
      mileage_in: 6540,
      mileage_out: 6560,
      estimated_cost: 22000000,
      final_cost: 21800000,
      drop_off_days_ago: 18,
      pickup_days_ago: 13,
    },
    {
      bikeIndex: 8,
      status: 'ready_for_pickup',
      priority: 'normal',
      description: 'Café racer customization',
      customer_demand: 'Cafe racer styling upgrades - new seat, mirrors, handlebars',
      mileage_in: 3200,
      mileage_out: 3220,
      estimated_cost: 5500000,
      final_cost: 5420000,
      drop_off_days_ago: 8,
      pickup_days_ago: null,
    },
    {
      bikeIndex: 9,
      status: 'confirmed',
      priority: 'normal',
      description: 'Quick service package',
      customer_demand: 'Quick service before weekend ride',
      mileage_in: 8100,
      mileage_out: null,
      estimated_cost: 2800000,
      final_cost: null,
      drop_off_days_ago: -1, // Tomorrow
      pickup_days_ago: null,
    },
    {
      bikeIndex: 10,
      status: 'in_progress',
      priority: 'high',
      description: 'Custom parts installation - Öhlins suspension upgrade',
      customer_demand: 'Adventure touring upgrades',
      mileage_in: 12300,
      mileage_out: null,
      estimated_cost: 15500000,
      final_cost: null,
      drop_off_days_ago: 4,
      pickup_days_ago: null,
    },
    {
      bikeIndex: 11,
      status: 'pending',
      priority: 'low',
      description: 'Oil change and basic inspection',
      customer_demand: 'Routine maintenance',
      mileage_in: 5000,
      mileage_out: null,
      estimated_cost: 1800000,
      final_cost: null,
      drop_off_days_ago: -3, // 3 days from now
      pickup_days_ago: null,
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();

    // Initialize Supabase client
    const supabaseUrl = this.config.get<string>('SUPABASE_URL') || 'http://127.0.0.1:54321';
    const supabaseServiceKey =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async run(): Promise<void> {
    console.log('🌱 Seeding service data (customers, bikes, service orders)...\n');

    try {
      // Check if data already exists
      const { data: existingCustomers } = await this.supabase
        .from('customers')
        .select('phone')
        .in(
          'phone',
          this.customers.map((c) => c.phone),
        );

      if (existingCustomers && existingCustomers.length > 0) {
        console.log('⚠️  Data already exists in database!');
        console.log('   To re-seed, please delete existing data first:');
        console.log('   DELETE FROM service_orders;');
        console.log('   DELETE FROM bikes;');
        console.log('   DELETE FROM customers WHERE phone LIKE \'+8490123%\';');
        return;
      }

      // Step 1: Insert Customers
      console.log('📝 Creating customers...');
      const { data: createdCustomers, error: customersError } = await this.supabase
        .from('customers')
        .insert(this.customers)
        .select();

      if (customersError) {
        console.error('❌ Error creating customers:', customersError.message);
        return;
      }

      console.log(`✅ Created ${createdCustomers.length} customers`);

      // Step 2: Insert Bikes
      console.log('\n🏍️  Creating bikes...');
      const bikesToInsert = this.bikesData.map((bike) => ({
        owner_id: createdCustomers[bike.customerIndex].id,
        brand: bike.brand,
        model: bike.model,
        year: bike.year,
        license_plate: bike.license_plate,
        vin: bike.vin,
        engine_number: bike.engine_number,
        color: bike.color,
        notes: bike.notes,
      }));

      const { data: createdBikes, error: bikesError } = await this.supabase
        .from('bikes')
        .insert(bikesToInsert)
        .select();

      if (bikesError) {
        console.error('❌ Error creating bikes:', bikesError.message);
        return;
      }

      console.log(`✅ Created ${createdBikes.length} bikes`);

      // Step 3: Get a technician for service orders
      const { data: technicians, error: techError } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'technician')
        .limit(1);

      if (techError || !technicians || technicians.length === 0) {
        console.error('❌ No technicians found. Please run seed:employees first.');
        return;
      }

      const technicianId = technicians[0].id;

      // Step 4: Insert Service Orders
      console.log('\n🔧 Creating service orders...');
      const now = new Date();

      const serviceOrdersToInsert = this.serviceOrdersData.map((order) => {
        const bike = createdBikes[order.bikeIndex];
        const dropOffDate = new Date(now);
        dropOffDate.setDate(dropOffDate.getDate() - order.drop_off_days_ago);

        const estimatedCompletionDate = new Date(dropOffDate);
        estimatedCompletionDate.setDate(
          estimatedCompletionDate.getDate() + (order.drop_off_days_ago > 0 ? 2 : 1),
        );

        let actualCompletionDate: Date | null = null;
        if (['delivered', 'quality_check', 'ready_for_pickup'].includes(order.status)) {
          actualCompletionDate = new Date(dropOffDate);
          actualCompletionDate.setDate(actualCompletionDate.getDate() + 1);
        }

        let pickupDate: Date | null = null;
        if (order.pickup_days_ago !== null) {
          pickupDate = new Date(now);
          pickupDate.setDate(pickupDate.getDate() - order.pickup_days_ago);
        }

        return {
          motorcycle_id: bike.id,
          customer_id: bike.owner_id, // Customer is same as owner in this seed
          assigned_employee_id: technicianId,
          status: order.status,
          priority: order.priority,
          description: order.description,
          customer_demand: order.customer_demand,
          mileage_in: order.mileage_in,
          mileage_out: order.mileage_out,
          drop_off_date: dropOffDate.toISOString(),
          estimated_completion_date: estimatedCompletionDate.toISOString(),
          actual_completion_date: actualCompletionDate ? actualCompletionDate.toISOString() : null,
          pickup_date: pickupDate ? pickupDate.toISOString() : null,
          estimated_cost: order.estimated_cost,
          final_cost: order.final_cost,
        };
      });

      const { data: createdOrders, error: ordersError } = await this.supabase
        .from('service_orders')
        .insert(serviceOrdersToInsert)
        .select();

      if (ordersError) {
        console.error('❌ Error creating service orders:', ordersError.message);
        return;
      }

      console.log(`✅ Created ${createdOrders.length} service orders`);

      // Step 5: Display summary
      console.log('\n📊 Summary:');
      console.log('─'.repeat(50));

      const { data: customerCount } = await this.supabase
        .from('customers')
        .select('id', { count: 'exact', head: true });

      const { data: bikeCount } = await this.supabase
        .from('bikes')
        .select('id', { count: 'exact', head: true });

      const { data: orderCount } = await this.supabase
        .from('service_orders')
        .select('id', { count: 'exact', head: true });

      console.log(`Total Customers: ${customerCount?.length || 0}`);
      console.log(`Total Bikes: ${bikeCount?.length || 0}`);
      console.log(`Total Service Orders: ${orderCount?.length || 0}`);

      // Display service orders by status
      console.log('\n📋 Service Orders by Status:');
      const { data: ordersByStatus } = await this.supabase.from('service_orders').select('status');

      if (ordersByStatus) {
        const statusCounts: Record<string, number> = {};
        ordersByStatus.forEach((order) => {
          statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
        });

        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`  ${status}: ${count}`);
        });
      }

      // Calculate bikes in service (not delivered or cancelled)
      const { data: inServiceOrders } = await this.supabase
        .from('service_orders')
        .select('id')
        .not('status', 'in', '(delivered,cancelled)');

      console.log(`\n🔧 Bikes currently in service: ${inServiceOrders?.length || 0}`);

      console.log('\n✨ Done!');
    } catch (error) {
      console.error('❌ Error seeding service data:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
