import { Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import Select from 'react-select';
import { Label } from '@/components/ui/label';
import type { Customer } from '@/types';
import { selectStyles } from './select-styles';

// Custom option component for customers
const CustomerOption = (props: any) => {
  const { data, innerRef, innerProps } = props;
  return (
    <div ref={innerRef} {...innerProps} className="px-3 py-2 cursor-pointer hover:bg-accent">
      <div className="font-medium">{data.label}</div>
      {data.phone && <div className="text-sm text-muted-foreground">{data.phone}</div>}
    </div>
  );
};

// Custom single value component for customers
const CustomerSingleValue = (props: any) => {
  const { data } = props;
  return (
    <div className="flex items-center">
      <div>
        <div className="font-medium text-sm">{data.label}</div>
        {data.phone && <div className="text-xs text-muted-foreground">{data.phone}</div>}
      </div>
    </div>
  );
};

interface CustomerSelectProps {
  control: Control<any>;
  name: string;
  customers: Customer[];
  error?: string;
  required?: boolean;
  selectedCustomer?: Customer;
}

export function CustomerSelect({
  control,
  name,
  customers,
  error,
  required = false,
  selectedCustomer
}: CustomerSelectProps) {
  const customerOptions = customers.map(customer => ({
    value: customer.id,
    label: customer.full_name,
    phone: customer.phone,
  }));

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        Bước 1: Chọn Khách Hàng {required && '*'} (Người mang xe)
      </Label>
      <Controller
        name={name}
        control={control}
        rules={required ? { required: 'Vui lòng chọn khách hàng' } : undefined}
        render={({ field }) => (
          <Select
            {...field}
            options={customerOptions}
            value={customerOptions.find(option => option.value === field.value) || null}
            onChange={(option) => field.onChange(option?.value || '')}
            placeholder="Tìm kiếm khách hàng..."
            isClearable
            styles={selectStyles}
            components={{
              Option: CustomerOption,
              SingleValue: CustomerSingleValue,
            }}
            noOptionsMessage={() => 'Không tìm thấy khách hàng'}
          />
        )}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {customers.length === 0 && (
        <p className="text-sm text-amber-600">
          Không tìm thấy khách hàng. Vui lòng đăng ký khách hàng trước.
        </p>
      )}
      {selectedCustomer && (
        <div className="bg-blue-50 border border-blue-200 px-3 py-2 rounded text-sm">
          <p className="font-medium text-blue-900">Khách hàng đã chọn:</p>
          <p className="text-blue-800">{selectedCustomer.full_name}</p>
        </div>
      )}
    </div>
  );
}
