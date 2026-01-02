import { apiClient } from './client';

export type AttendanceType =
  | 'regular'
  | 'check_in_only'
  | 'check_out_only'
  | 'leave_paid'
  | 'leave_unpaid'
  | 'day_off'
  | 'absent';

export type ValidationStatus = 'valid' | 'warning' | 'error';

export interface AttendanceRecord {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  work_date: string;
  attendance_type: AttendanceType;
  regular_hours: number;
  overtime_hours: number;
  notes?: string;
  import_batch_id?: string;
  source_row_number?: number;
  source_employee_code?: string;
  raw_data?: Record<string, any>;
  validation_status?: ValidationStatus;
  validation_notes?: string;
  created_at: Date;
  updated_at: Date;
  user_profiles?: {
    id: string;
    full_name: string;
    employee_code?: string;
    role: string;
  };
  payroll_periods?: {
    id: string;
    period_code: string;
    period_name: string;
    period_year: number;
    period_month: number;
  };
}

export interface AttendanceImportLog {
  id: string;
  payroll_period_id: string;
  file_name: string;
  file_size: number;
  file_type: 'xlsx' | 'csv';
  status: 'processing' | 'completed' | 'failed';
  total_rows?: number;
  successful_rows?: number;
  warning_rows?: number;
  error_rows?: number;
  error_message?: string;
  error_details?: Array<{ row: number; column?: string; message: string }>;
  import_summary?: Record<string, any>;
  imported_by: string;
  created_at: Date;
  completed_at?: Date;
  user_profiles?: {
    id: string;
    full_name: string;
  };
}

export interface ImportAttendanceResult {
  importLogId: string;
  summary: {
    totalRows: number;
    successfulRows: number;
    warningRows: number;
    errorRows: number;
  };
  periodInfo?: {
    title?: string;
    periodText?: string;
    branch?: string;
    dateRange?: string;
  };
  errors: Array<{ row: number; column?: string; message: string }>;
}

export interface ManualAttendanceDto {
  payroll_period_id: string;
  employee_id: string;
  work_date: string;
  attendance_type: AttendanceType;
  regular_hours?: number;
  overtime_hours?: number;
  notes?: string;
}

export interface UpdateAttendanceDto {
  attendance_type?: AttendanceType;
  regular_hours?: number;
  overtime_hours?: number;
  notes?: string;
}

export interface AttendanceRecordQuery {
  payroll_period_id?: string;
  employee_id?: string;
  work_date?: string;
  validation_status?: ValidationStatus;
}

export interface AttendanceSummary {
  totalDays: number;
  regularDays: number;
  checkInOnlyDays: number;
  checkOutOnlyDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
}

export const attendanceApi = {
  // Import
  import: async (
    periodId: string,
    file: File,
    clearExisting: boolean = true
  ): Promise<ImportAttendanceResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clear_existing', String(clearExisting));

    const response = await apiClient.post(
      `/attendance/import/${periodId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Import logs
  getImportLogs: async (periodId: string): Promise<AttendanceImportLog[]> => {
    const response = await apiClient.get(`/attendance/import-logs/${periodId}`);
    return response.data;
  },

  getImportLog: async (id: string): Promise<AttendanceImportLog> => {
    const response = await apiClient.get(`/attendance/import-log/${id}`);
    return response.data;
  },

  // Records
  getRecords: async (query?: AttendanceRecordQuery): Promise<AttendanceRecord[]> => {
    const response = await apiClient.get('/attendance/records', { params: query });
    return response.data;
  },

  getEmployeeRecords: async (
    employeeId: string,
    periodId?: string
  ): Promise<AttendanceRecord[]> => {
    const response = await apiClient.get(`/attendance/employee/${employeeId}`, {
      params: periodId ? { period_id: periodId } : undefined,
    });
    return response.data;
  },

  getSummary: async (periodId: string, employeeId: string): Promise<AttendanceSummary> => {
    const response = await apiClient.get(`/attendance/summary/${periodId}/${employeeId}`);
    return response.data;
  },

  // Manual entry
  createManual: async (data: ManualAttendanceDto): Promise<AttendanceRecord> => {
    const response = await apiClient.post('/attendance/records/manual', data);
    return response.data;
  },

  update: async (id: string, data: UpdateAttendanceDto): Promise<AttendanceRecord> => {
    const response = await apiClient.patch(`/attendance/records/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/attendance/records/${id}`);
  },
};
