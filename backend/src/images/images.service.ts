import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateImageDto } from './dto/create-image.dto';
import { UpdateImageDto } from './dto/update-image.dto';
import { image_entity_type } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ImagesService {
  private supabase: SupabaseClient;

  constructor(private prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async create(createImageDto: CreateImageDto) {
    return this.prisma.images.create({
      data: createImageDto,
    });
  }

  async findByEntity(entityType: image_entity_type, entityId: string) {
    return this.prisma.images.findMany({
      where: {
        entity_type: entityType,
        entity_id: entityId,
      },
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  async uploadFiles(
    files: Express.Multer.File[],
    entityType: image_entity_type,
    entityId: string,
    uploadedBy?: string,
  ) {
    const uploadedImages: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${entityId}/${timestamp}-${randomString}.${fileExt}`;

      // Upload to Supabase Storage
      const { error } = await this.supabase.storage
        .from('bikes')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = this.supabase.storage.from('bikes').getPublicUrl(fileName);

      // Save to database
      const image = await this.create({
        entity_type: entityType,
        entity_id: entityId,
        file_path: fileName,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        storage_bucket: 'bikes',
        public_url: publicUrl,
        display_order: i,
        is_primary: false,
        uploaded_by: uploadedBy,
      });

      uploadedImages.push(image);
    }

    return uploadedImages;
  }

  async findAll() {
    return this.prisma.images.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.images.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateImageDto: UpdateImageDto) {
    return this.prisma.images.update({
      where: { id },
      data: updateImageDto,
    });
  }

  async remove(id: string) {
    // Get image info
    const image = await this.findOne(id);
    if (!image) {
      throw new Error('Image not found');
    }

    // Delete from Supabase Storage
    const { error } = await this.supabase.storage
      .from(image.storage_bucket)
      .remove([image.file_path]);

    if (error) {
      console.error('Failed to delete from storage:', error);
    }

    // Delete from database
    return this.prisma.images.delete({
      where: { id },
    });
  }
}
