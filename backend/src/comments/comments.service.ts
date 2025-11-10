import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(createCommentDto: CreateCommentDto, userId: string) {
    return this.prisma.service_order_comments.create({
      data: {
        service_order_id: createCommentDto.service_order_id,
        user_id: userId,
        comment_text: createCommentDto.comment_text,
      },
    });
  }

  async findAllByServiceOrder(serviceOrderId: string) {
    return this.prisma.service_order_comments.findMany({
      where: { service_order_id: serviceOrderId },
      include: {
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const comment = await this.prisma.service_order_comments.findUnique({
      where: { id },
      include: {
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    return comment;
  }

  async update(id: string, updateCommentDto: UpdateCommentDto, userId: string) {
    // First, check if the comment exists and belongs to the user
    const comment = await this.findOne(id);

    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    return this.prisma.service_order_comments.update({
      where: { id },
      data: {
        comment_text: updateCommentDto.comment_text,
        updated_at: new Date(),
      },
    });
  }

  async remove(id: string, userId: string) {
    // First, check if the comment exists and belongs to the user
    const comment = await this.findOne(id);

    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.service_order_comments.delete({
      where: { id },
    });

    return { message: 'Comment deleted successfully' };
  }
}
