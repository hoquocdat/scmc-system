import { apiClient } from './client';

export type PayrollPeriodStatus = 'draft' | 'published' | 'finalized' | 'paid';
export type PayrollSlipStatus =
  | 'draft'
  | 'published'
  | 'disputed'
  | 'confirmed'
  | 'finalized'
  | 'paid';

export interface EmployeeInfo {
  id: string;
  full_name: string;
  employee_code?: string;
  email?: string;
  role?: string;
}

export interface PayrollPeriod {
  id: string;
  period_code: string;
  period_name: string;
  period_year: number;
  period_month: number;
  period_start_date: string;
  period_end_date: string;
  status: PayrollPeriodStatus;
  confirmation_deadline?: string;
  notes?: string;
  internal_notes?: string;
  total_employees?: number;
  total_gross_pay?: number;
  total_deductions?: number;
  total_net_pay?: number;
  confirmed_count?: number;
  disputed_count?: number;
  published_at?: string;
  published_by?: string;
  finalized_at?: string;
  finalized_by?: string;
  finalize_reason?: string;
  paid_at?: string;
  paid_by?: string;
  payment_method?: string;
  payment_reference?: string;
  created_by_id?: string;
  created_at: Date;
  updated_at: Date;
  user_profiles_payroll_periods_created_by_idTouser_profiles?: EmployeeInfo;
  user_profiles_payroll_periods_published_byTouser_profiles?: EmployeeInfo;
  user_profiles_payroll_periods_finalized_byTouser_profiles?: EmployeeInfo;
  user_profiles_payroll_periods_paid_byTouser_profiles?: EmployeeInfo;
}

export interface PayrollSlip {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  salary_config_id?: string;
  status: PayrollSlipStatus;
  total_work_days: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_leave_days: number;
  total_absent_days: number;
  total_late_minutes: number;
  base_salary_amount: number;
  attendance_earnings: number;
  overtime_earnings: number;
  bonus_amount: number;
  allowances_amount: number;
  other_earnings: number;
  gross_pay: number;
  social_insurance_deduction: number;
  health_insurance_deduction: number;
  unemployment_insurance_deduction: number;
  tax_deduction: number;
  advance_deduction: number;
  absence_deduction: number;
  late_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  earnings_details?: Record<string, any>;
  deductions_details?: Record<string, any>;
  allowances_details?: Record<string, any>;
  calculation_notes?: string;
  calculated_at?: string;
  confirmed_at?: string;
  confirmation_comment?: string;
  is_late_confirmation?: boolean;
  disputed_at?: string;
  dispute_reason?: string;
  dispute_resolved_at?: string;
  dispute_resolution?: string;
  adjustment_amount?: number;
  adjustment_reason?: string;
  finalized_at?: string;
  paid_at?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  user_profiles_payroll_slips_employee_idTouser_profiles?: EmployeeInfo;
  payroll_periods?: PayrollPeriod;
  employee_salary_configs?: any;
  payroll_adjustments?: PayrollAdjustment[];
}

export interface PayrollAdjustment {
  id: string;
  payroll_slip_id: string;
  adjustment_type: 'bonus' | 'deduction' | 'correction';
  amount: number;
  reason: string;
  previous_net_pay: number;
  new_net_pay: number;
  adjusted_by: string;
  created_at: Date;
  user_profiles?: EmployeeInfo;
}

// DTOs
export interface CreatePayrollPeriodDto {
  period_year: number;
  period_month: number;
  period_name?: string;
  confirmation_deadline?: string;
  notes?: string;
}

export interface UpdatePayrollPeriodDto {
  period_name?: string;
  confirmation_deadline?: string;
  notes?: string;
  internal_notes?: string;
}

export interface AdjustPayrollSlipDto {
  adjustment_type: 'bonus' | 'deduction' | 'correction';
  amount: number;
  reason: string;
}

export interface ConfirmPayrollDto {
  comment?: string;
}

