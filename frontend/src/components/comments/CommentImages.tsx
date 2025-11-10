import { useState, useMemo, useCallback } from 'react';
import { useEntityImages, useUploadImages, useDeleteImage } from '@/hooks/useImages';
import { ImageUploadButton, type UploadFile } from '../common/ImageUploadButton';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

interface CommentImagesProps {
  commentId: string;
  isOwner: boolean;
}

export function CommentImages({ commentId, isOwner }: CommentImagesProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch images using React Query
  const { data: imageRecords } = useEntityImages('comment', commentId);

  // Upload mutation
  const uploadMutation = useUploadImages('comment', commentId);

  // Delete mutation
  const deleteMutation = useDeleteImage('comment', commentId);

  // Extract image URLs
  const images = useMemo(() => {
    if (imageRecords && imageRecords.length > 0) {
      const sorted = [...imageRecords].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return sorted.map(img => img.public_url);
    }
    return [];
  }, [imageRecords]);

  // Handle file upload with progress tracking
  const handleUpload = useCallback(async (files: File[]) => {
    const newUploadFiles: UploadFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadingFiles(newUploadFiles);

    try {
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

      await uploadMutation.mutateAsync(files);

      setUploadingFiles((prev) =>
        prev.map((uf) => ({ ...uf, status: 'success' as const, progress: 100 }))
      );

      setTimeout(() => {
        setUploadingFiles([]);
      }, 1000);
    } catch (error) {
      setUploadingFiles((prev) =>
        prev.map((uf) => ({
          ...uf,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Upload failed',
        }))
      );
    }
  }, [uploadMutation]);

  // Handle image deletion
  const handleDeleteImages = async () => {
    if (!imageRecords || selectedImages.size === 0) return;

    const imageUrls = Array.from(selectedImages);
    const imageIdsToDelete = imageRecords
      .filter(img => imageUrls.includes(img.public_url))
      .map(img => img.id);

    if (imageIdsToDelete.length === 0) {
      toast.error('Không tìm thấy hình ảnh để xóa');
      return;
    }

    setIsDeleting(true);
    try {
      for (const imageId of imageIdsToDelete) {
        await deleteMutation.mutateAsync(imageId);
      }
      setSelectedImages(new Set());
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle image selection
  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageUrl)) {
        newSet.delete(imageUrl);
      } else {
        newSet.add(imageUrl);
      }
      return newSet;
    });
  };

  const hasImages = images.length > 0 || uploadingFiles.length > 0;

  if (!hasImages && !isOwner) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Upload Button and Delete Button */}
      {isOwner && (
        <div className="flex items-center gap-2">
          <ImageUploadButton onUpload={handleUpload} maxFiles={5} maxSizeMB={5} size="sm" />
          {selectedImages.size > 0 && (
            <button
              onClick={handleDeleteImages}
              disabled={isDeleting}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-destructive border border-destructive rounded hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Xóa ({selectedImages.size})
            </button>
          )}
        </div>
      )}

      {/* Image Thumbnails Grid */}
      {hasImages && (
        <div className="flex flex-wrap gap-2">
          {/* Uploaded Images */}
          {images.map((imageUrl, index) => (
            <div
              key={imageUrl}
              className="relative group"
            >
              {/* Thumbnail */}
              <div
                className={`relative w-[180px] h-[180px] rounded border overflow-hidden cursor-pointer transition-all ${
                  selectedImages.has(imageUrl)
                    ? 'ring-2 ring-primary'
                    : 'hover:opacity-80'
                }`}
                onClick={() => setLightboxIndex(index)}
              >
                <img
                  src={imageUrl}
                  alt={`Comment image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Selection Checkbox (for owner) */}
              {isOwner && (
                <div
                  className="absolute top-2 right-2 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleImageSelection(imageUrl);
                  }}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 cursor-pointer transition-all ${
                      selectedImages.has(imageUrl)
                        ? 'bg-primary border-primary'
                        : 'bg-white/90 border-gray-300 hover:border-primary'
                    }`}
                  >
                    {selectedImages.has(imageUrl) && (
                      <svg
                        className="w-full h-full text-primary-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Uploading Images */}
          {uploadingFiles.map((file, index) => (
            <div
              key={`uploading-${index}`}
              className="relative w-[180px] h-[180px] rounded border overflow-hidden"
            >
              <img
                src={file.preview}
                alt={`Uploading ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Upload Progress Overlay */}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white text-center">
                  {file.status === 'uploading' && (
                    <>
                      <div className="text-xs mb-1">Đang tải lên...</div>
                      <div className="text-sm font-semibold">{file.progress}%</div>
                    </>
                  )}
                  {file.status === 'success' && (
                    <div className="text-sm">✓ Hoàn thành</div>
                  )}
                  {file.status === 'error' && (
                    <div className="text-sm text-red-400">✗ Lỗi</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {images.length > 0 && (
        <Lightbox
          open={lightboxIndex >= 0}
          close={() => setLightboxIndex(-1)}
          index={lightboxIndex}
          slides={images.map((src) => ({ src }))}
        />
      )}
    </div>
  );
}
