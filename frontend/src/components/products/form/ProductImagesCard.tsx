import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUploadButton, type UploadFile } from '@/components/common/ImageUploadButton';
import { PhotoGallery } from '@/components/common/PhotoGallery';

interface ProductImagesCardProps {
  images: string[];
  uploadingFiles: UploadFile[];
  onUpload: (files: File[]) => Promise<void>;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function ProductImagesCard({
  images,
  uploadingFiles,
  onUpload,
  maxFiles = 10,
  maxSizeMB = 5,
}: ProductImagesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hình ảnh sản phẩm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Thêm tối đa {maxFiles} hình ảnh cho sản phẩm (PNG, JPG, WEBP tối đa {maxSizeMB}MB)
          </p>
          <ImageUploadButton
            onUpload={onUpload}
            maxFiles={maxFiles}
            maxSizeMB={maxSizeMB}
          />
        </div>

        {(images.length > 0 || uploadingFiles.length > 0) && (
          <PhotoGallery
            images={images}
            uploadingFiles={uploadingFiles}
            altPrefix="Sản phẩm"
          />
        )}

        {images.length === 0 && uploadingFiles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-sm">Chưa có hình ảnh nào</p>
            <p className="text-xs mt-1">Nhấp "Add Photos" để thêm hình ảnh</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
