import { useMemo, useState, useCallback } from 'react';
import type { Motorcycle } from '@/types';
import { PhotoGallery } from '@/components/common/PhotoGallery';
import { ImageUploadButton, type UploadFile } from '@/components/common/ImageUploadButton';
import { ImageActionBar } from '@/components/common/ImageActionBar';
import { useEntityImages, useUploadImages, useDeleteImage } from '@/hooks/useImages';
import { toast } from 'sonner';
import { EmptyPhoto } from '../common/EmptyPhoto';

interface BikeImagesTabProps {
  bike: Motorcycle;
  onBikeUpdate?: () => void;
}

export function BikeImagesTab({ bike, onBikeUpdate }: BikeImagesTabProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  // Fetch images using React Query
  const { data: imageRecords } = useEntityImages('bike', bike.id);

  // Upload mutation
  const uploadMutation = useUploadImages('bike', bike.id);

  // Delete mutation
  const deleteMutation = useDeleteImage('bike', bike.id);

  // Extract image URLs with fallback to legacy fields
  const images = useMemo(() => {
    if (imageRecords && imageRecords.length > 0) {
      // Sort by created_at descending (newest first)
      const sorted = [...imageRecords].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return sorted.map(img => img.public_url);
    }

    // Fallback to legacy image_url fields
    const legacyImages: string[] = [];
    if (bike.image_url) legacyImages.push(bike.image_url);
    if (bike.image_urls) legacyImages.push(...bike.image_urls);
    return legacyImages;
  }, [imageRecords, bike.image_url, bike.image_urls]);

  // Handle file upload with progress tracking
  const handleUpload = useCallback(async (files: File[]) => {
    // Create upload file objects with previews
    const newUploadFiles: UploadFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadingFiles(newUploadFiles);

    try {
      // Update status to uploading
      setUploadingFiles((prev) =>
        prev.map((uf) => ({ ...uf, status: 'uploading' as const }))
      );

      // Simulate progress
      for (let i = 0; i <= 90; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setUploadingFiles((prev) =>
          prev.map((uf) => ({ ...uf, progress: i }))
        );
      }

      // Actual upload
      await uploadMutation.mutateAsync(files);

      // Mark as success
      setUploadingFiles((prev) =>
        prev.map((uf) => ({ ...uf, status: 'success' as const, progress: 100 }))
      );

      // Clear after 2 seconds
      setTimeout(() => {
        setUploadingFiles([]);
      }, 2000);

      // Notify parent component
      if (onBikeUpdate) {
        onBikeUpdate();
      }
    } catch (error) {
      // Mark as error
      setUploadingFiles((prev) =>
        prev.map((uf) => ({
          ...uf,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Upload failed',
        }))
      );
    }
  }, [uploadMutation, onBikeUpdate]);

  // Handle image deletion
  const handleDeleteImages = async (imageUrls: string[]) => {
    if (!imageRecords) return;

    // Find image IDs from URLs
    const imageIdsToDelete = imageRecords
      .filter(img => imageUrls.includes(img.public_url))
      .map(img => img.id);

    if (imageIdsToDelete.length === 0) {
      toast.error('Không tìm thấy hình ảnh để xóa');
      return;
    }

    // Delete each image
    for (const imageId of imageIdsToDelete) {
      await deleteMutation.mutateAsync(imageId);
    }

    // Notify parent component
    if (onBikeUpdate) {
      onBikeUpdate();
    }
  };

  const handleDownloadSelected = async () => {
    for (const imageUrl of selectedImages) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = imageUrl.split('/').pop() || 'image.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Failed to download image:', imageUrl, error);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedImages.size > 0) {
      await handleDeleteImages(Array.from(selectedImages));
      setSelectedImages(new Set());
    }
  };

  const handleCancelSelection = () => {
    setSelectedImages(new Set());
    setIsSelectMode(false);
  };

  return (
    <div className="space-y-6">
      {images?.length === 0 ? (
        <div className="flex justify-center">
          <EmptyPhoto>
            <ImageUploadButton onUpload={handleUpload} maxFiles={10} maxSizeMB={5} />
          </EmptyPhoto>
        </div>
      ) : (
        <>
          {/* Action Bar */}
          <ImageActionBar
            isSelectMode={isSelectMode}
            selectedCount={selectedImages.size}
            onSelectMode={() => setIsSelectMode(true)}
            onCancel={handleCancelSelection}
            onDownload={handleDownloadSelected}
            onDelete={handleDeleteSelected}
            uploadButton={<ImageUploadButton onUpload={handleUpload} maxFiles={10} maxSizeMB={5} />}
          />

          {/* Photo Gallery */}
          <PhotoGallery
            images={images}
            altPrefix={`${bike.brand} ${bike.model}`}
            uploadingFiles={uploadingFiles}
            isSelectMode={isSelectMode}
            selectedImages={selectedImages}
            onSelectImage={(imageUrl) => {
              setSelectedImages((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(imageUrl)) {
                  newSet.delete(imageUrl);
                } else {
                  newSet.add(imageUrl);
                }
                return newSet;
              });
            }}
          />
        </>
      )}
    </div>
  );
}
