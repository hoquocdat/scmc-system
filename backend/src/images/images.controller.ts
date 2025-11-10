import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ImagesService } from './images.service';
import { CreateImageDto } from './dto/create-image.dto';
import { UpdateImageDto } from './dto/update-image.dto';
import { UploadImagesDto } from './dto/upload-images.dto';
import { image_entity_type } from '@prisma/client';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: UploadImagesDto,
  ) {
    return this.imagesService.uploadFiles(
      files,
      uploadDto.entity_type,
      uploadDto.entity_id,
      undefined, // TODO: Get from auth context
    );
  }

  @Get('entity/:entityType/:entityId')
  findByEntity(
    @Param('entityType') entityType: image_entity_type,
    @Param('entityId') entityId: string,
  ) {
    return this.imagesService.findByEntity(entityType, entityId);
  }

  @Post()
  create(@Body() createImageDto: CreateImageDto) {
    return this.imagesService.create(createImageDto);
  }

  @Get()
  findAll() {
    return this.imagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imagesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateImageDto: UpdateImageDto) {
    return this.imagesService.update(id, updateImageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.imagesService.remove(id);
  }
}
