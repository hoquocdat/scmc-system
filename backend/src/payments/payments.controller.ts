import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.paymentsService.findAll(page || 1, limit || 10);
  }

  @Get('outstanding')
  async findOutstanding() {
    return this.paymentsService.findOutstanding();
  }

  @Get('order/:orderId')
  async findByServiceOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.findByServiceOrder(orderId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
