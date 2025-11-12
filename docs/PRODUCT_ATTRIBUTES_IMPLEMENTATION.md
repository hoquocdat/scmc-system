# Product Attributes System - Implementation Guide

## Overview

This document describes the JSONB-based product attributes and master-variant system implemented for the SCMC POS application.

## Database Schema

### New Columns in `products` Table

```sql
- master_product_id UUID      -- Links variants to master product
- is_master BOOLEAN            -- TRUE for master, FALSE for variants
- variant_generation_type      -- 'manual', 'automatic', 'attribute_based'
- attributes JSONB             -- Flexible attribute storage
```

### New Table: `attribute_definitions`

Stores attribute metadata for UI generation and validation:
- Common attributes: Color, Size, Material, Weight
- Input types: select, color, text, number, boolean, multiselect
- Options stored as JSONB arrays
- Validation rules as JSONB

## Key Features

### 1. JSONB Attributes with GIN Index
- **Fast queries**: `WHERE attributes @> '{"color": "red"}'`
- **Flexible storage**: No schema changes needed
- **Type-safe**: Data validation at application layer

### 2. Master-Variant Hierarchy
```
Master Product (id: "master-001", is_master: true)
├── Variant 1 (master_product_id: "master-001", attributes: {"color":"red", "size":"M"})
├── Variant 2 (master_product_id: "master-001", attributes: {"color":"blue", "size":"L"})
└── Variant 3 (master_product_id: "master-001", attributes: {"color":"red", "size":"L"})
```

### 3. Helper Functions
- `find_products_by_attributes(jsonb)` - Find products matching attributes
- `get_product_variants(uuid)` - Get all variants with stock info

## Backend Implementation

### Services to Create

#### 1. Attribute Definitions Service
```typescript
// backend/src/attribute-definitions/attribute-definitions.service.ts

export class AttributeDefinitionsService {
  async findAll() {
    return this.prisma.attribute_definitions.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' }
    });
  }

  async findVariantAttributes() {
    return this.prisma.attribute_definitions.findMany({
      where: {
        is_active: true,
        is_variant_attribute: true
      },
      orderBy: { display_order: 'asc' }
    });
  }
}
```

#### 2. Product Variant Generation Service
```typescript
// Add to products.service.ts

async createMasterProductWithVariants(dto: CreateMasterProductDto) {
  // 1. Create master product
  const master = await this.prisma.products.create({
    data: {
      ...dto,
      is_master: true,
      variant_generation_type: 'automatic'
    }
  });

  // 2. Generate all variant combinations
  const variants = this.generateVariantCombinations(
    dto.variantAttributes // e.g., [{color: ['red', 'blue']}, {size: ['M', 'L']}]
  );

  // 3. Create variant products
  for (const variant of variants) {
    await this.prisma.products.create({
      data: {
        master_product_id: master.id,
        is_master: false,
        sku: `${master.sku}-${this.generateVariantSuffix(variant)}`,
        name: `${master.name} (${this.formatVariantName(variant)})`,
        attributes: variant, // JSONB: {"color": "red", "size": "M"}
        retail_price: master.retail_price,
        // ... other fields
      }
    });
  }

  return { master, variantsCreated: variants.length };
}

private generateVariantCombinations(attrs: VariantAttributes[]) {
  // Cartesian product of all attribute values
  // [{color: 'red'}, {color: 'blue'}] × [{size: 'M'}, {size: 'L'}]
  // = [{color:'red', size:'M'}, {color:'red', size:'L'}, ...]
}
```

#### 3. Variant Query Service
```typescript
async findVariantByAttributes(masterProductId: string, attributes: Record<string, string>) {
  return this.prisma.products.findFirst({
    where: {
      master_product_id: masterProductId,
      attributes: {
        path: [],
        equals: attributes
      }
    },
    include: {
      inventory: true
    }
  });
}

async searchProductsByAttributes(filters: AttributeFilters) {
  const where: any = { is_active: true };

  // Build JSONB query
  if (filters.color) {
    where.attributes = { path: ['color'], equals: filters.color };
  }

  return this.prisma.products.findMany({ where });
}
```

## Frontend Implementation

### 1. Attribute Selector Component
```tsx
// frontend/src/components/products/AttributeSelector.tsx

export function AttributeSelector({
  masterProduct,
  onVariantSelect
}: {
  masterProduct: Product;
  onVariantSelect: (variant: Product | null) => void;
}) {
  const [selection, setSelection] = useState<Record<string, string>>({});

  const { data: attributes } = useQuery({
    queryKey: ['variantAttributes'],
    queryFn: () => attributesApi.getVariantAttributes()
  });

  const { data: variants } = useQuery({
    queryKey: ['productVariants', masterProduct.id],
    queryFn: () => productsApi.getVariants(masterProduct.id)
  });

  // Find matching variant based on selection
  useEffect(() => {
    const variant = variants?.find(v =>
      Object.entries(selection).every(([key, value]) =>
        v.attributes[key] === value
      )
    );
    onVariantSelect(variant || null);
  }, [selection]);

  return (
    <div className="space-y-4">
      {attributes?.map(attr => (
        <div key={attr.slug}>
          <Label>{attr.name}</Label>
          {attr.input_type === 'color' ? (
            <ColorSwatchPicker
              options={attr.options}
              value={selection[attr.slug]}
              onChange={(value) => setSelection({...selection, [attr.slug]: value})}
            />
          ) : (
            <Select
              value={selection[attr.slug]}
              onValueChange={(value) => setSelection({...selection, [attr.slug]: value})}
            >
              {attr.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </Select>
          )}
        </div>
      ))}

      {selectedVariant && (
        <ProductVariantInfo variant={selectedVariant} />
      )}
    </div>
  );
}
```

