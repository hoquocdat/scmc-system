import { getRoleLabel } from '@/lib/utils/roleLabels';

interface EmployeeProfileRowProps {
  fullName: string;
  role?: string;
  avatarUrl?: string;
  employeeCode?: string;
}

export function EmployeeProfileRow({ fullName, role, avatarUrl, employeeCode }: EmployeeProfileRowProps) {
  // Get initials from full name for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-xs font-medium text-white">
              {getInitials(fullName)}
            </span>
          </div>
        )}
      </div>

      {/* Name and Role */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-gray-900 truncate">
          {employeeCode && (
            <span className="font-mono text-xs text-gray-500 mr-2">{employeeCode}</span>
          )}
          {fullName}
        </span>
        {role && (
          <span className="text-xs text-gray-500 truncate">
            {getRoleLabel(role)}
          </span>
        )}
      </div>
    </div>
  );
}
