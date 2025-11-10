export interface ActivityLog {
  id: string;
  user_id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'payment_added'
  | 'payment_deleted';

export type EntityType =
  | 'service_order'
  | 'customer'
  | 'bike'
  | 'payment'
  | 'part'
  | 'user'
  | 'comment';
