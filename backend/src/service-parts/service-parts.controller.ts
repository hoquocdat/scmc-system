import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ServicePartsService } from './service-parts.service';
import { CreateServicePartDto } from './dto/create-service-part.dto';
import { UpdateServicePartDto } from './dto/update-service-part.dto';

@Controller('service-parts')
export class ServicePartsController {
  constructor(private readonly servicePartsService: ServicePartsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createServicePartDto: CreateServicePartDto) {
    return this.servicePartsService.create(createServicePartDto);
  }

  @Get()
  findAll(@Query('service_order_id') serviceOrderId?: string) {
    return this.servicePartsService.findAll(serviceOrderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicePartsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateServicePartDto: UpdateServicePartDto) {
    return this.servicePartsService.update(id, updateServicePartDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.servicePartsService.remove(id);
  }
}