### 2. Master Product Creation Form
```tsx
// frontend/src/components/products/MasterProductForm.tsx

export function MasterProductForm() {
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({});

  const { data: attributes } = useQuery({
    queryKey: ['variantAttributes'],
    queryFn: () => attributesApi.getVariantAttributes()
  });

  // Preview variant combinations
  const variantCount = useMemo(() => {
    return Object.values(attributeValues)
      .reduce((count, values) => count * values.length, 1);
  }, [attributeValues]);

  return (
    <form onSubmit={handleSubmit}>
      {/* Basic product info */}
      <Input label="Product Name" {...register('name')} />
      <Input label="Base SKU" {...register('sku')} />

      {/* Select variant attributes */}
      <div className="space-y-4">
        <Label>Variant Attributes</Label>
        {attributes?.map(attr => (
          <Checkbox
            key={attr.slug}
            label={attr.name}
            checked={selectedAttributes.includes(attr.slug)}
            onCheckedChange={(checked) => {
              // Add/remove attribute from selection
            }}
          />
        ))}
      </div>

      {/* Select values for each attribute */}
      {selectedAttributes.map(slug => {
        const attr = attributes?.find(a => a.slug === slug);
        return (
          <MultiSelect
            key={slug}
            label={attr.name}
            options={attr.options}
            value={attributeValues[slug] || []}
            onChange={(values) => {
              setAttributeValues({...attributeValues, [slug]: values});
            }}
          />
        );
      })}

      {/* Preview */}
      <Alert>
        <AlertTitle>Variants to create: {variantCount}</AlertTitle>
        <AlertDescription>
          {/* Show list of variants that will be created */}
        </AlertDescription>
      </Alert>

      <Button type="submit">Create Master Product with Variants</Button>
    </form>
  );
}
```

## Usage Examples

### Query Products by Attributes
```typescript
// Find all red shirts in size M
const products = await prisma.products.findMany({
  where: {
    attributes: {
      path: [],
      equals: { color: 'red', size: 'M' }
    },
    is_active: true
  }
});

// Find products with any red color
const redProducts = await prisma.products.findMany({
  where: {
    attributes: {
      path: ['color'],
      equals: 'red'
    }
  }
});
```

### Create Master Product with Variants
```typescript
POST /api/products/master-with-variants
{
  "name": "Classic T-Shirt",
  "sku": "TSHIRT-001",
  "category_id": "...",
  "retail_price": 29.99,
  "variantAttributes": {
    "color": ["red", "blue", "green"],
    "size": ["S", "M", "L", "XL"]
  }
}

// Creates 1 master + 12 variants (3 colors × 4 sizes)
```

### Find Variant by Selection
```typescript
GET /api/products/master-001/find-variant?color=red&size=M

// Returns specific variant or 404 if combination doesn't exist
```

## Migration Path

### For Existing Products
If you have existing products, you can migrate them:

```sql
-- Add default empty attributes
UPDATE products SET attributes = '{}' WHERE attributes IS NULL;

-- Migrate product_variants data (if exists)
UPDATE products p
SET attributes = jsonb_build_object(
  'color', pv.color,
  'size', pv.size
)
FROM product_variants pv
WHERE pv.product_id = p.id;
```

## Performance Considerations

1. **GIN Index**: Automatically used for `@>` and `?` operators
2. **Specific Indexes**: Created for common attributes (color, size)
3. **Query Patterns**: Use `@>` for contains, `->` for path access
4. **Avoid**: Don't use `LIKE` on JSONB, use operators instead

## Benefits

✅ **Simple**: Just 2 tables (products + attribute_definitions)
✅ **Fast**: GIN indexes make JSONB queries performant
✅ **Flexible**: Add new attributes without migrations
✅ **Type-Safe**: Validation at application layer
✅ **Scalable**: Works for 100K+ products
✅ **Maintainable**: Less code, fewer JOINs

## Next Steps

1. Create attribute definitions CRUD endpoints
2. Implement variant generation API
3. Build frontend attribute selector
4. Add attribute-based product filtering
5. Implement variant SKU generation logic
6. Add bulk variant management UI

## API Endpoints to Implement

```
GET    /api/attribute-definitions          # List all attributes
GET    /api/attribute-definitions/variant  # List variant attributes only
POST   /api/products/master-with-variants  # Create master + variants
GET    /api/products/:id/variants          # Get all variants
GET    /api/products/find-by-attributes    # Search by attributes
POST   /api/products/:id/generate-variants # Generate new variants for existing master
```

---

**Status**: ✅ Migration applied, schema updated, ready for service implementation
**Created**: 2025-01-12
**Next**: Implement attribute-definitions module
