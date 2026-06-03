import { api } from "./client";
import type {
  ChatMode,
  ChatResponse,
  Conversation,
  ConversationDetail,
  Customer,
  Invoice,
  Job,
  Message,
  Metrics,
  ProviderInfo,
  Quote,
  TokenResponse,
  User,
} from "./types";

// --- auth ---
export const authApi = {
  register: (username: string, password: string, email?: string) =>
    api.post<TokenResponse>("/auth/register", { username, password, email }).then((r) => r.data),
  login: (username: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { username, password }).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  setProviderKey: (provider: string, api_key: string) =>
    api.post<User>("/auth/provider-key", { provider, api_key }).then((r) => r.data),
};

// --- providers / chat / conversations ---
export const chatApi = {
  providers: () => api.get<ProviderInfo[]>("/providers").then((r) => r.data),
  send: (payload: {
    message: string;
    provider: string;
    model?: string;
    mode: ChatMode;
    conversation_id?: number;
  }) => api.post<ChatResponse>("/chat", payload).then((r) => r.data),
  conversations: () => api.get<Conversation[]>("/conversations").then((r) => r.data),
  conversation: (id: number) =>
    api.get<ConversationDetail>(`/conversations/${id}`).then((r) => r.data),
  deleteConversation: (id: number) => api.delete(`/conversations/${id}`).then((r) => r.data),
};

// --- operations ---
export const opsApi = {
  jobs: () => api.get<Job[]>("/ops/jobs").then((r) => r.data),
  invoices: () => api.get<Invoice[]>("/ops/invoices").then((r) => r.data),
  quotes: () => api.get<Quote[]>("/ops/quotes").then((r) => r.data),
  messages: () => api.get<Message[]>("/ops/messages").then((r) => r.data),
  customers: () => api.get<Customer[]>("/ops/customers").then((r) => r.data),
  metrics: () => api.get<Metrics>("/ops/metrics").then((r) => r.data),
  loadSample: () => api.post("/ops/load-sample-data").then((r) => r.data),
  createCustomer: (body: Partial<Customer>) =>
    api.post<Customer>("/ops/customers", body).then((r) => r.data),
  createJob: (body: Record<string, unknown>) =>
    api.post<Job>("/ops/jobs", body).then((r) => r.data),
  createInvoice: (body: Record<string, unknown>) =>
    api.post<Invoice>("/ops/invoices", body).then((r) => r.data),
};
