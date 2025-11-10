import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PartsService } from './parts.service';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('parts')
@UseGuards(JwtAuthGuard)
export class PartsController {
  constructor(private readonly partsService: PartsService) {}

  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.partsService.findAll(page || 1, limit || 10);
  }

  @Get('low-stock')
  async findLowStock() {
    return this.partsService.findLowStock();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.partsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPartDto: CreatePartDto) {
    return this.partsService.create(createPartDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updatePartDto: UpdatePartDto) {
    return this.partsService.update(id, updatePartDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.partsService.remove(id);
  }
}
