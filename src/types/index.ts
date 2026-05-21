export type TradeType = 'electrical' | 'roofing' | 'hvac' | 'painting' | 'plumbing' | 'drain' | 'general' | 'other';
export type StatusType = 'lead' | 'bidding' | 'sent' | 'approved' | 'won' | 'lost';
export type CategoryType = 'material' | 'labor' | 'equipment' | 'other';
export type UserRole = 'super_admin' | 'admin' | 'sales_manager' | 'estimator' | 'technician' | 'viewer';
export type OptionTier = 'base' | 'good' | 'better' | 'best' | 'upsell';
export type BillingTier = 'free' | 'pro' | 'enterprise';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_logo: string;
  default_labor_markup: number;
  default_material_markup: number;
  default_equipment_markup: number;
  default_tax_rate: number;
  is_admin?: boolean;
  onboarding_completed: boolean;
  onboarding_dismissed?: boolean;
  onboarding_step: number;
  notification_prefs: {
    email: boolean;
    in_app: boolean;
    digest: boolean;
  };
  has_dismissed_helpers: string[];
  health_score: number;
  customer_tags: string[];
  assigned_success_manager: string | null;
  concierge_requested: boolean;
  concierge_details: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityEvent {
  id: string;
  user_id: string;
  entity_type: 'estimate' | 'support' | 'integration' | 'member' | 'onboarding';
  entity_id?: string;
  action_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface IntegrationRequest {
  id: string;
  user_id: string;
  business_need: string;
  current_tool: string;
  desired_workflow: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  expected_outcome: string;
  attachment_url?: string;
  status: 'pending review' | 'under analysis' | 'planned' | 'in progress' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  admin_notes?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  category: 'billing' | 'technical' | 'bug' | 'feature' | 'other';
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in progress' | 'resolved' | 'closed';
  attachment_url?: string;
  assigned_to?: string;
  admin_notes?: string;
  sla_timer?: string;
  created_at: string;
  updated_at: string;
}

export interface TicketResponse {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  user_profile?: Partial<Profile>;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'activity' | 'support';
  is_read: boolean;
  created_at: string;
}

export interface EmailLog {
  id: string;
  user_id?: string;
  recipient_email: string;
  template_type: string;
  subject: string;
  delivery_status: 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked' | 'bounced';
  provider: string;
  provider_message_id?: string;
  error_message?: string;
  html_preview?: string;
  metadata: Record<string, any>;
  created_at: string;
}


export interface Project {
  id: string;
  user_id: string;
  name: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: StatusType;
  trade: TradeType;
  subtotal: number;
  margin_amount: number;
  tax_amount: number;
  total_value: number;
  labor_markup: number;
  material_markup: number;
  equipment_markup: number;
  tax_rate: number;
  notes: string;
  share_token: string;
  client_approved_at: string | null;
  signature_data?: string | null;
  client_message: string;
  follow_up_sent_at: string | null;
  project_address: string;
  start_date: string;
  valid_until: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_logo: string;
  is_multi_option?: boolean;
  selected_option_tier?: 'good' | 'better' | 'best' | null;
  organization_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProjectItem {
  id: string;
  project_id: string;
  user_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category: CategoryType;
  markup: number;
  total: number;
  sort_order: number;
  from_price_book: boolean;
  // Multi-option tier (additive — null/undefined = base)
  option_tier?: OptionTier;
  is_selected?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Enterprise / Multi-Tenant Types ──────────────────────────────

export interface Organization {
  id: string;
  name: string;
  subdomain?: string;
  logo_url?: string;
  billing_tier: BillingTier;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  profile_id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  organization_id: string;
  company_colors: { primary: string; secondary: string };
  invoice_terms: string;
  payment_methods: string[];
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  actor_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  original_value: Record<string, any>;
  new_value: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface ProposalVersion {
  id: string;
  organization_id: string;
  project_id: string;
  version_number: number;
  items_snapshot: ProjectItem[];
  notes_snapshot?: string;
  totals_snapshot: {
    subtotal: number;
    marginAmount: number;
    taxAmount: number;
    total: number;
    good_total?: number;
    better_total?: number;
    best_total?: number;
  };
  created_at: string;
}

export interface Template {
  id: string;
  organization_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  trade: TradeType;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  items?: TemplateItem[];
}

export interface TemplateItem {
  id: string;
  template_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category: CategoryType;
  markup: number;
  sort_order: number;
}

export interface BackgroundJob {
  id: string;
  organization_id: string;
  job_type: string;
  payload: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retry_count: number;
  last_error?: string;
  scheduled_at: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  stripe_subscription_id?: string;
  status: 'active' | 'past_due' | 'canceled';
  price_id?: string;
  current_period_end?: string;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  organization_id?: string;
  name: string;
  description?: string;
  enabled_globally: boolean;
  enabled_for_users: string[];
  beta_users: string[];
  rollout_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface AIUsageLimit {
  organization_id: string;
  monthly_limit_cents: number;
  monthly_usage_cents: number;
  last_reset_date: string;
  max_requests_per_minute: number;
  request_counter: number;
  updated_at: string;
}


export interface PriceBookItem {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  trade: TradeType;
  category: CategoryType;
  default_unit_price: number;
  unit: string;
  default_markup: number;
  tags: string;
  is_global: boolean;
  created_at?: string;
}

export interface TotalsResult {
  subtotal: number;
  laborSub: number;
  matSub: number;
  eqSub: number;
  otherSub: number;
  marginAmount: number;
  taxAmount: number;
  total: number;
}

export const TRADE_EMOJIS: Record<TradeType, string> = {
  electrical: '⚡',
  roofing: '🏠',
  hvac: '❄️',
  painting: '🎨',
  plumbing: '🔧',
  drain: '🚿',
  general: '🏗️',
  other: '📋',
};

export const STATUS_COLORS: Record<StatusType, string> = {
  lead: 'status-lead',
  bidding: 'status-bidding',
  sent: 'status-sent',
  approved: 'status-approved',
  won: 'status-won',
  lost: 'status-lost',
};

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  material: 'category-material',
  labor: 'category-labor',
  equipment: 'category-equipment',
  other: 'category-other',
};
