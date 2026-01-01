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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockLocationsService } from './stock-locations.service';
import { CreateStockLocationDto } from './dto/create-stock-location.dto';
import { UpdateStockLocationDto } from './dto/update-stock-location.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('stock-locations')
@Controller('stock-locations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StockLocationsController {
  constructor(private readonly stockLocationsService: StockLocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock locations' })
  findAll() {
    return this.stockLocationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a stock location by ID' })
  findOne(@Param('id') id: string) {
    return this.stockLocationsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new stock location' })
  create(@Body() dto: CreateStockLocationDto) {
    return this.stockLocationsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a stock location' })
  update(@Param('id') id: string, @Body() dto: UpdateStockLocationDto) {
    return this.stockLocationsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a stock location' })
  remove(@Param('id') id: string) {
    return this.stockLocationsService.remove(id);
  }
}
