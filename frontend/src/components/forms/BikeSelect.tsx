import { Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import Select from 'react-select';
import { Label } from '@/components/ui/label';
import { selectStyles } from './select-styles';

// Custom option component for bikes
const BikeOption = (props: any) => {
  const { data, innerRef, innerProps } = props;
  return (
    <div ref={innerRef} {...innerProps} className="px-3 py-2 cursor-pointer hover:bg-accent">
      <div className="font-medium">{data.label}</div>
      {data.licensePlate && <div className="text-sm text-muted-foreground font-mono">{data.licensePlate}</div>}
    </div>
  );
};

// Custom single value component for bikes
const BikeSingleValue = (props: any) => {
  const { data } = props;
  return (
    <div className="flex items-center">
      <div>
        <div className="font-medium text-sm">{data.label}</div>
        {data.licensePlate && <div className="text-xs text-muted-foreground font-mono">{data.licensePlate}</div>}
      </div>
    </div>
  );
};

interface BikeSelectProps {
  control: Control<any>;
  name: string;
  motorcycles: any[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
  customerId?: string;
  selectedCustomerName?: string;
  selectedMotorcycle?: any;
}

export function BikeSelect({
  control,
  name,
  motorcycles,
  error,
  required = false,
  disabled = false,
  customerId,
  selectedCustomerName,
  selectedMotorcycle
}: BikeSelectProps) {
  const bikeOptions = motorcycles.map(moto => ({
    value: moto.id,
    label: `${moto.brand} ${moto.model}${moto.year ? ` (${moto.year})` : ''}`,
    licensePlate: moto.license_plate,
    year: moto.year,
  }));

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        Bước 2: Chọn Xe {required && '*'} {customerId && selectedCustomerName && `(Chủ xe: ${selectedCustomerName})`}
      </Label>
      <Controller
        name={name}
        control={control}
        rules={required ? { required: 'Vui lòng chọn xe' } : undefined}
        render={({ field }) => (
          <Select
            {...field}
            options={bikeOptions}
            value={bikeOptions.find(option => option.value === field.value) || null}
            onChange={(option) => field.onChange(option?.value || '')}
            placeholder={customerId ? 'Tìm kiếm xe...' : 'Vui lòng chọn khách hàng trước...'}
            isClearable
            isDisabled={disabled}
            styles={selectStyles}
            components={{
              Option: BikeOption,
              SingleValue: BikeSingleValue,
            }}
            noOptionsMessage={() => 'Không tìm thấy xe'}
          />
        )}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {customerId && motorcycles.length === 0 && (
        <p className="text-sm text-amber-600">
          Không tìm thấy xe cho khách hàng này. Vui lòng đăng ký xe trước.
        </p>
      )}
      {selectedMotorcycle && (
        <div className="bg-green-50 border border-green-200 px-3 py-2 rounded text-sm">
          <p className="font-medium text-green-900">Xe đã chọn:</p>
          <p className="text-green-800">
            {selectedMotorcycle.license_plate} - {selectedMotorcycle.brand} {selectedMotorcycle.model}
          </p>
        </div>
      )}
    </div>
  );
}
