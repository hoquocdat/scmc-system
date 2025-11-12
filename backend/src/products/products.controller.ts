import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateMasterProductDto, FindVariantDto } from './dto/create-master-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('manager', 'store_manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Product with SKU already exists' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Roles('manager', 'store_manager', 'sales_associate', 'warehouse_staff')
  @ApiOperation({ summary: 'Get all products with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('low-stock')
  @Roles('manager', 'store_manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Get low stock products' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Low stock products retrieved successfully' })
  getLowStock(@Query('locationId') locationId?: string) {
    return this.productsService.getLowStockProducts(locationId);
  }

  @Get(':id')
  @Roles('manager', 'store_manager', 'sales_associate', 'warehouse_staff')
  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles('manager', 'store_manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Product with SKU already exists' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles('manager', 'store_manager')
  @ApiOperation({ summary: 'Soft delete a product (set is_active to false)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @Post('master-with-variants')
  @Roles('manager', 'store_manager')
  @ApiOperation({
    summary: 'Create master product with automatic variant generation',
    description:
      'Creates a master product and automatically generates all variant combinations based on provided attributes',
  })
  @ApiResponse({
    status: 201,
    description: 'Master product and variants created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Product with SKU already exists' })
  createMasterWithVariants(@Body() dto: CreateMasterProductDto) {
    return this.productsService.createMasterProductWithVariants(dto);
  }

  @Get(':id/variants')
  @Roles('manager', 'store_manager', 'sales_associate', 'warehouse_staff')
  @ApiOperation({ summary: 'Get all variants of a master product' })
  @ApiParam({ name: 'id', description: 'Master product UUID' })
  @ApiResponse({ status: 200, description: 'Variants retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Master product not found' })
  @ApiResponse({
    status: 400,
    description: 'Product is not a master product',
  })
  getVariants(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getVariants(id);
  }

  @Post(':id/find-variant')
  @Roles('manager', 'store_manager', 'sales_associate', 'warehouse_staff')
  @ApiOperation({
    summary: 'Find specific variant by attributes',
    description:
      'Searches for a specific variant of a master product based on attribute values',
  })
  @ApiParam({ name: 'id', description: 'Master product UUID' })
  @ApiResponse({ status: 200, description: 'Variant found' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  findVariantByAttributes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() findVariantDto: FindVariantDto,
  ) {
    return this.productsService.findVariantByAttributes(id, findVariantDto);
  }

  @Post('search-by-attributes')
  @Roles('manager', 'store_manager', 'sales_associate', 'warehouse_staff')
  @ApiOperation({
    summary: 'Search products by attributes',
    description: 'Find all products matching the specified attribute values',
  })
  @ApiResponse({ status: 200, description: 'Products found' })
  searchByAttributes(@Body() attributes: Record<string, any>) {
    return this.productsService.searchByAttributes(attributes);
  }
}
