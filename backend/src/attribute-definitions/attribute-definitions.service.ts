import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AttributeDefinitionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all attribute definitions
   */
  async findAll(includeInactive = false) {
    const where: Prisma.attribute_definitionsWhereInput = {};

    if (!includeInactive) {
      where.is_active = true;
    }

    return this.prisma.attribute_definitions.findMany({
      where,
      orderBy: { display_order: 'asc' },
    });
  }

  /**
   * Get all variant attributes (used for product variant generation)
   */
  async findVariantAttributes() {
    return this.prisma.attribute_definitions.findMany({
      where: {
        is_active: true,
        is_variant_attribute: true,
      },
      orderBy: { display_order: 'asc' },
    });
  }

  /**
   * Get all filterable attributes (used for product filtering UI)
   */
  async findFilterableAttributes() {
    return this.prisma.attribute_definitions.findMany({
      where: {
        is_active: true,
        is_filterable: true,
      },
      orderBy: { display_order: 'asc' },
    });
  }

  /**
   * Get single attribute definition by ID
   */
  async findOne(id: string) {
    const attribute = await this.prisma.attribute_definitions.findUnique({
      where: { id },
    });

    if (!attribute) {
      throw new NotFoundException(
        `Attribute definition with ID ${id} not found`,
      );
    }

    return attribute;
  }

  /**
   * Get attribute definition by slug
   */
  async findBySlug(slug: string) {
    const attribute = await this.prisma.attribute_definitions.findUnique({
      where: { slug },
    });

    if (!attribute) {
      throw new NotFoundException(
        `Attribute definition with slug "${slug}" not found`,
      );
    }

    return attribute;
  }

  /**
   * Create new attribute definition
   */
  async create(createDto: CreateAttributeDefinitionDto) {
    // Check if slug already exists
    const existing = await this.prisma.attribute_definitions.findUnique({
      where: { slug: createDto.slug },
    });

    if (existing) {
      throw new ConflictException(
        `Attribute definition with slug "${createDto.slug}" already exists`,
      );
    }

    // Validate options based on input_type
    this.validateOptions(createDto);

    // Create the attribute definition
    return this.prisma.attribute_definitions.create({
      data: {
        name: createDto.name,
        slug: createDto.slug,
        description: createDto.description,
        input_type: createDto.input_type || 'select',
        data_type: createDto.data_type || 'string',
        is_variant_attribute: createDto.is_variant_attribute ?? true,
        is_filterable: createDto.is_filterable ?? true,
        is_required: createDto.is_required ?? false,
        options: createDto.options
          ? (createDto.options as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        validation_rules: createDto.validation_rules
          ? (createDto.validation_rules as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        display_order: createDto.display_order ?? 0,
        icon: createDto.icon,
        help_text: createDto.help_text,
        is_active: createDto.is_active ?? true,
      },
    });
  }

  /**
   * Update attribute definition
   */
  async update(id: string, updateDto: UpdateAttributeDefinitionDto) {
    // Check if attribute exists
    await this.findOne(id);

    // If updating slug, check for conflicts
    if (updateDto.slug) {
      const existing = await this.prisma.attribute_definitions.findFirst({
        where: {
          slug: updateDto.slug,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Attribute definition with slug "${updateDto.slug}" already exists`,
        );
      }
    }

    // Validate options if provided
    if (updateDto.options || updateDto.input_type) {
      this.validateOptions(updateDto);
    }

    // Update the attribute definition
    return this.prisma.attribute_definitions.update({
      where: { id },
      data: {
        name: updateDto.name,
        slug: updateDto.slug,
        description: updateDto.description,
        input_type: updateDto.input_type,
        data_type: updateDto.data_type,
        is_variant_attribute: updateDto.is_variant_attribute,
        is_filterable: updateDto.is_filterable,
        is_required: updateDto.is_required,
        options: updateDto.options
          ? (updateDto.options as unknown as Prisma.InputJsonValue)
          : undefined,
        validation_rules: updateDto.validation_rules
          ? (updateDto.validation_rules as unknown as Prisma.InputJsonValue)
          : undefined,
        display_order: updateDto.display_order,
        icon: updateDto.icon,
        help_text: updateDto.help_text,
        is_active: updateDto.is_active,
      },
    });
  }

  /**
   * Delete (soft delete) attribute definition
   */
  async remove(id: string) {
    // Check if attribute exists
    await this.findOne(id);

    // Soft delete by setting is_active to false
    return this.prisma.attribute_definitions.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * Hard delete attribute definition (use with caution)
   */
  async hardDelete(id: string) {
    // Check if attribute exists
    await this.findOne(id);

    // Check if any products are using this attribute
    const productsWithAttribute = await this.prisma.products.count({
      where: {
        attributes: {
          path: [id],
          not: Prisma.AnyNull,
        },
      },
    });

    if (productsWithAttribute > 0) {
      throw new BadRequestException(
        `Cannot delete attribute definition. ${productsWithAttribute} product(s) are using this attribute.`,
      );
    }

    // Hard delete
    return this.prisma.attribute_definitions.delete({
      where: { id },
    });
  }

  /**
   * Validate options based on input_type
   */
  private validateOptions(
    dto: CreateAttributeDefinitionDto | UpdateAttributeDefinitionDto,
  ) {
    const inputType = dto.input_type;
    const options = dto.options;

    // Select and multiselect must have options
    if (
      (inputType === 'select' || inputType === 'multiselect') &&
      (!options || options.length === 0)
    ) {
      throw new BadRequestException(
        `Options are required for input type "${inputType}"`,
      );
    }

    // Color type must have color_code in options
    if (inputType === 'color' && options && options.length > 0) {
      const missingColorCode = options.some((opt) => !opt.color_code);
      if (missingColorCode) {
        throw new BadRequestException(
          'All color options must have a "color_code" field',
        );
      }
    }
  }

  /**
   * Reorder attribute definitions
   */
  async reorder(orderMap: Record<string, number>) {
    const updates = Object.entries(orderMap).map(([id, order]) =>
      this.prisma.attribute_definitions.update({
        where: { id },
        data: { display_order: order },
      }),
    );

    await this.prisma.$transaction(updates);

    return { message: 'Attribute definitions reordered successfully' };
  }
}
