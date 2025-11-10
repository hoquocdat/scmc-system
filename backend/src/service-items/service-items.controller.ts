import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ServiceItemsService } from './service-items.service';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { UpdateServiceItemDto } from './dto/update-service-item.dto';

@Controller('service-items')
export class ServiceItemsController {
  constructor(private readonly serviceItemsService: ServiceItemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createServiceItemDto: CreateServiceItemDto) {
    return this.serviceItemsService.create(createServiceItemDto);
  }

  @Get()
  findAll(@Query('service_order_id') serviceOrderId?: string) {
    return this.serviceItemsService.findAll(serviceOrderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceItemsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateServiceItemDto: UpdateServiceItemDto) {
    return this.serviceItemsService.update(id, updateServiceItemDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.serviceItemsService.remove(id);
  }
}
