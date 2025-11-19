import { Command, CommandRunner } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@Command({
  name: 'seed:verify',
  description: 'Verify seed data in the database',
})
export class VerifySeedCommand extends CommandRunner {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run(): Promise<void> {
    console.log('🔍 Verifying seed data...\n');

    try {
      // Check customers using Prisma
      const customers = await this.prisma.customers.findMany({
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
      const bikes = await this.prisma.bikes.findMany({
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
      const orders = await this.prisma.service_orders.findMany({
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
        this.prisma.customers.count(),
        this.prisma.bikes.count(),
        this.prisma.service_orders.count(),
      ]);

      console.log(`   • Customers: ${customerCount}`);
      console.log(`   • Bikes: ${bikeCount}`);
      console.log(`   • Service Orders: ${orderCount}`);

      console.log('\n✅ Verification complete!');
    } catch (error) {
      console.error('❌ Error verifying seed data:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
