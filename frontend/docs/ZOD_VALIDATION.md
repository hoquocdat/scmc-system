# Zod Validation Guide

This document explains how to use Zod for form validation throughout the SCMC Workshop Management System.

## Overview

We use [Zod](https://zod.dev/) for schema validation combined with [React Hook Form](https://react-hook-form.com/) for form management. This provides:

- **Type Safety**: Automatic TypeScript types inferred from schemas
- **Reusable Validation**: Shared validation logic across forms
- **Better DX**: Clear, declarative validation rules
- **Runtime Safety**: Validation at runtime, not just compile time

## Installation

Already installed in the project:
```bash
npm install zod @hookform/resolvers
```

## Directory Structure

```
src/lib/validations/
├── common.ts       # Shared validation schemas
├── bike.ts         # Bike-specific schemas
└── customer.ts     # Customer-specific schemas
```

## Common Validation Schemas

Located in `src/lib/validations/common.ts`:

### Phone Number
```typescript
import { phoneSchema } from '@/lib/validations/common';

const schema = z.object({
  phone: phoneSchema, // Validates Vietnamese phone (10-11 digits)
});
```

### Email
```typescript
import { emailSchema } from '@/lib/validations/common';

const schema = z.object({
  email: emailSchema, // Optional email validation
});
```

### License Plate
```typescript
import { licensePlateSchema } from '@/lib/validations/common';

const schema = z.object({
  license_plate: licensePlateSchema, // Vietnamese format: 59A3-12345
});
```

### Full Name
```typescript
import { fullNameSchema } from '@/lib/validations/common';

const schema = z.object({
  full_name: fullNameSchema, // 2-100 characters
});
```

### Other Common Schemas
- `emailSchema`: Email validation
- `addressSchema`: Address (required, max 500 chars)
- `notesSchema`: Optional notes (max 1000 chars)
- `vinSchema`: VIN number (17 characters)
- `yearSchema`: Year validation (1900 - current year + 1)
- `uuidSchema`: UUID validation
- `dateSchema`: Date validation

## Creating a Form with Zod

### Step 1: Import Dependencies

```typescript
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createBikeSchema, type CreateBikeFormData } from '@/lib/validations/bike';
```

### Step 2: Setup Form with Zod Resolver

```typescript
const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
  control,
} = useForm<CreateBikeFormData>({
  resolver: zodResolver(createBikeSchema),
  defaultValues: {
    brand: '',
    model: '',
    license_plate: '',
    // ... other defaults
  },
});
```

### Step 3: Use in Form Fields

For regular inputs:
```tsx
<Input
  {...register('brand')}
  placeholder="Enter brand"
/>
{errors.brand && (
  <p className="text-sm text-red-600">{errors.brand.message}</p>
)}
```

For number inputs:
```tsx
<Input
  type="number"
  {...register('year', { valueAsNumber: true })}
  placeholder="2020"
/>
{errors.year && (
  <p className="text-sm text-red-600">{errors.year.message}</p>
)}
```

For controlled inputs (react-select):
```tsx
<Controller
  name="brand"
  control={control}
  render={({ field }) => (
    <Select
      {...field}
      options={brandOptions}
      value={brandOptions.find((b) => b.value === field.value) || null}
      onChange={(option) => field.onChange(option?.value || '')}
    />
  )}
/>
```

## Creating New Schemas

### Example: Service Order Schema

```typescript
// src/lib/validations/service-order.ts
import { z } from 'zod';
import {
  requiredStringSchema,
  optionalStringSchema,
  positiveNumberSchema,
  uuidSchema,
} from './common';

export const createServiceOrderSchema = z.object({
  motorcycle_id: uuidSchema,
  customer_id: uuidSchema,
  description: requiredStringSchema('Vui lòng nhập mô tả'),
  customer_complaint: optionalStringSchema,
  mileage_in: positiveNumberSchema('Số km phải lớn hơn 0').optional(),
  estimated_cost: positiveNumberSchema('Chi phí ước tính phải lớn hơn 0').optional(),
});

export type CreateServiceOrderFormData = z.infer<typeof createServiceOrderSchema>;
```

## Custom Validation Rules

### Refine Method
For complex validation:

```typescript
const schema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu không khớp",
  path: ["confirmPassword"], // Error shows on this field
});
```

### Transform Method
For data transformation:

```typescript
const schema = z.object({
  license_plate: z
    .string()
    .transform((val) => val.toUpperCase().replace(/[^A-Z0-9]/g, '')),
});
```

### Custom Error Messages

```typescript
const schema = z.object({
  age: z
    .number({
      required_error: "Vui lòng nhập tuổi",
      invalid_type_error: "Tuổi phải là số",
    })
    .min(18, "Phải từ 18 tuổi trở lên"),
});
```

## Best Practices

### 1. Reuse Common Schemas
Don't create duplicate validation logic:
```typescript
// ❌ Bad
const schema1 = z.object({
  phone: z.string().regex(/^[0-9]{10,11}$/),
});

const schema2 = z.object({
  phone: z.string().regex(/^[0-9]{10,11}$/),
});

// ✅ Good
import { phoneSchema } from '@/lib/validations/common';

const schema1 = z.object({ phone: phoneSchema });
const schema2 = z.object({ phone: phoneSchema });
```

### 2. Use Type Inference
Let Zod generate TypeScript types:
```typescript
// ✅ Good - Types automatically inferred
export const customerSchema = z.object({
  full_name: z.string(),
  phone: z.string(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
```

### 3. Vietnamese Error Messages
Always provide Vietnamese error messages:
```typescript
const schema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên'),
  age: z.number().min(18, 'Tuổi phải từ 18 trở lên'),
});
```

### 4. Optional vs Nullable
Use `.optional()` for optional fields:
```typescript
const schema = z.object({
  notes: z.string().optional(), // Can be undefined
  email: z.string().email().optional().or(z.literal('')), // Can be empty string or undefined
});
```

### 5. Number Handling
Use `valueAsNumber` for number inputs:
```tsx
<Input
  type="number"
  {...register('year', { valueAsNumber: true })}
/>
```

## Migration Checklist

When migrating an existing form to Zod:

- [ ] Install dependencies (`zod`, `@hookform/resolvers`)
- [ ] Create or import appropriate schema from `/lib/validations`
- [ ] Import `zodResolver` from `@hookform/resolvers/zod`
- [ ] Add `resolver: zodResolver(yourSchema)` to `useForm()`
- [ ] Update TypeScript type from manual interface to `z.infer<typeof schema>`
- [ ] Remove manual `rules` prop from form fields (validation now in schema)
- [ ] Add `valueAsNumber: true` for number inputs
- [ ] Test all validation scenarios

## Example: Complete Form Component

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCustomerSchema, type CreateCustomerFormData } from '@/lib/validations/customer';

export function CreateCustomerForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCustomerFormData>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      address: '',
    },
  });

  const onSubmit = async (data: CreateCustomerFormData) => {
    await apiClient.customers.create(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <Label>Họ Tên *</Label>
        <Input {...register('full_name')} />
        {errors.full_name && <p className="text-red-600">{errors.full_name.message}</p>}
      </div>

      <div>
        <Label>Số Điện Thoại *</Label>
        <Input {...register('phone')} />
        {errors.phone && <p className="text-red-600">{errors.phone.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        Tạo Khách Hàng
      </Button>
    </form>
  );
}
```

## Resources

- [Zod Documentation](https://zod.dev/)
- [React Hook Form with Zod](https://react-hook-form.com/get-started#SchemaValidation)
- [Common Schemas](/src/lib/validations/common.ts)
