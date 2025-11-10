import { z } from 'zod';
import {
  phoneSchema,
  emailSchema,
  fullNameSchema,
  addressSchema,
  notesSchema,
  optionalStringSchema,
  uuidSchema,
} from './common';

/**
 * Zod schema for creating a customer
 */
export const createCustomerSchema = z.object({
  full_name: fullNameSchema,
  phone: phoneSchema,
  email: emailSchema,
  address: addressSchema.optional().or(z.literal('')),
  notes: notesSchema,
  facebook: optionalStringSchema,
  instagram: optionalStringSchema,
  zalo: optionalStringSchema,
});

/**
 * Infer TypeScript type from schema
 */
export type CreateCustomerFormData = z.infer<typeof createCustomerSchema>;

/**
 * Zod schema for updating a customer
 */
export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: uuidSchema,
});

export type UpdateCustomerFormData = z.infer<typeof updateCustomerSchema>;
