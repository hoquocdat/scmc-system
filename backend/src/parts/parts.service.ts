import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';

@Injectable()
export class PartsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.parts.findMany({
        orderBy: {
          name: 'asc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.parts.count(),
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
    const part = await this.prisma.parts.findUnique({
      where: { id },
    });

    if (!part) {
      throw new NotFoundException(`Part with ID ${id} not found`);
    }

    return part;
  }

  async findLowStock() {
    // Use raw SQL to find parts where quantity_in_stock <= minimum_stock_level
    return this.prisma.$queryRaw`
      SELECT * FROM parts
      WHERE quantity_in_stock <= minimum_stock_level
      ORDER BY quantity_in_stock ASC
    `;
  }

  async create(createPartDto: CreatePartDto) {
    return this.prisma.parts.create({
      data: {
        part_number: createPartDto.part_number || null,
        name: createPartDto.name,
        description: createPartDto.description || null,
        quantity_in_stock: createPartDto.quantity_in_stock,
        minimum_stock_level: createPartDto.minimum_stock_level,
        unit_cost: createPartDto.unit_cost || null,
        supplier_id: createPartDto.supplier || null,
      },
    });
  }

  async update(id: string, updatePartDto: UpdatePartDto) {
    await this.findOne(id);

    return this.prisma.parts.update({
      where: { id },
      data: {
        ...updatePartDto,
        supplier_id: updatePartDto.supplier,
        updated_at: new Date(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.parts.delete({
      where: { id },
    });

    return { message: 'Part deleted successfully' };
  }
}
