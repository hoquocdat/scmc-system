import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { EmployeeProfileRow } from '../shared/EmployeeProfileRow';

interface AssignedEmployeeCardProps {
  employee?: {
    full_name: string;
    role: string;
  };
  onEdit: () => void;
}

export function AssignedEmployeeCard({ employee, onEdit }: AssignedEmployeeCardProps) {
  const { t } = useTranslation();

  return (
    <div className="pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-muted-foreground">
          {t('serviceOrders.assignedEmployee')}
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-7 text-xs"
        >
          Chỉnh Sửa
        </Button>
      </div>
      {employee ? (
        <EmployeeProfileRow
          fullName={employee.full_name}
          role={employee.role}
        />
      ) : (
        <p className="text-sm text-muted-foreground italic">Chưa phân công</p>
      )}
    </div>
  );
}
