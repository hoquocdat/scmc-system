import { apiClient } from './api-client';

/**
 * Upload bike images via backend API
 */
export async function uploadBikeImages(
  bikeId: string,
  files: File[]
): Promise<string[]> {
  const images = await apiClient.images.upload('bike', bikeId, files);
  return images.map((img: any) => img.public_url);
}

/**
 * Upload service order images via backend API
 */
export async function uploadServiceOrderImages(
  serviceOrderId: string,
  files: File[]
): Promise<string[]> {
  const images = await apiClient.images.upload('service_order', serviceOrderId, files);
  return images.map((img: any) => img.public_url);
}

/**
 * Upload customer images via backend API
 */
export async function uploadCustomerImages(
  customerId: string,
  files: File[]
): Promise<string[]> {
  const images = await apiClient.images.upload('customer', customerId, files);
  return images.map((img: any) => img.public_url);
}

/**
 * Upload part images via backend API
 */
export async function uploadPartImages(
  partId: string,
  files: File[]
): Promise<string[]> {
  const images = await apiClient.images.upload('part', partId, files);
  return images.map((img: any) => img.public_url);
}

/**
 * Get all images for an entity
 */
export async function getEntityImages(
  entityType: 'bike' | 'service_order' | 'customer' | 'part',
  entityId: string
): Promise<any[]> {
  const result = await apiClient.images.getByEntity(entityType, entityId);
  return result as any[];
}

/**
 * Delete an image
 */
export async function deleteImage(imageId: string): Promise<void> {
  await apiClient.images.delete(imageId);
}
