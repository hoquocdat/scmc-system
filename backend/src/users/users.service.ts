import { Injectable, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Initialize Supabase client for auth operations only
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.user_profiles.findMany({
        orderBy: {
          full_name: 'asc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.user_profiles.count(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async findTechnicians() {
    return this.prisma.user_profiles.findMany({
      where: {
        role: 'technician',
        is_active: true,
      },
      orderBy: {
        full_name: 'asc',
      },
    });
  }

  async findEmployees() {
    return this.prisma.user_profiles.findMany({
      orderBy: [
        { role: 'asc' },
        { full_name: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user_profiles.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    // Create auth user using Supabase Auth
    const { data: authData, error: authError } = await supabaseAuth.auth.admin.createUser({
      email: createUserDto.email,
      password: createUserDto.password,
      email_confirm: true,
      user_metadata: {
        full_name: createUserDto.full_name,
        phone: createUserDto.phone || null,
        role: createUserDto.role,
      },
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('Failed to create user account');

    // Insert user profile using Prisma
    return this.prisma.user_profiles.create({
      data: {
        id: authData.user.id,
        full_name: createUserDto.full_name,
        email: createUserDto.email,
        phone: createUserDto.phone || null,
        role: createUserDto.role,
        is_active: createUserDto.is_active !== undefined ? createUserDto.is_active : true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    return this.prisma.user_profiles.update({
      where: { id },
      data: {
        ...updateUserDto,
        updated_at: new Date(),
      },
    });
  }

  async toggleActive(id: string) {
    const user = await this.findOne(id);

    return this.prisma.user_profiles.update({
      where: { id },
      data: {
        is_active: !user.is_active,
        updated_at: new Date(),
      },
    });
  }

  async updatePassword(id: string, newPassword: string) {
    // Verify user exists
    await this.findOne(id);

    // Update password in Supabase Auth
    const { data, error } = await supabaseAuth.auth.admin.updateUserById(id, {
      password: newPassword,
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Failed to update password');

    return { message: 'Password updated successfully' };
  }
}
