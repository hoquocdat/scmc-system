import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBikeDto } from './dto/create-bike.dto';
import { UpdateBikeDto } from './dto/update-bike.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class BikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.bikes.findMany({
        include: {
          customers: {
            select: {
              id: true,
              full_name: true,
              phone: true,
              email: true,
              address: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.bikes.count(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async findOne(id: string) {
    const bike = await this.prisma.bikes.findUnique({
      where: { id },
    });

    if (!bike) {
      throw new NotFoundException(`Bike with ID ${id} not found`);
    }

    return bike;
  }

  async findByOwner(ownerId: string) {
    const bikes = await this.prisma.bikes.findMany({
      where: { owner_id: ownerId },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Fetch all images for these bikes
    const bikeIds = bikes.map((bike) => bike.id);
    const images = await this.prisma.images.findMany({
      where: {
        entity_type: 'bike',
        entity_id: { in: bikeIds },
      },
      orderBy: [
        { is_primary: 'desc' },
        { display_order: 'asc' },
        { created_at: 'asc' },
      ],
    });

    // Group images by bike ID
    const imagesByBike = images.reduce((acc, img) => {
      if (!acc[img.entity_id]) {
        acc[img.entity_id] = [];
      }
      acc[img.entity_id].push(img);
      return acc;
    }, {} as Record<string, typeof images>);

    // Transform the response to include image_url and image_urls
    return bikes.map((bike) => {
      const bikeImages = imagesByBike[bike.id] || [];
      const imageUrls = bikeImages.map((img) => img.public_url);
      const primaryImage = bikeImages.find((img) => img.is_primary);

      return {
        ...bike,
        image_url: primaryImage?.public_url || imageUrls[0] || null,
        image_urls: imageUrls,
      };
    });
  }

  async create(createBikeDto: CreateBikeDto) {
    return this.prisma.bikes.create({
      data: {
        owner_id: createBikeDto.owner_id,
        brand: createBikeDto.brand,
        model: createBikeDto.model,
        year: createBikeDto.year || null,
        license_plate: createBikeDto.license_plate,
        vin: createBikeDto.vin || null,
        engine_number: createBikeDto.engine_number || null,
        color: createBikeDto.color || null,
        notes: createBikeDto.notes || null,
      },
    });
  }

  async update(id: string, updateBikeDto: UpdateBikeDto) {
    // First check if bike exists
    await this.findOne(id);

    return this.prisma.bikes.update({
      where: { id },
      data: {
        ...updateBikeDto,
        updated_at: new Date(),
      },
    });
  }

  async remove(id: string) {
    // First check if bike exists
    const bike = await this.findOne(id);

    // Delete image from storage if exists
    if (bike.image_url) {
      try {
        await this.storageService.deleteFile(bike.image_url, 'bikes');
      } catch (error) {
        console.warn('Failed to delete bike image:', error);
      }
    }

    await this.prisma.bikes.delete({
      where: { id },
    });

    return { message: 'Bike deleted successfully' };
  }

  async uploadImage(
    id: string,
    file: Buffer | string,
    mimeType: string,
  ): Promise<string> {
    // Check if bike exists
    const bike = await this.findOne(id);

    // Upload new image (or replace existing)
    const imageUrl = bike.image_url
      ? await this.storageService.replaceFile(
          bike.image_url,
          file,
          'bikes',
          mimeType,
        )
      : await this.storageService.uploadFile(file, 'bikes', mimeType);

    // Update bike record with image URL
    await this.prisma.bikes.update({
      where: { id },
      data: {
        image_url: imageUrl,
        updated_at: new Date(),
      },
    });

    return imageUrl;
  }

  async deleteImage(id: string): Promise<void> {
    // Check if bike exists
    const bike = await this.findOne(id);

    if (!bike.image_url) {
      throw new NotFoundException('Bike does not have an image');
    }

    // Delete image from storage
    await this.storageService.deleteFile(bike.image_url, 'bikes');

    // Update bike record to remove image URL
    await this.prisma.bikes.update({
      where: { id },
      data: {
        image_url: null,
        updated_at: new Date(),
      },
    });
  }
}
