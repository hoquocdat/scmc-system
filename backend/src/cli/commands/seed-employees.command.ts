import { Command, CommandRunner } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { user_role } from '@prisma/client';

interface Employee {
  full_name: string;
  email: string;
  phone: string;
  role: user_role;
  password: string;
}

@Injectable()
@Command({
  name: 'seed:employees',
  description: 'Seed employee data with predefined users',
})
export class SeedEmployeesCommand extends CommandRunner {
  private supabase: SupabaseClient;

  private readonly employees: Employee[] = [
    // Technicians
    {
      full_name: 'Khánh Gara',
      email: 'khanhgara@saigonclassic.com',
      phone: '0901234567',
      role: 'technician',
      password: '123456',
    },
    {
      full_name: 'Đen',
      email: 'den@saigonclassic.com',
      phone: '0901234568',
      role: 'technician',
      password: '123456',
    },
    {
      full_name: 'Lê Hoàng Cường',
      email: 'technician3@saigonclassic.com',
      phone: '0901234569',
      role: 'technician',
      password: '123456',
    },
    {
      full_name: 'Phạm Đức Dũng',
      email: 'technician4@saigonclassic.com',
      phone: '0901234570',
      role: 'technician',
      password: '123456',
    },
    {
      full_name: 'Võ Thành Đạt',
      email: 'technician5@saigonclassic.com',
      phone: '0901234571',
      role: 'technician',
      password: '123456',
    },
    // Sales Staff
    {
      full_name: 'Hoàng Thị Lan',
      email: 'sales1@saigonclassic.com',
      phone: '0902345678',
      role: 'sales',
      password: 'sales123',
    },
    {
      full_name: 'Luân',
      email: 'luan@saigonclassic.com',
      phone: '0902345679',
      role: 'sales',
      password: '123456',
    },
    // Manager
    {
      full_name: 'Tom Hoàng',
      email: 'manager2@saigonclassic.com',
      phone: '0903456789',
      role: 'manager',
      password: '123456',
    },
    // Finance
    {
      full_name: 'doanh',
      email: 'finance@saigonclassic.com',
      phone: '0904567890',
      role: 'manager',
      password: '123456',
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();

    // Initialize Supabase client for Auth
    const supabaseUrl = this.config.get<string>('SUPABASE_URL') || 'http://127.0.0.1:54321';
    const supabaseServiceKey =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async run(): Promise<void> {
    console.log('🌱 Seeding employees...\n');

    try {
      for (const employee of this.employees) {
        // First, create auth user via Supabase Auth
        const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
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
          await this.prisma.user_profiles.upsert({
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
          console.log(
            `✅ Created ${employee.full_name} (${employee.role}) - ${employee.email}:${employee.password}`,
          );
        } catch (profileError: any) {
          console.error(`❌ Error creating profile for ${employee.full_name}:`, profileError.message);
        }
      }

      // Display all employees using Prisma
      console.log('\n📋 All Employees:');
      const allEmployees = await this.prisma.user_profiles.findMany({
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          is_active: true,
        },
        orderBy: [{ role: 'asc' }, { full_name: 'asc' }],
      });

      console.table(allEmployees);
      console.log('\n✨ Done!');
    } catch (error) {
      console.error('\n❌ Error seeding employees:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
