import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Upload, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadProps {
  currentImageUrl?: string;
  onUpload: (file: string, mimeType: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  isUploading?: boolean;
  maxSizeMB?: number;
}

export function ImageUpload({
  currentImageUrl,
  onUpload,
  onDelete,
  isUploading = false,
  maxSizeMB = 5,
}: ImageUploadProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return t('images.invalidType');
    }
    if (file.size > maxSizeBytes) {
      return t('images.fileTooLarge', { max: maxSizeMB });
    }
    return null;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setPreview(base64);

      // Call parent upload handler
      await onUpload(base64, file.type);
      toast.success(t('images.uploadSuccess'));
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(t('images.uploadFailed') + ': ' + error.message);
      setPreview(currentImageUrl || null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    try {
      await onDelete();
      setPreview(null);
      toast.success(t('images.deleteSuccess'));
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(t('images.deleteFailed') + ': ' + error.message);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={allowedTypes.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />

      {preview ? (
        <Card>
          <CardContent className="p-4">
            <div className="relative group">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-64 object-cover rounded-md"
              />
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleDelete}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-3"
              onClick={handleClick}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {t('images.changeImage')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={`border-2 border-dashed cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">{t('images.dragDropOrClick')}</p>
            <p className="text-xs text-muted-foreground">
              {t('images.supportedFormats')}: JPG, PNG, WebP (max {maxSizeMB}MB)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
