export interface User {
  id: number;
  username: string;
  email?: string | null;
  provider_keys: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ProviderInfo {
  id: string;
  default_model: string;
  available: boolean;
  source: string;
  detail: string;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
}

export interface ChatResponse {
  conversation_id: number;
  reply: string;
  provider: string;
  model: string;
  mode: string;
  tool_calls: ToolCall[];
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  tool_calls: ToolCall[];
}

export interface Conversation {
  id: number;
  title: string;
  provider: string;
  model: string;
  mode: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[];
}

export type ChatMode = "agent" | "chat";

export interface Customer {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  site_address: string;
}

export interface Job {
  id: string;
  title: string;
  customer: string;
  customer_id: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  assigned_tech: string | null;
}

export interface Invoice {
  id: string;
  customer: string;
  customer_id: string;
  job_id: string | null;
  amount: number;
  issued_date: string | null;
  due_date: string | null;
  status: string;
  overdue: boolean;
  days_overdue: number;
}

export interface Quote {
  id: string;
  job_id: string;
  customer: string;
  line_items: { description: string; qty: number; unit_price: number }[];
  labour_hours: number;
  labour_rate: number;
  materials_total: number;
  labour_total: number;
  subtotal: number;
  gst: number;
  total: number;
  notes: string;
  status: string;
}

export interface Message {
  id: string;
  reference_id: string;
  purpose: string;
  body: string;
  status: string;
}

export interface MonthRevenue {
  month: string;
  label: string;
  collected: number;
  billed: number;
}

export interface OverdueTop {
  id: string;
  customer: string;
  amount: number;
  days_overdue: number;
}

export interface SummarizeResponse {
  summary: string;
  provider: string;
  model: string;
}

export interface Metrics {
  revenue_collected: number;
  outstanding: number;
  overdue_amount: number;
  overdue_count: number;
  billed_total: number;
  collection_rate: number;
  avg_invoice: number;
  invoices_total: number;
  invoices_paid: number;
  invoices_unpaid: number;
  customers_total: number;
  active_customers: number;
  repeat_customers: number;
  repeat_rate: number;
  jobs_total: number;
  active_jobs: number;
  high_priority_jobs: number;
  jobs_by_status: Record<string, number>;
  quotes_count: number;
  quote_pipeline: number;
  top_overdue: OverdueTop[];
  revenue_by_month: MonthRevenue[];
}
