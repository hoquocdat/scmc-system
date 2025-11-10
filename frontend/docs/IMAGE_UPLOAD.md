# Image Upload Component

Mobile-friendly image upload area with drag-and-drop, multiple file selection, and real-time upload progress tracking.

## Overview

The `ImageUploadArea` component provides a comprehensive solution for uploading images with:
- **Drag-and-drop support**: Desktop and mobile-friendly
- **Multiple file selection**: Upload multiple images at once
- **Progress tracking**: Real-time progress bars for each upload
- **File validation**: Size and type restrictions
- **Preview thumbnails**: See images before upload completes
- **Status indicators**: Visual feedback for pending, uploading, success, and error states

## Installation

Already installed in the project:
```bash
npm install react-dropzone
```

## Components

### ImageUploadArea

The main upload component that handles file selection, validation, and upload coordination.

**Location**: [src/components/common/ImageUploadArea.tsx](../src/components/common/ImageUploadArea.tsx)

### PhotoGallery (Enhanced)

The photo gallery now supports displaying uploading files with progress overlays.

**Location**: [src/components/common/PhotoGallery.tsx](../src/components/common/PhotoGallery.tsx)

## Basic Usage

```tsx
import { ImageUploadArea } from '@/components/common/ImageUploadArea';

function MyComponent() {
  const handleUpload = async (files: File[]) => {
    // Upload files to your backend/storage
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
  };

  return (
    <ImageUploadArea
      onUpload={handleUpload}
      maxFiles={10}
      maxSizeMB={5}
    />
  );
}
```

## Props

### ImageUploadArea Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onUpload` | `(files: File[]) => Promise<void>` | **Required** | Async function to handle file uploads |
| `maxFiles` | `number` | `10` | Maximum number of files allowed |
| `maxSizeMB` | `number` | `5` | Maximum file size in megabytes |
| `accept` | `Record<string, string[]>` | Image types | Accepted file types |

**Default accepted types**:
```typescript
{
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}
```

### PhotoGallery Props (Updated)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `images` | `string[]` | **Required** | Array of uploaded image URLs |
| `altPrefix` | `string` | `'Image'` | Prefix for alt text |
| `emptyMessage` | `string` | `'Chưa có hình ảnh'` | Empty state message |
| `uploadingFiles` | `UploadFile[]` | `[]` | Array of files currently uploading |

## Complete Example: BikeImagesTab

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageIcon } from 'lucide-react';
import type { Motorcycle } from '@/types';
import { PhotoGallery } from '@/components/common/PhotoGallery';
import { ImageUploadArea } from '@/components/common/ImageUploadArea';
import { toast } from 'sonner';

interface BikeImagesTabProps {
  bike: Motorcycle;
  onImagesUpdate?: (images: string[]) => void;
}

export function BikeImagesTab({ bike, onImagesUpdate }: BikeImagesTabProps) {
  const getAllImages = () => {
    const images: string[] = [];
    if (bike.image_url) images.push(bike.image_url);
    if (bike.image_urls) images.push(...bike.image_urls);
    return images;
  };

  const images = getAllImages();

  const handleUpload = async (files: File[]) => {
    try {
      // 1. Upload to Supabase Storage
      const uploadedUrls = await uploadToStorage(files);

      // 2. Update bike record with new image URLs
      const newImages = [...images, ...uploadedUrls];

      // 3. Notify parent component
      if (onImagesUpdate) {
        onImagesUpdate(newImages);
      }

      toast.success(`${files.length} hình ảnh đã được tải lên thành công`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Lỗi khi tải lên hình ảnh');
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Hình Ảnh Xe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ImageUploadArea onUpload={handleUpload} maxFiles={10} maxSizeMB={5} />
        <PhotoGallery
          images={images}
          altPrefix={`${bike.brand} ${bike.model}`}
          emptyMessage="Chưa có hình ảnh"
        />
      </CardContent>
    </Card>
  );
}
```

## Upload States

The `ImageUploadArea` tracks four states for each file:

### 1. Pending
Initial state when file is selected but upload hasn't started.

### 2. Uploading
Shows progress bar with percentage (0-100%).

```tsx
{uploadFile.status === 'uploading' && (
  <div className="space-y-1">
    <Progress value={uploadFile.progress} className="h-1.5" />
    <p className="text-xs text-muted-foreground">{uploadFile.progress}%</p>
  </div>
)}
```

### 3. Success
Shows green checkmark icon when upload completes successfully.

### 4. Error
Shows red error icon with error message when upload fails.

## PhotoGallery Upload Progress Overlays

When integrated with `PhotoGallery`, uploading images appear in the gallery with overlay indicators:

### Uploading Overlay
- Semi-transparent black background (60% opacity)
- White progress bar
- Percentage display

### Success Overlay
- Green tint (20% opacity)
- White circular background with green checkmark

### Error Overlay
- Red tint (20% opacity)
- White circular background with red X icon

## Mobile-Friendly Features

### Touch Support
- Drag-and-drop works on mobile devices
- Tap to open file picker
- Native file selection dialog on mobile

### Responsive Design
- Upload zone scales appropriately
- Progress items stack vertically
- Thumbnails adjust size (12x12 on mobile, 16x16 on desktop)

### Visual Feedback
```tsx
className={`
  border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer
  transition-colors duration-200
  ${isDragActive
    ? 'border-primary bg-primary/5'
    : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
  }
`}
```

## File Validation

### Size Validation
```tsx
const maxSizeBytes = maxSizeMB * 1024 * 1024;
const validFiles = acceptedFiles.filter((file) => {
  if (file.size > maxSizeBytes) {
    alert(`${file.name} quá lớn. Kích thước tối đa: ${maxSizeMB}MB`);
    return false;
  }
  return true;
});
```

### Count Validation
```tsx
if (uploadFiles.length + validFiles.length > maxFiles) {
  alert(`Chỉ có thể tải lên tối đa ${maxFiles} hình ảnh`);
  return;
}
```

### Type Validation
Handled automatically by `react-dropzone` using the `accept` prop.

## Implementing Backend Upload

### Option 1: Supabase Storage

```typescript
import { supabase } from '@/lib/supabase';

async function uploadToSupabase(files: File[]): Promise<string[]> {
  const uploadPromises = files.map(async (file) => {
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('bike-images')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('bike-images')
      .getPublicUrl(fileName);

    return publicUrl;
  });

  return Promise.all(uploadPromises);
}
```

### Option 2: REST API with FormData

```typescript
async function uploadToAPI(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return data.urls; // Array of uploaded URLs
}
```

### Option 3: Direct to Backend Endpoint

```typescript
async function uploadFiles(files: File[]): Promise<string[]> {
  const uploadPromises = files.map(async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/bikes/upload-image', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return data.url;
  });

  return Promise.all(uploadPromises);
}
```

## Progress Tracking (Advanced)

For real upload progress tracking with XMLHttpRequest:

```typescript
function uploadWithProgress(
  file: File,
  onProgress: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.url);
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload error')));

    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}
