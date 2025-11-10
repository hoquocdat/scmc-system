import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Download from 'yet-another-react-lightbox/plugins/download';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { CheckCircle2, XCircle  } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { UploadFile } from './ImageUploadButton';

interface PhotoGalleryProps {
  images: string[];
  altPrefix?: string;
  uploadingFiles?: UploadFile[];
  onDeleteImages?: (imageUrls: string[]) => void;
  uploadButton?: React.ReactNode;
  isSelectMode?: boolean;
  selectedImages?: Set<string>;
  onSelectImage?: (imageUrl: string) => void;
}

export function PhotoGallery({
  images,
  altPrefix = 'Image',
  uploadingFiles = [],
  isSelectMode,
  selectedImages: externalSelectedImages,
  onSelectImage
}: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [internalSelectedImages, setInternalSelectedImages] = useState<Set<string>>(new Set());

  // Use external state if provided, otherwise use internal state
  const selectedImages = externalSelectedImages !== undefined ? externalSelectedImages : internalSelectedImages;
  const setSelectedImages = externalSelectedImages !== undefined ? (() => { }) : setInternalSelectedImages;

  const handleToggleSelect = (src: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(src)) {
        newSet.delete(src);
      } else {
        newSet.add(src);
      }
      return newSet;
    });
  };


  const handleImageClick = (imageUrl: string, index: number) => {
    if (isSelectMode) {
      // In select mode: toggle selection
      if (onSelectImage) {
        onSelectImage(imageUrl);
      } else {
        setSelectedImages((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(imageUrl)) {
            newSet.delete(imageUrl);
          } else {
            newSet.add(imageUrl);
          }
          return newSet;
        });
      }
    } else {
      // In view mode: open lightbox
      setLightboxIndex(index);
    }
  };


  return (
    <>

      {/* Grid Layout - Responsive columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {/* Uploading Images */}
        {uploadingFiles.map((uploadFile, index) => (
          <div
            key={`uploading-${index}`}
            className="relative aspect-square rounded border overflow-hidden"
          >
            <img
              src={uploadFile.preview}
              alt={`Uploading ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Upload Progress Overlay */}
            {uploadFile.status === 'uploading' && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-3/4 space-y-2">
                  <Progress value={uploadFile.progress} className="h-2" />
                  <p className="text-white text-xs text-center font-medium">
                    {uploadFile.progress}%
                  </p>
                </div>
              </div>
            )}
            {/* Success Overlay */}
            {uploadFile.status === 'success' && (
              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                <div className="bg-white rounded-full p-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
            )}
            {/* Error Overlay */}
            {uploadFile.status === 'error' && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                <div className="bg-white rounded-full p-2">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Uploaded Images */}
        {images.map((imageUrl, index) => {
          const isSelected = selectedImages.has(imageUrl);
          return (
            <div
              key={imageUrl}
              className="relative aspect-square group cursor-pointer"
            >
              <div
                className={`w-full h-full rounded border overflow-hidden transition-all ${isSelected ? 'ring-2 ring-blue-500' : 'hover:opacity-80'
                  }`}
                onClick={() => handleImageClick(imageUrl, index)}
              >
                <img
                  src={imageUrl}
                  alt={`${altPrefix} ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Selection Checkbox - Only show in select mode */}
              {isSelectMode && (
                <div
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => handleToggleSelect(imageUrl, e)}
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-white/80 border-white group-hover:bg-white'
                      }`}
                  >
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                  </div>
                </div>
              )}

              {/* Selected Overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-blue-500/20 rounded pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>

      <Lightbox
        slides={images.map((src) => ({ src }))}
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        controller={{ closeOnBackdropClick: true }}
        plugins={[Download, Zoom]}
        zoom={{
          maxZoomPixelRatio: 3,
          scrollToZoom: true,
        }}
      />
    </>
  );
}
