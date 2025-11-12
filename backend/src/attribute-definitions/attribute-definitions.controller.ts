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
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AttributeDefinitionsService } from './attribute-definitions.service';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Attribute Definitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attribute-definitions')
export class AttributeDefinitionsController {
  constructor(
    private readonly attributeDefinitionsService: AttributeDefinitionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all attribute definitions' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive attributes',
  })
  @ApiResponse({
    status: 200,
    description: 'List of attribute definitions',
  })
  findAll(
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ) {
    return this.attributeDefinitionsService.findAll(includeInactive);
  }

  @Get('variant')
  @ApiOperation({
    summary: 'Get variant attributes',
    description: 'Get all attributes used for product variant generation',
  })
  @ApiResponse({
    status: 200,
    description: 'List of variant attributes',
  })
  findVariantAttributes() {
    return this.attributeDefinitionsService.findVariantAttributes();
  }

  @Get('filterable')
  @ApiOperation({
    summary: 'Get filterable attributes',
    description: 'Get all attributes that can be used for product filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'List of filterable attributes',
  })
  findFilterableAttributes() {
    return this.attributeDefinitionsService.findFilterableAttributes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attribute definition by ID' })
  @ApiResponse({
    status: 200,
    description: 'Attribute definition found',
  })
  @ApiResponse({
    status: 404,
    description: 'Attribute definition not found',
  })
  findOne(@Param('id') id: string) {
    return this.attributeDefinitionsService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get attribute definition by slug' })
  @ApiResponse({
    status: 200,
    description: 'Attribute definition found',
  })
  @ApiResponse({
    status: 404,
    description: 'Attribute definition not found',
  })
  findBySlug(@Param('slug') slug: string) {
    return this.attributeDefinitionsService.findBySlug(slug);
  }

  @Post()
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Create new attribute definition',
    description: 'Only managers and admins can create attribute definitions',
  })
  @ApiResponse({
    status: 201,
    description: 'Attribute definition created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Attribute with this slug already exists',
  })
  create(@Body() createDto: CreateAttributeDefinitionDto) {
    return this.attributeDefinitionsService.create(createDto);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Update attribute definition',
    description: 'Only managers and admins can update attribute definitions',
  })
  @ApiResponse({
    status: 200,
    description: 'Attribute definition updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Attribute definition not found',
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAttributeDefinitionDto,
  ) {
    return this.attributeDefinitionsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Soft delete attribute definition',
    description:
      'Only managers and admins can delete attribute definitions. This is a soft delete.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attribute definition deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Attribute definition not found',
  })
  remove(@Param('id') id: string) {
    return this.attributeDefinitionsService.remove(id);
  }

  @Delete(':id/hard')
  @Roles('admin')
  @ApiOperation({
    summary: 'Hard delete attribute definition',
    description:
      'Only admins can hard delete. This permanently removes the attribute definition.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attribute definition permanently deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete - attribute is in use',
  })
  @ApiResponse({
    status: 404,
    description: 'Attribute definition not found',
  })
  hardDelete(@Param('id') id: string) {
    return this.attributeDefinitionsService.hardDelete(id);
  }

  @Post('reorder')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Reorder attribute definitions',
    description: 'Update display order of multiple attributes at once',
  })
  @ApiResponse({
    status: 200,
    description: 'Attributes reordered successfully',
  })
  reorder(@Body() orderMap: Record<string, number>) {
    return this.attributeDefinitionsService.reorder(orderMap);
  }
}