```

## Memory Management

The component properly manages object URLs to prevent memory leaks:

```tsx
const removeFile = (index: number) => {
  setUploadFiles((prev) => {
    const newFiles = [...prev];
    // Revoke object URL to avoid memory leaks
    URL.revokeObjectURL(newFiles[index].preview);
    newFiles.splice(index, 1);
    return newFiles;
  });
};

const clearCompleted = () => {
  setUploadFiles((prev) => {
    prev.forEach((uf) => {
      if (uf.status === 'success') {
        URL.revokeObjectURL(uf.preview);
      }
    });
    return prev.filter((uf) => uf.status !== 'success');
  });
};
```

## Error Handling

### Upload Errors
```tsx
try {
  await onUpload(validFiles);
  setUploadFiles((prev) =>
    prev.map((uf) => ({ ...uf, status: 'success', progress: 100 }))
  );
} catch (error) {
  setUploadFiles((prev) =>
    prev.map((uf) => ({
      ...uf,
      status: 'error',
      error: error instanceof Error ? error.message : 'Upload failed',
    }))
  );
}
```

### User Feedback
```tsx
toast.success(`${files.length} hình ảnh đã được tải lên thành công`);
toast.error('Lỗi khi tải lên hình ảnh');
```

## Customization

### Custom Accept Types

```tsx
<ImageUploadArea
  onUpload={handleUpload}
  accept={{
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
  }}
/>
```

### Custom Limits

```tsx
<ImageUploadArea
  onUpload={handleUpload}
  maxFiles={20}
  maxSizeMB={10}
/>
```

### Custom Styling

The component uses Tailwind CSS classes that can be customized:

```tsx
// Drop zone
className="border-2 border-dashed rounded-lg p-6 sm:p-8"

// Upload items
className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"

// Thumbnails
className="h-12 w-12 sm:h-16 sm:w-16 object-cover rounded"
```

## Best Practices

1. **Validate on Backend**: Always validate file size and type on the server
2. **Compress Images**: Consider compressing large images before upload
3. **Show Feedback**: Use toast notifications for user feedback
4. **Handle Errors**: Gracefully handle network errors and file validation
5. **Clean Up**: Always revoke object URLs to prevent memory leaks
6. **Optimize Storage**: Use appropriate image formats and compression
7. **Security**: Validate file types and scan for malicious content on backend

## Common Issues

### Issue: Images not uploading
**Solution**: Check that `onUpload` function is properly implemented and returns a Promise.

### Issue: Progress not showing
**Solution**: Ensure you're using async/await and proper state updates in `onUpload`.

### Issue: Memory leak warnings
**Solution**: Make sure to revoke object URLs when removing or clearing files.

### Issue: Mobile drag-and-drop not working
**Solution**: react-dropzone handles mobile automatically. Ensure no conflicting touch event handlers.

## Accessibility

- Keyboard navigation supported via native file input
- Proper ARIA labels for screen readers
- Visual feedback for drag states
- Error messages announced to screen readers

## Resources

- [react-dropzone Documentation](https://react-dropzone.js.org/)
- [PhotoGallery Component Documentation](./PHOTO_GALLERY.md)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [ImageUploadArea Source](../src/components/common/ImageUploadArea.tsx)
- [PhotoGallery Source](../src/components/common/PhotoGallery.tsx)
- [BikeImagesTab Example](../src/components/bikes/BikeImagesTab.tsx)
