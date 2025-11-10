import { z } from 'zod';
import {
  licensePlateSchema,
  requiredStringSchema,
  optionalStringSchema,
  notesSchema,
  uuidSchema,
} from './common';

/**
 * Zod schema for creating a bike
 */
export const createBikeSchema = z.object({
  owner_id: optionalStringSchema,
  brand: requiredStringSchema('Vui lòng chọn hãng xe'),
  model: requiredStringSchema('Vui lòng nhập hoặc chọn mẫu xe'),
  license_plate: licensePlateSchema,
  year: z
    .number({ message: 'Năm phải là số' })
    .int('Năm phải là số nguyên')
    .min(1900, 'Năm không hợp lệ')
    .max(new Date().getFullYear() + 1, 'Năm không hợp lệ')
    .optional(),
  vin: optionalStringSchema,
  engine_number: optionalStringSchema,
  color: optionalStringSchema,
  notes: notesSchema,
});

/**
 * Infer TypeScript type from schema
 */
export type CreateBikeFormData = z.infer<typeof createBikeSchema>;

/**
 * Zod schema for updating a bike
 */
export const updateBikeSchema = createBikeSchema.partial().extend({
  id: uuidSchema,
});

export type UpdateBikeFormData = z.infer<typeof updateBikeSchema>;
