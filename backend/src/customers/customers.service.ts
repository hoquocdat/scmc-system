import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.customers.findMany({
        include: {
          salesperson: {
            select: {
              id: true,
              full_name: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.customers.count(),
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

  async findOne(id: string) {
    const customer = await this.prisma.customers.findUnique({
      where: { id },
      include: {
        salesperson: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async checkPhoneAvailability(phone: string) {
    const existingCustomer = await this.prisma.customers.findFirst({
      where: { phone },
      select: { id: true },
    });

    return {
      available: !existingCustomer,
      phone: phone,
    };
  }

  async create(createCustomerDto: CreateCustomerDto) {
    // Check if phone number already exists
    const existingCustomer = await this.prisma.customers.findFirst({
      where: { phone: createCustomerDto.phone },
      select: { id: true, phone: true },
    });

    if (existingCustomer) {
      throw new ConflictException('Số điện thoại này đã được sử dụng bởi khách hàng khác');
    }

    return this.prisma.customers.create({
      data: {
        full_name: createCustomerDto.full_name,
        phone: createCustomerDto.phone,
        email: createCustomerDto.email || null,
        address: createCustomerDto.address || null,
        notes: createCustomerDto.notes || null,
        id_number: createCustomerDto.id_number || null,
        facebook: createCustomerDto.facebook || null,
        instagram: createCustomerDto.instagram || null,
        birthday: createCustomerDto.birthday || null,
        salesperson_id: createCustomerDto.salesperson_id || null,
      },
      include: {
        salesperson: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    // First check if customer exists
    await this.findOne(id);

    // Check if phone number is being updated and if it's already used by another customer
    if (updateCustomerDto.phone !== undefined) {
      const existingCustomer = await this.prisma.customers.findFirst({
        where: {
          phone: updateCustomerDto.phone,
          NOT: {
            id: id,
          },
        },
        select: { id: true, phone: true },
      });

      if (existingCustomer) {
        throw new ConflictException('Số điện thoại này đã được sử dụng bởi khách hàng khác');
      }
    }

    return this.prisma.customers.update({
      where: { id },
      data: {
        ...updateCustomerDto,
        updated_at: new Date(),
      },
      include: {
        salesperson: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    // First check if customer exists
    await this.findOne(id);

    await this.prisma.customers.delete({
      where: { id },
    });

    return { message: 'Customer deleted successfully' };
  }
}
