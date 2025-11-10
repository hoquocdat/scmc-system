import { Injectable, BadRequestException } from '@nestjs/common';
import { supabase } from '../config/supabase.config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  /**
   * Upload a file to Supabase Storage
   * @param file - File buffer or base64 string
   * @param bucket - Storage bucket name ('bikes' or 'service-orders')
   * @param fileName - Optional custom file name
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    file: Buffer | string,
    bucket: 'bikes' | 'service-orders',
    mimeType: string,
    fileName?: string,
  ): Promise<string> {
    // Validate file type
    if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      );
    }

    // Convert base64 to buffer if needed
    let fileBuffer: Buffer;
    if (typeof file === 'string') {
      // Remove data URL prefix if present
      const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else {
      fileBuffer = file;
    }

    // Validate file size
    if (fileBuffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        'File size exceeds maximum allowed size of 5MB.',
      );
    }

    // Generate unique file name
    const fileExtension = mimeType.split('/')[1];
    const uniqueFileName = fileName || `${uuidv4()}.${fileExtension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(uniqueFileName, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  /**
   * Delete a file from Supabase Storage
   * @param fileUrl - Public URL of the file to delete
   * @param bucket - Storage bucket name ('bikes' or 'service-orders')
   */
  async deleteFile(
    fileUrl: string,
    bucket: 'bikes' | 'service-orders',
  ): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];

      // Delete from Supabase Storage
      const { error } = await supabase.storage.from(bucket).remove([fileName]);

      if (error) {
        console.error('Storage delete error:', error);
        throw new BadRequestException(
          `Failed to delete file: ${error.message}`,
        );
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw error if file doesn't exist
      if (error instanceof BadRequestException) {
        throw error;
      }
    }
  }

  /**
   * Replace an existing file with a new one
   * @param oldFileUrl - URL of the file to replace
   * @param newFile - New file buffer or base64 string
   * @param bucket - Storage bucket name
   * @param mimeType - MIME type of the new file
   * @returns Public URL of the new file
   */
  async replaceFile(
    oldFileUrl: string,
    newFile: Buffer | string,
    bucket: 'bikes' | 'service-orders',
    mimeType: string,
  ): Promise<string> {
    // Upload new file first
    const newFileUrl = await this.uploadFile(newFile, bucket, mimeType);

    // Delete old file (don't fail if it doesn't exist)
    if (oldFileUrl) {
      try {
        await this.deleteFile(oldFileUrl, bucket);
      } catch (error) {
        console.warn('Failed to delete old file:', error);
      }
    }

    return newFileUrl;
  }
}
