import { Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import Select, { components } from 'react-select';
import { Label } from '@/components/ui/label';
import type { UserProfile } from '@/types';
import { selectStyles } from './select-styles';

// Custom option component for employees
const EmployeeOption = (props: any) => {
  const { data, innerRef, innerProps } = props;
  return (
    <div ref={innerRef} {...innerProps} className="px-3 py-2 cursor-pointer hover:bg-accent">
      <div className="font-medium">{data.label}</div>
      {data.phone && <div className="text-sm text-muted-foreground">{data.phone}</div>}
    </div>
  );
};

// Custom single value component for employees
const EmployeeSingleValue = (props: any) => {
  const { data } = props;
  return (
    <components.SingleValue {...props}>
      <div className="flex items-center" >
        <div>
          <div className="font-medium text-sm">{data.label}</div>
          {data.phone && <div className="text-xs text-muted-foreground">{data.phone}</div>}
        </div>
      </div>
    </components.SingleValue>
  );
};

// Helper to create employee options
export const createEmployeeOptions = (employees: UserProfile[], includeUnassigned = false) => {
  const options = employees.map(employee => ({
    value: employee.id,
    label: employee.full_name,
    phone: employee.phone,
  }));

  if (includeUnassigned) {
    return [{ value: 'unassigned', label: 'Chưa phân công', phone: null }, ...options];
  }

  return options;
};

interface EmployeeSelectProps {
  control: Control<any>;
  name: string;
  employees: UserProfile[];
  label?: string;
  placeholder?: string;
}

export function EmployeeSelect({ control, name, employees, label = 'Phân Công Nhân Viên', placeholder = 'Chưa phân công...' }: EmployeeSelectProps) {
  const employeeOptions = createEmployeeOptions(employees);

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            {...field}
            options={employeeOptions}
            value={employeeOptions.find(option => option.value === field.value) || null}
            onChange={(option) => field.onChange(option?.value || '')}
            placeholder={placeholder}
            isClearable
            styles={selectStyles}
            components={{
              Option: EmployeeOption,
              SingleValue: EmployeeSingleValue,
            }}
            noOptionsMessage={() => 'Không tìm thấy nhân viên'}
          />
        )}
      />
    </div>
  );
}

// Multi-select version for filters
interface EmployeeMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  employees: UserProfile[];
  placeholder?: string;
}

export function EmployeeMultiSelect({ value, onChange, employees, placeholder = 'Chọn nhân viên...' }: EmployeeMultiSelectProps) {
  const employeeOptions = createEmployeeOptions(employees, true);

  return (
    <Select
      isMulti
      options={employeeOptions}
      value={employeeOptions.filter(opt => value.includes(opt.value))}
      onChange={(selected) => onChange(selected.map(s => s.value))}
      placeholder={placeholder}
      styles={selectStyles}
      isClearable={false}
      closeMenuOnSelect={false}
      components={{
        Option: EmployeeOption,
      }}
      noOptionsMessage={() => 'Không có lựa chọn'}
    />
  );
}
