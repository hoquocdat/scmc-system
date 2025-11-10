import Select from 'react-select';
import { selectStyles } from './select-styles';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high', label: 'Cao' },
  { value: 'urgent', label: 'Khẩn cấp' },
];

export const PRIORITY_LABELS: Record<string, string> = {
  'low': 'Thấp',
  'normal': 'Bình thường',
  'high': 'Cao',
  'urgent': 'Khẩn cấp',
};

interface PriorityMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function PriorityMultiSelect({ value, onChange, placeholder = 'Chọn mức độ ưu tiên...' }: PriorityMultiSelectProps) {
  return (
    <Select
      isMulti
      options={PRIORITY_OPTIONS}
      value={PRIORITY_OPTIONS.filter(opt => value.includes(opt.value))}
      onChange={(selected) => onChange(selected.map(s => s.value))}
      placeholder={placeholder}
      styles={selectStyles}
      isClearable={false}
      closeMenuOnSelect={false}
      noOptionsMessage={() => 'Không có lựa chọn'}
    />
  );
}
