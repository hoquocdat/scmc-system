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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BikesService } from './bikes.service';
import { CreateBikeDto } from './dto/create-bike.dto';
import { UpdateBikeDto } from './dto/update-bike.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Bikes')
@ApiBearerAuth('JWT-auth')
@Controller('bikes')
@UseGuards(JwtAuthGuard)
export class BikesController {
  constructor(private readonly bikesService: BikesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bikes with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns paginated list of bikes' })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.bikesService.findAll(page || 1, limit || 10);
  }

  @Get('owner/:ownerId')
  @ApiOperation({ summary: 'Get all bikes by owner ID' })
  @ApiParam({ name: 'ownerId', description: 'Owner/Customer UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of bikes owned by customer' })
  async findByOwner(@Param('ownerId') ownerId: string) {
    return this.bikesService.findByOwner(ownerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bike by ID' })
  @ApiParam({ name: 'id', description: 'Bike UUID' })
  @ApiResponse({ status: 200, description: 'Returns bike details' })
  @ApiResponse({ status: 404, description: 'Bike not found' })
  async findOne(@Param('id') id: string) {
    return this.bikesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new bike' })
  @ApiResponse({ status: 201, description: 'Bike registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() createBikeDto: CreateBikeDto) {
    return this.bikesService.create(createBikeDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update bike by ID' })
  @ApiParam({ name: 'id', description: 'Bike UUID' })
  @ApiResponse({ status: 200, description: 'Bike updated successfully' })
  @ApiResponse({ status: 404, description: 'Bike not found' })
  async update(@Param('id') id: string, @Body() updateBikeDto: UpdateBikeDto) {
    return this.bikesService.update(id, updateBikeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete bike by ID' })
  @ApiParam({ name: 'id', description: 'Bike UUID' })
  @ApiResponse({ status: 200, description: 'Bike deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bike not found' })
  async remove(@Param('id') id: string) {
    return this.bikesService.remove(id);
  }

  @Post(':id/image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload bike image' })
  @ApiParam({ name: 'id', description: 'Bike UUID' })
  @ApiResponse({ status: 200, description: 'Image uploaded successfully' })
  async uploadImage(
    @Param('id') id: string,
    @Body() body: { file: string; mimeType: string },
  ) {
    const imageUrl = await this.bikesService.uploadImage(
      id,
      body.file,
      body.mimeType,
    );
    return { imageUrl };
  }

  @Delete(':id/image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete bike image' })
  @ApiParam({ name: 'id', description: 'Bike UUID' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  async deleteImage(@Param('id') id: string) {
    await this.bikesService.deleteImage(id);
    return { message: 'Image deleted successfully' };
  }
}
