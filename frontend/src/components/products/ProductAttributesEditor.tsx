import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle, X } from 'lucide-react';
import { attributeDefinitionsApi, type AttributeDefinition } from '@/lib/api/attribute-definitions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProductAttributesEditorProps {
  value: Record<string, any>;
  onChange: (attributes: Record<string, any>) => void;
  categoryId?: string;
}

export function ProductAttributesEditor({
  value = {},
  onChange,
  categoryId,
}: ProductAttributesEditorProps) {
  const [attributes, setAttributes] = useState<Record<string, any>>(value);

  // Fetch active attribute definitions
  const { data: allAttributeDefs = [], isLoading } = useQuery({
    queryKey: ['attributeDefinitions'],
    queryFn: () => attributeDefinitionsApi.getAll(false), // Only active
  });

  // Filter out variant attributes (those are used for product variants, not regular products)
  const attributeDefs = allAttributeDefs.filter(def => !def.is_variant_attribute);

  // Sync with parent when attributes change
  useEffect(() => {
    onChange(attributes);
  }, [attributes]);

  // Sync with parent value changes
  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(attributes)) {
      setAttributes(value);
    }
  }, [value]);

  const handleAttributeChange = (attrDef: AttributeDefinition, newValue: any) => {
    setAttributes((prev) => {
      const updated = { ...prev };

      // Remove attribute if value is empty/null
      if (newValue === '' || newValue === null || newValue === undefined) {
        delete updated[attrDef.slug];
      } else {
        updated[attrDef.slug] = newValue;
      }

      return updated;
    });
  };

  const handleMultiSelectChange = (attrDef: AttributeDefinition, optionValue: string, checked: boolean) => {
    const currentValues = (attributes[attrDef.slug] as string[]) || [];

    let newValues: string[];
    if (checked) {
      newValues = [...currentValues, optionValue];
    } else {
      newValues = currentValues.filter(v => v !== optionValue);
    }

    handleAttributeChange(attrDef, newValues.length > 0 ? newValues : undefined);
  };

  const renderAttributeInput = (attrDef: AttributeDefinition) => {
    const currentValue = attributes[attrDef.slug];

    switch (attrDef.input_type) {
      case 'text':
        return (
          <Input
            type="text"
            value={currentValue || ''}
            onChange={(e) => handleAttributeChange(attrDef, e.target.value)}
            placeholder={`Nhập ${attrDef.name.toLowerCase()}...`}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={currentValue || ''}
            onChange={(e) => handleAttributeChange(attrDef, e.target.value ? Number(e.target.value) : undefined)}
            placeholder={`Nhập ${attrDef.name.toLowerCase()}...`}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={currentValue === true || currentValue === 'true'}
              onCheckedChange={(checked) => handleAttributeChange(attrDef, checked)}
            />
            <span className="text-sm text-muted-foreground">
              {currentValue === true || currentValue === 'true' ? 'Có' : 'Không'}
            </span>
          </div>
        );

      case 'select':
        return (
          <Select
            value={currentValue?.toString() || ''}
            onValueChange={(value) => handleAttributeChange(attrDef, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Chọn ${attrDef.name.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">-- Không chọn --</SelectItem>
              {attrDef.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {attrDef.options?.map((option) => {
              const selectedValues = (currentValue as string[]) || [];
              const isChecked = selectedValues.includes(option.value);

              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange(attrDef, option.value, checked as boolean)
                    }
                  />
                  <Label className="text-sm font-normal cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              );
            })}
            {currentValue && (currentValue as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(currentValue as string[]).map((val) => {
                  const option = attrDef.options?.find(o => o.value === val);
                  return option ? (
                    <Badge key={val} variant="secondary" className="gap-1">
                      {option.label}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => handleMultiSelectChange(attrDef, val, false)}
                      />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>
        );

      case 'color':
        return (
          <div className="space-y-2">
            <Select
              value={currentValue?.toString() || ''}
              onValueChange={(value) => handleAttributeChange(attrDef, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn màu...">
                  {currentValue && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{
                          backgroundColor: attrDef.options?.find(o => o.value === currentValue)?.color_code || '#ccc'
                        }}
                      />
                      <span>{attrDef.options?.find(o => o.value === currentValue)?.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Không chọn --</SelectItem>
                {attrDef.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: option.color_code || '#ccc' }}
                      />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return (
          <Textarea
            value={currentValue || ''}
            onChange={(e) => handleAttributeChange(attrDef, e.target.value)}
            placeholder={`Nhập ${attrDef.name.toLowerCase()}...`}
            rows={2}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Đang tải thuộc tính...</p>
      </Card>
    );
  }

  if (attributeDefs.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Chưa có thuộc tính nào được định nghĩa.
          <a href="/inventory/attributes" className="text-primary hover:underline ml-1">
            Tạo thuộc tính mới
          </a>
        </p>
      </Card>
    );
  }

  // Separate required and optional attributes
  const requiredAttrs = attributeDefs.filter(def => def.is_required);
  const optionalAttrs = attributeDefs.filter(def => !def.is_required);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Required Attributes */}
        {requiredAttrs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Thuộc tính bắt buộc</h3>
            {requiredAttrs.map((attrDef) => (
              <div key={attrDef.id} className="space-y-2">
                <Label htmlFor={attrDef.slug} className="flex items-center gap-2">
                  {attrDef.name}
                  <span className="text-destructive">*</span>
                  {attrDef.help_text && (
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">{attrDef.help_text}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </Label>
                {renderAttributeInput(attrDef)}
                {attrDef.help_text && !attrDef.help_text && (
                  <p className="text-xs text-muted-foreground">{attrDef.help_text}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Optional Attributes */}
        {optionalAttrs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Thuộc tính tùy chọn</h3>
            {optionalAttrs.map((attrDef) => (
              <div key={attrDef.id} className="space-y-2">
                <Label htmlFor={attrDef.slug} className="flex items-center gap-2">
                  {attrDef.name}
                  {attrDef.help_text && (
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">{attrDef.help_text}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </Label>
                {renderAttributeInput(attrDef)}
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
