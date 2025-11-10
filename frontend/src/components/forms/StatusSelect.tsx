import Select from 'react-select';
import { selectStyles } from './select-styles';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'in_progress', label: 'Đang sửa' },
  { value: 'waiting_parts', label: 'Chờ phụ tùng' },
  { value: 'quality_check', label: 'Kiểm tra chất lượng' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'ready_for_pickup', label: 'Sẵn sàng giao' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export const STATUS_LABELS: Record<string, string> = {
  'pending': 'Chờ xác nhận',
  'confirmed': 'Đã xác nhận',
  'in_progress': 'Đang sửa',
  'waiting_parts': 'Chờ phụ tùng',
  'quality_check': 'Kiểm tra chất lượng',
  'completed': 'Hoàn thành',
  'ready_for_pickup': 'Sẵn sàng giao',
  'delivered': 'Đã giao',
  'cancelled': 'Đã hủy',
};

interface StatusMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function StatusMultiSelect({ value, onChange, placeholder = 'Chọn trạng thái...' }: StatusMultiSelectProps) {
  return (
    <Select
      isMulti
      options={STATUS_OPTIONS}
      value={STATUS_OPTIONS.filter(opt => value.includes(opt.value))}
      onChange={(selected) => onChange(selected.map(s => s.value))}
      placeholder={placeholder}
      styles={selectStyles}
      isClearable={false}
      closeMenuOnSelect={false}
      noOptionsMessage={() => 'Không có lựa chọn'}
    />
  );
}
