import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerGroupDto,
  UpdateCustomerGroupDto,
} from './dto/price-books.dto';

/** Customer groups and memberships (spec customers/customer-groups). */
@Injectable()
export class CustomerGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const groups = await this.prisma.customer_groups.findMany({
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            customer_group_members: true,
            price_book_customer_groups: true,
          },
        },
      },
    });
    return groups.map(({ _count, ...g }) => ({
      ...g,
      member_count: _count.customer_group_members,
      price_book_count: _count.price_book_customer_groups,
    }));
  }

  async create(actorId: string, dto: CreateCustomerGroupDto) {
    try {
      return await this.prisma.customer_groups.create({
        data: { ...dto, created_by: actorId },
      });
    } catch (e) {
      throw duplicate(e, `Mã nhóm ${dto.code} đã tồn tại`);
    }
  }

  async update(id: string, dto: UpdateCustomerGroupDto) {
    await this.get(id);
    return this.prisma.customer_groups.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
    });
  }

  /** Refused while the group has members or a price book targets it; deactivate instead. */
  async remove(id: string) {
    await this.get(id);
    const [members, books] = await Promise.all([
      this.prisma.customer_group_members.count({ where: { group_id: id } }),
      this.prisma.price_book_customer_groups.count({ where: { group_id: id } }),
    ]);
    if (members || books)
      throw new ConflictException(
        `Nhóm đang có ${members} khách hàng và ${books} bảng giá; hãy ngừng sử dụng thay vì xóa`,
      );
    await this.prisma.customer_groups.delete({ where: { id } });
    return { id };
  }

  async groupsOf(customerId: string) {
    const rows = await this.prisma.customer_group_members.findMany({
      where: { customer_id: customerId },
      include: { customer_groups: true },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => r.customer_groups);
  }

  async setGroupsOf(customerId: string, groupIds: string[]) {
    const customer = await this.prisma.customers.findFirst({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    const ids = [...new Set(groupIds)];
    const found = await this.prisma.customer_groups.count({
      where: { id: { in: ids } },
    });
    if (found !== ids.length)
      throw new NotFoundException('Có nhóm khách hàng không tồn tại');
    await this.prisma.$transaction([
      this.prisma.customer_group_members.deleteMany({
        where: { customer_id: customerId, group_id: { notIn: ids } },
      }),
      this.prisma.customer_group_members.createMany({
        data: ids.map((group_id) => ({ customer_id: customerId, group_id })),
        skipDuplicates: true,
      }),
    ]);
    return this.groupsOf(customerId);
  }

  private async get(id: string) {
    const g = await this.prisma.customer_groups.findFirst({ where: { id } });
    if (!g) throw new NotFoundException('Không tìm thấy nhóm khách hàng');
    return g;
  }
}

/** Unique violation → 409 with a readable message. */
export function duplicate(e: unknown, message: string): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
    return new ConflictException(message);
  return e;
}
