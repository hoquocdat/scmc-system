// User Roles
export type UserRole = 'sales' | 'technician' | 'manager' | 'finance';

// Service Status
export type ServiceStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'waiting_parts'
  | 'waiting_approval'
  | 'quality_check'
  | 'completed'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled';

// Priority Level
export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

// Payment Method
export type PaymentMethod = 'cash' | 'card' | 'transfer';

// Owner Type
export type OwnerType = 'individual' | 'company';

// User Profile
export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Customer (individual only - can be both owner and/or person bringing bike)
export interface Customer {
  id: string;
  full_name: string;
  id_number?: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  facebook?: string;
  instagram?: string;
  created_at: string;
  updated_at: string;
}

// Bike (Motorcycle in database)
export interface Motorcycle {
  id: string;
  owner_id: string;
  brand: string;
  model: string;
  year?: number;
  license_plate: string;
  vin?: string;
  engine_number?: string;
  color?: string;
  image_url?: string; // Primary image for backward compatibility
  image_urls?: string[]; // Array of all images for gallery
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Service Order
export interface ServiceOrder {
  id: string;
  order_number: string;
  motorcycle_id: string;
  customer_id: string; // Person who brought the bike (motorcycle.owner_id is the legal owner)
  assigned_employee_id?: string;
  status: ServiceStatus;
  priority: PriorityLevel;
  description?: string;
  customer_demand?: string;
  mileage_in?: number;
  mileage_out?: number;
  drop_off_date: string;
  estimated_completion_date?: string;
  actual_completion_date?: string;
  pickup_date?: string;
  picked_up_by?: string;
  pickup_id_verified: boolean;
  estimated_cost?: number;
  final_cost?: number;
  created_at: string;
  updated_at: string;
}

// Service Item
export interface ServiceItem {
  id: string;
  service_order_id: string;
  name: string;
  description?: string;
  status: ServiceStatus;
  labor_cost: number;
  parts_cost: number;
  hours_worked: number;
  assigned_employee_id?: string;
  created_at: string;
  updated_at: string;
}

// Supplier
export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Brand
export interface Brand {
  id: string;
  name: string;
  country_of_origin?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Part
export interface Part {
  id: string;
  part_number?: string;
  name: string;
  category?: string;
  description?: string;
  quantity_in_stock: number;
  minimum_stock_level: number;
  unit_cost?: number;
  supplier_id?: string;
  brand_id?: string;
  supplier?: string; // Legacy field
  created_at: string;
  updated_at: string;
}

// Service Part
export interface ServicePart {
  id: string;
  service_order_id: string;
  service_item_id?: string;
  part_id: string;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
}

// Payment
export interface Payment {
  id: string;
  service_order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  is_deposit: boolean;
  payment_date: string;
  received_by?: string;
  notes?: string;
  created_at: string;
}

// Activity Log
export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  action: string;
  details?: string;
  created_at: string;
}

// Auth State
export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
