import { apiClient } from './client';

export type SalaryType = 'monthly' | 'daily' | 'hourly';

export interface EmployeeInfo {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  employee_code?: string;
  is_active: boolean;
}

export interface SalaryConfig {
  id: string;
  employee_id: string;
  salary_type: SalaryType;
  base_salary: number;
  standard_work_days_per_month?: number;
  standard_hours_per_day?: number;
  overtime_rate_weekday?: number;
  overtime_rate_weekend?: number;
  overtime_rate_holiday?: number;
  lunch_allowance?: number;
  transport_allowance?: number;
  phone_allowance?: number;
  other_allowances?: Record<string, number>;
  social_insurance_rate?: number;
  health_insurance_rate?: number;
  unemployment_insurance_rate?: number;
  effective_from?: string;
  effective_to?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  user_profiles_employee_salary_configs_employee_idTouser_profiles?: EmployeeInfo;
}

export interface CreateSalaryConfigDto {
  employee_id: string;
  salary_type: SalaryType;
  base_salary: number;
  standard_work_days_per_month?: number;
  standard_hours_per_day?: number;
  overtime_rate_weekday?: number;
  overtime_rate_weekend?: number;
  overtime_rate_holiday?: number;
  lunch_allowance?: number;
  transport_allowance?: number;
  phone_allowance?: number;
  other_allowances?: Record<string, number>;
  social_insurance_rate?: number;
  health_insurance_rate?: number;
  unemployment_insurance_rate?: number;
  effective_from?: string;
  effective_to?: string;
  notes?: string;
}

export interface UpdateSalaryConfigDto {
  salary_type?: SalaryType;
  base_salary?: number;
  standard_work_days_per_month?: number;
  standard_hours_per_day?: number;
  overtime_rate_weekday?: number;
  overtime_rate_weekend?: number;
  overtime_rate_holiday?: number;
  lunch_allowance?: number;
  transport_allowance?: number;
  phone_allowance?: number;
  other_allowances?: Record<string, number>;
  social_insurance_rate?: number;
  health_insurance_rate?: number;
  unemployment_insurance_rate?: number;
  effective_from?: string;
  effective_to?: string;
  notes?: string;
}

export const salaryConfigApi = {
  getAll: async (): Promise<SalaryConfig[]> => {
    const response = await apiClient.get('/salary-configs');
    return response.data;
  },

  getByEmployee: async (employeeId: string): Promise<SalaryConfig> => {
    const response = await apiClient.get(`/salary-configs/employee/${employeeId}`);
    return response.data;
  },

  getOne: async (id: string): Promise<SalaryConfig> => {
    const response = await apiClient.get(`/salary-configs/${id}`);
    return response.data;
  },

  create: async (data: CreateSalaryConfigDto): Promise<SalaryConfig> => {
    const response = await apiClient.post('/salary-configs', data);
    return response.data;
  },

  update: async (id: string, data: UpdateSalaryConfigDto): Promise<SalaryConfig> => {
    const response = await apiClient.patch(`/salary-configs/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/salary-configs/${id}`);
  },

  getEmployeesWithoutConfig: async (): Promise<EmployeeInfo[]> => {
    const response = await apiClient.get('/salary-configs/employees-without-config');
    return response.data;
  },
};