export interface DisputePayrollDto {
  reason: string;
}

export interface ResolveDisputeDto {
  resolution: string;
  adjustment_amount?: number;
}

export interface FinalizePeriodDto {
  override_reason?: string;
}

export interface MarkPaidDto {
  payment_method?: string;
  payment_reference?: string;
}

export interface PayrollPeriodQuery {
  year?: number;
  status?: PayrollPeriodStatus;
  page?: number;
  limit?: number;
}

export interface MyPayrollQuery {
  year?: number;
  status?: PayrollSlipStatus;
}

export interface GeneratePayrollResult {
  periodId: string;
  generatedSlips: number;
  errors: Array<{ employeeId: string; error: string }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const payrollApi = {
  // Periods
  getPeriods: async (
    query?: PayrollPeriodQuery
  ): Promise<PaginatedResponse<PayrollPeriod>> => {
    const response = await apiClient.get('/payroll/periods', { params: query });
    return response.data;
  },

  getPeriod: async (id: string): Promise<PayrollPeriod> => {
    const response = await apiClient.get(`/payroll/periods/${id}`);
    return response.data;
  },

  createPeriod: async (data: CreatePayrollPeriodDto): Promise<PayrollPeriod> => {
    const response = await apiClient.post('/payroll/periods', data);
    return response.data;
  },

  updatePeriod: async (
    id: string,
    data: UpdatePayrollPeriodDto
  ): Promise<PayrollPeriod> => {
    const response = await apiClient.patch(`/payroll/periods/${id}`, data);
    return response.data;
  },

  // Generation
  generatePayroll: async (periodId: string): Promise<GeneratePayrollResult> => {
    const response = await apiClient.post(`/payroll/periods/${periodId}/generate`);
    return response.data;
  },

  // Workflow actions
  publishPeriod: async (id: string): Promise<PayrollPeriod> => {
    const response = await apiClient.post(`/payroll/periods/${id}/publish`);
    return response.data;
  },

  finalizePeriod: async (
    id: string,
    data?: FinalizePeriodDto
  ): Promise<PayrollPeriod> => {
    const response = await apiClient.post(`/payroll/periods/${id}/finalize`, data);
    return response.data;
  },

  markPaid: async (id: string, data?: MarkPaidDto): Promise<PayrollPeriod> => {
    const response = await apiClient.post(`/payroll/periods/${id}/mark-paid`, data);
    return response.data;
  },

  // Slips
  getSlipsForPeriod: async (periodId: string): Promise<PayrollSlip[]> => {
    const response = await apiClient.get(`/payroll/periods/${periodId}/slips`);
    return response.data;
  },

  getSlip: async (id: string): Promise<PayrollSlip> => {
    const response = await apiClient.get(`/payroll/slips/${id}`);
    return response.data;
  },

  adjustSlip: async (
    id: string,
    data: AdjustPayrollSlipDto
  ): Promise<PayrollSlip> => {
    const response = await apiClient.patch(`/payroll/slips/${id}/adjust`, data);
    return response.data;
  },

  // Employee self-service
  getMyPayroll: async (query?: MyPayrollQuery): Promise<PayrollSlip[]> => {
    const response = await apiClient.get('/payroll/my-payroll', { params: query });
    return response.data;
  },

  confirmSlip: async (id: string, data?: ConfirmPayrollDto): Promise<PayrollSlip> => {
    const response = await apiClient.post(`/payroll/slips/${id}/confirm`, data);
    return response.data;
  },

  disputeSlip: async (id: string, data: DisputePayrollDto): Promise<PayrollSlip> => {
    const response = await apiClient.post(`/payroll/slips/${id}/dispute`, data);
    return response.data;
  },

  resolveDispute: async (
    id: string,
    data: ResolveDisputeDto
  ): Promise<PayrollSlip> => {
    const response = await apiClient.post(`/payroll/slips/${id}/resolve-dispute`, data);
    return response.data;
  },
};
