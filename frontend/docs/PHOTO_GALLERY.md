# Photo Gallery Component

A reusable photo gallery component for displaying images with lightbox functionality throughout the SCMC Workshop Management System.

## Overview

The `PhotoGallery` component uses:
- **react-photo-album**: Responsive masonry/grid layout
- **yet-another-react-lightbox**: Full-screen image viewer with navigation

## Installation

Already installed in the project:
```bash
npm install react-photo-album yet-another-react-lightbox
```

## Basic Usage

```tsx
import { PhotoGallery } from '@/components/common/PhotoGallery';

function MyComponent() {
  const images = [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
    'https://example.com/image3.jpg',
  ];

  return <PhotoGallery images={images} />;
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `images` | `string[]` | **Required** | Array of image URLs to display |
| `altPrefix` | `string` | `'Image'` | Prefix for alt text (e.g., "Image 1", "Image 2") |
| `emptyMessage` | `string` | `'Chưa có hình ảnh'` | Message shown when no images available |

## Features

### 1. Responsive Layout
- Automatically adjusts to screen size
- Uses rows layout with target height of 200px
- Scales images proportionally

### 2. Lightbox Viewer
- Click any image to open full-screen lightbox
- Keyboard navigation:
  - `←` / `→` : Previous/Next image
  - `Esc` : Close lightbox
- Click backdrop to close
- Zoom and pan support (built-in)

### 3. Empty State
- Shows placeholder when no images provided
- Customizable empty message
- Consistent styling with dashed border

### 4. Hover Effects
- Images scale slightly on hover
- Cursor changes to pointer
- Smooth transitions

## Examples

### Bike Images Gallery

```tsx
import { PhotoGallery } from '@/components/common/PhotoGallery';
import type { Motorcycle } from '@/types';

interface BikeImagesTabProps {
  bike: Motorcycle;
}

export function BikeImagesTab({ bike }: BikeImagesTabProps) {
  const images = [
    bike.image_url,
    ...(bike.image_urls || [])
  ].filter(Boolean) as string[];

  return (
    <PhotoGallery
      images={images}
      altPrefix={`${bike.brand} ${bike.model}`}
      emptyMessage="Chưa có hình ảnh xe"
    />
  );
}
```

### Service Order Photos

```tsx
<PhotoGallery
  images={serviceOrder.photos}
  altPrefix={`Service Order ${serviceOrder.order_number}`}
  emptyMessage="Chưa có hình ảnh dịch vụ"
/>
```

### Customer Documents

```tsx
<PhotoGallery
  images={customer.document_urls || []}
  altPrefix={`Documents for ${customer.full_name}`}
  emptyMessage="Chưa có tài liệu"
/>
```

## Layout Options

The component uses `layout="rows"` by default. You can customize the PhotoGallery component for different layouts:

### Masonry Layout
```tsx
// In PhotoGallery.tsx, change:
<PhotoAlbum
  photos={photos}
  layout="masonry"  // Changed from "rows"
  columns={(containerWidth) => {
    if (containerWidth < 640) return 2;
    if (containerWidth < 1024) return 3;
    return 4;
  }}
/>
```

### Columns Layout
```tsx
<PhotoAlbum
  photos={photos}
  layout="columns"
  columns={3}
/>
```

## Styling

The component uses Tailwind CSS classes. Key styles:

```css
/* Hover effect on images */
.cursor-pointer.transition-transform.hover:scale-105

/* Empty state container */
.aspect-video.flex.items-center.justify-center.bg-gray-100.rounded-lg.border-2.border-dashed.border-gray-300
```

## Performance Considerations

### Image Optimization

For better performance, ensure images are:
1. **Optimized**: Compressed and properly sized
2. **Cached**: Use CDN or browser caching
3. **Lazy loaded**: Built into react-photo-album

### Loading Many Images

```tsx
// Filter out null/undefined images
const validImages = images.filter(Boolean) as string[];

<PhotoGallery images={validImages} />
```

## Accessibility

The component includes:
- Proper alt text for screen readers
- Keyboard navigation in lightbox
- Focus management
- ARIA labels (built into libraries)

## Common Issues

### Issue: Images not loading
**Solution**: Ensure image URLs are valid and accessible
```tsx
const images = imageUrls.filter(url => url && url.startsWith('http'));
```

### Issue: Lightbox styles not working
**Solution**: Import CSS in your component
```tsx
import 'yet-another-react-lightbox/styles.css';
```

### Issue: Layout breaks on mobile
**Solution**: The component is responsive by default. Ensure parent has proper width constraints.

## Advanced Customization

### Custom Click Handler

```tsx
<PhotoAlbum
  photos={photos}
  layout="rows"
  onClick={({ index, photo, event }) => {
    // Custom logic before opening lightbox
    console.log('Clicked photo:', photo);
    setLightboxIndex(index);
  }}
/>
```

### Additional Lightbox Plugins

Install plugins for more features:
```bash
npm install yet-another-react-lightbox/plugins/captions
npm install yet-another-react-lightbox/plugins/thumbnails
```

Then use in PhotoGallery:
```tsx
import Captions from 'yet-another-react-lightbox/plugins/captions';
import 'yet-another-react-lightbox/plugins/captions.css';

<Lightbox
  slides={lightboxSlides}
  plugins={[Captions]}
  // ... other props
/>
```

## Resources

- [react-photo-album Documentation](https://react-photo-album.com/)
- [yet-another-react-lightbox Documentation](https://yet-another-react-lightbox.com/)
- [PhotoGallery Component Source](/src/components/common/PhotoGallery.tsx)

## Migration from Old Image Grid

**Before**:
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {images.map((imageUrl, index) => (
    <div key={index} className="aspect-square">
      <img src={imageUrl} alt={`Image ${index + 1}`} />
    </div>
  ))}
</div>
```

**After**:
```tsx
<PhotoGallery images={images} altPrefix="Bike" />
```

**Benefits**:
- ✅ Automatic lightbox functionality
- ✅ Better responsive layout
- ✅ Keyboard navigation
- ✅ Hover effects
- ✅ Less code to maintain
