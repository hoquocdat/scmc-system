import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attributeDefinitionsApi, type AttributeDefinition } from '@/lib/api/attribute-definitions';
import { productsApi, type Product } from '@/lib/api/products';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AttributeSelectorProps {
  masterProduct: Product;
  onVariantSelect: (variant: Product | null) => void;
}

export function AttributeSelector({
  masterProduct,
  onVariantSelect,
}: AttributeSelectorProps) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null);

  // Fetch variant attributes definitions
  const { data: attributes, isLoading: attributesLoading } = useQuery({
    queryKey: ['variantAttributes'],
    queryFn: () => attributeDefinitionsApi.getVariantAttributes(),
  });

  // Fetch all variants of this master product
  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ['productVariants', masterProduct.id],
    queryFn: () => productsApi.getVariants(masterProduct.id),
    enabled: !!masterProduct.id,
  });

  // Find matching variant based on current selection
  useEffect(() => {
    if (!variants || Object.keys(selection).length === 0) {
      setSelectedVariant(null);
      onVariantSelect(null);
      return;
    }

    // Check if all required attributes are selected
    const requiredAttributes = attributes?.filter((attr) => attr.is_required) || [];
    const allRequiredSelected = requiredAttributes.every(
      (attr) => selection[attr.slug],
    );

    if (!allRequiredSelected) {
      setSelectedVariant(null);
      onVariantSelect(null);
      return;
    }

    // Find variant that matches the selection
    const matchingVariant = variants.find((variant) => {
      const variantAttrs = variant.attributes as Record<string, string> || {};
      return Object.entries(selection).every(
        ([key, value]) => variantAttrs[key] === value,
      );
    });

    setSelectedVariant(matchingVariant || null);
    onVariantSelect(matchingVariant || null);
  }, [selection, variants, attributes, onVariantSelect]);

  const handleAttributeChange = (slug: string, value: string) => {
    setSelection((prev) => ({
      ...prev,
      [slug]: value,
    }));
  };

  const getAvailableOptions = (attribute: AttributeDefinition) => {
    if (!variants) return attribute.options;

    // Filter options based on what variants actually exist
    const availableValues = new Set<string>();
    variants.forEach((variant) => {
      const variantAttrs = variant.attributes as Record<string, string> || {};
      if (variantAttrs[attribute.slug]) {
        availableValues.add(variantAttrs[attribute.slug]);
      }
    });

    return attribute.options.filter((opt) => availableValues.has(opt.value));
  };

  const getTotalStock = (product: Product) => {
    if (!product.inventory) return 0;
    return product.inventory.reduce(
      (sum, inv) => sum + (inv.quantity_on_hand || 0),
      0,
    );
  };

  if (attributesLoading || variantsLoading) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">Đang tải thuộc tính...</div>
      </div>
    );
  }

  if (!attributes || attributes.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Không có thuộc tính nào được cấu hình cho biến thể sản phẩm.
        </AlertDescription>
      </Alert>
    );
  }

  if (!variants || variants.length === 0) {
    return (
      <Alert>
        <Package className="h-4 w-4" />
        <AlertDescription>
          Sản phẩm này chưa có biến thể nào.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Attribute Selectors */}
      {attributes.map((attribute) => {
        const availableOptions = getAvailableOptions(attribute);

        return (
          <div key={attribute.slug} className="space-y-2">
            <Label>
              {attribute.name}
              {attribute.is_required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>

            {attribute.input_type === 'color' ? (
              <div className="flex flex-wrap gap-2">
                {availableOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      handleAttributeChange(attribute.slug, option.value)
                    }
                    className={`
                      relative w-10 h-10 rounded-md border-2 transition-all
                      ${
                        selection[attribute.slug] === option.value
                          ? 'border-primary ring-2 ring-primary ring-offset-2'
                          : 'border-gray-300 hover:border-gray-400'
                      }
                    `}
                    style={{ backgroundColor: option.color_code }}
                    title={option.label}
                  >
                    {selection[attribute.slug] === option.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full shadow-md" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <Select
                value={selection[attribute.slug] || ''}
                onValueChange={(value) =>
                  handleAttributeChange(attribute.slug, value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Chọn ${attribute.name.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {availableOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {attribute.help_text && (
              <p className="text-sm text-muted-foreground">
                {attribute.help_text}
              </p>
            )}
          </div>
        );
      })}

      {/* Selected Variant Info */}
      {selectedVariant && (
        <div className="mt-6 p-4 border rounded-lg bg-muted/50">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">SKU:</span>
              <Badge variant="outline">{selectedVariant.sku}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Giá:</span>
              <span className="text-lg font-bold">
                {selectedVariant.retail_price.toLocaleString('vi-VN')} ₫
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tồn kho:</span>
              <Badge
                variant={getTotalStock(selectedVariant) > 0 ? 'default' : 'destructive'}
              >
                {getTotalStock(selectedVariant)} sản phẩm
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* No matching variant */}
      {Object.keys(selection).length > 0 && !selectedVariant && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Không tìm thấy biến thể phù hợp với lựa chọn của bạn.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
