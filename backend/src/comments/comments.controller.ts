import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetCurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.decorator';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(
    @Body() createCommentDto: CreateCommentDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.commentsService.create(createCommentDto, user.id);
  }

  @Get('service-order/:serviceOrderId')
  findAllByServiceOrder(@Param('serviceOrderId') serviceOrderId: string) {
    return this.commentsService.findAllByServiceOrder(serviceOrderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.commentsService.update(id, updateCommentDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetCurrentUser() user: CurrentUser) {
    return this.commentsService.remove(id, user.id);
  }
}
