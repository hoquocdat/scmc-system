import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * Hook to fetch images for an entity
 */
export function useEntityImages(
  entityType: 'bike' | 'service_order' | 'customer' | 'part' | 'comment' | 'service_item',
  entityId: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['images', entityType, entityId],
    queryFn: async () => {
      const imageRecords = await apiClient.images.getByEntity(entityType, entityId);
      return imageRecords as Array<{
        id: string;
        public_url: string;
        is_primary: boolean;
        display_order: number;
        created_at: string;
      }>;
    },
    enabled,
  });
}

/**
 * Hook to upload images for an entity
 */
export function useUploadImages(
  entityType: 'bike' | 'service_order' | 'customer' | 'part' | 'comment' | 'service_item',
  entityId: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: File[]) => {
      return apiClient.images.upload(entityType, entityId, files);
    },
    onSuccess: (data) => {
      // Invalidate and refetch images
      queryClient.invalidateQueries({
        queryKey: ['images', entityType, entityId],
      });

      toast.success(`${data.length} hình ảnh đã được tải lên thành công`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi tải lên hình ảnh');
    },
  });
}

/**
 * Hook to delete an image
 */
export function useDeleteImage(
  entityType: 'bike' | 'service_order' | 'customer' | 'part' | 'comment' | 'service_item',
  entityId: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      return apiClient.images.delete(imageId);
    },
    onSuccess: () => {
      // Invalidate and refetch images
      queryClient.invalidateQueries({
        queryKey: ['images', entityType, entityId],
      });

      toast.success('Hình ảnh đã được xóa thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi xóa hình ảnh');
    },
  });
}
