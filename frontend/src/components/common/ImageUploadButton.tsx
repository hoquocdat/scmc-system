import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Images } from 'lucide-react';

export interface UploadFile {
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface ImageUploadButtonProps {
  onUpload: (files: File[]) => Promise<void>;
  maxFiles?: number;
  maxSizeMB?: number;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ImageUploadButton({
  onUpload,
  maxFiles = 10,
  maxSizeMB = 5,
  size = 'default',
}: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      if (files.length === 0) return;

      // Validate file size
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      const validFiles = files.filter((file) => {
        if (file.size > maxSizeBytes) {
          alert(`${file.name} quá lớn. Kích thước tối đa: ${maxSizeMB}MB`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) {
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Check max files limit
      if (validFiles.length > maxFiles) {
        alert(`Chỉ có thể tải lên tối đa ${maxFiles} hình ảnh`);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Call upload function
      await onUpload(validFiles);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onUpload, maxFiles, maxSizeMB]
  );

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        type="button"
        onClick={handleButtonClick}
        variant="outline"
        size={size}
        className="sm:w-auto "
      >
        <Images className="h-4 w-4 mr-2" />
        Add Photos
      </Button>
    </>
  );
}
