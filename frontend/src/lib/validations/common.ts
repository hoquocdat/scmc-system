import { z } from 'zod';

/**
 * Common validation schemas for the SCMC Workshop Management System
 */

// Phone number validation (Vietnamese format)
export const phoneSchema = z
  .string()
  .min(1, 'Vui lòng nhập số điện thoại')
  .regex(/^[0-9]{10,11}$/, 'Số điện thoại phải có 10-11 chữ số');

// Email validation
export const emailSchema = z
  .string()
  .email('Email không hợp lệ')
  .optional()
  .or(z.literal(''));

// License plate validation (Vietnamese format: 59A3-12345)
export const licensePlateSchema = z
  .string()
  .min(1, 'Vui lòng nhập biển số xe')
  .refine(
    (value) => {
      const cleaned = value.replace(/-/g, '');
      return cleaned.length >= 5;
    },
    { message: 'Biển số xe phải có ít nhất 5 ký tự' }
  );

// Year validation
export const yearSchema = z
  .number()
  .int('Năm phải là số nguyên')
  .min(1900, 'Năm không hợp lệ')
  .max(new Date().getFullYear() + 1, 'Năm không hợp lệ')
  .optional()
  .or(z.nan());

// Non-empty string
export const requiredStringSchema = (message: string) =>
  z.string().min(1, message);

// Optional string (can be empty or undefined)
export const optionalStringSchema = z
  .string()
  .optional()
  .or(z.literal(''));

// Positive number
export const positiveNumberSchema = (message: string) =>
  z.number().positive(message);

// UUID validation
export const uuidSchema = z.string().uuid('ID không hợp lệ');

// Date validation
export const dateSchema = z.coerce.date({
  message: 'Vui lòng chọn ngày hợp lệ',
});

// Vietnamese full name validation
export const fullNameSchema = z
  .string()
  .min(1, 'Vui lòng nhập họ tên')
  .min(2, 'Họ tên phải có ít nhất 2 ký tự')
  .max(100, 'Họ tên quá dài');

// Address validation
export const addressSchema = z
  .string()
  .min(1, 'Vui lòng nhập địa chỉ')
  .max(500, 'Địa chỉ quá dài');

// Notes/description validation
export const notesSchema = z
  .string()
  .max(1000, 'Ghi chú quá dài')
  .optional()
  .or(z.literal(''));

// VIN number validation
export const vinSchema = z
  .string()
  .length(17, 'Số khung (VIN) phải có 17 ký tự')
  .optional()
  .or(z.literal(''));

// Helper function to transform empty strings to undefined
export const emptyStringToUndefined = z.literal('').transform(() => undefined);
