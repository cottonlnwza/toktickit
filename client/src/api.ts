const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  csrfToken: string;
}

export class AuthApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function parseAuthError(response: Response, fallback: string): Promise<AuthApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; fields?: Record<string, string> };
    };
    return new AuthApiError(
      response.status,
      body.error?.code ?? "AUTH_ERROR",
      body.error?.message ?? fallback,
      body.error?.fields ?? {},
    );
  } catch {
    return new AuthApiError(response.status, "AUTH_ERROR", fallback);
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await parseAuthError(response, "Unable to sign in. Please try again.");
  return (await response.json()) as AuthResponse;
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
  if (!response.ok) throw await parseAuthError(response, "Authentication required.");
  return (await response.json()) as AuthResponse;
}

export async function changePassword(
  csrfToken: string,
  input: { currentPassword: string; newPassword: string; confirmPassword: string },
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseAuthError(response, "Unable to change password. Please try again.");
  return (await response.json()) as AuthResponse;
}

export async function logout(csrfToken: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });
  if (!response.ok) throw await parseAuthError(response, "Unable to sign out. Please try again.");
}

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface CreateTicketRequest {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface AuthenticatedCreateTicketRequest {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  clientRequestId?: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  itPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner?: null;
  replayed?: boolean;
  createdAt: string;
  currentStatus: TicketStatus;
  currentStatusLabel: string;
}

export interface UploadedAttachment {
  id: number;
  ticketId: number;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  removedAt: string | null;
}

export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

export interface MyTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  currentStatus: TicketStatus;
  currentStatusLabel: string;
  updatedAt: string;
}

export interface MyTicketsQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  currentStatus?: TicketStatus;
  sortBy?: "createdAt" | "updatedAt" | "requestedPriority" | "ticketNumber";
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: 5 | 10 | 20;
}

export interface MyTicketsResponse {
  items: MyTicket[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketAttachment {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
  state: "active" | "removed";
  downloadUrl?: string;
}

export interface TicketDetail extends MyTicket {
  description: string;
  requester: Requester;
  createdAt: string;
  problemAppearsResolvedAt?: string | null;
  attachments: TicketAttachment[];
}

export interface PublicComment {
  id: number;
  content: string;
  author: { id: number; name: string; role: UserRole };
  createdAt: string;
}

async function parseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string | { message?: string } };
    if (typeof body.error === "string") return body.error;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

function toApiUrl(value: string | undefined) {
  return value ? new URL(value, API_URL).toString() : undefined;
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await parseError(response, `Unable to load Categories. HTTP ${response.status}.`));
  }
  return (await response.json()) as Category[];
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await parseError(response, `Unable to load Related Systems. HTTP ${response.status}.`));
  }
  return (await response.json()) as RelatedSystem[];
}

export async function getRequesters(): Promise<Requester[]> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/requesters`, { credentials: "include" });
  } catch {
    throw new Error("Unable to load Development Requesters. Is the API server running?");
  }

  if (!response.ok) {
    throw new Error(`Unable to load Development Requesters. HTTP ${response.status}.`);
  }

  return (await response.json()) as Requester[];
}

export async function createTicket(input: CreateTicketRequest): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to create Ticket."));
  }

  return (await response.json()) as CreatedTicket;
}

export async function createAuthenticatedTicket(
  csrfToken: string,
  input: AuthenticatedCreateTicketRequest,
): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to create Ticket."));
  return (await response.json()) as CreatedTicket;
}

export async function uploadTicketAttachment(ticketId: number, requesterId: number, file: File): Promise<UploadedAttachment> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${API_URL}/api/requesters/${requesterId}/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
    body,
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to upload Attachment."));
  }

  return (await response.json()) as UploadedAttachment;
}

export async function getMyTickets(requesterId: number, query: MyTicketsQuery = {}): Promise<MyTicketsResponse> {
  const parameters = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") parameters.set(key, String(value));
  });
  const queryString = parameters.toString();
  const response = await fetch(
    `${API_URL}/api/requesters/${requesterId}/tickets${queryString ? `?${queryString}` : ""}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load Tickets."));
  }
  return (await response.json()) as MyTicketsResponse;
}

export async function getAuthenticatedMyTickets(query: MyTicketsQuery = {}): Promise<MyTicketsResponse> {
  const parameters = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") parameters.set(key, String(value));
  });
  const queryString = parameters.toString();
  const response = await fetch(`${API_URL}/api/tickets/mine${queryString ? `?${queryString}` : ""}`, { credentials: "include" });
  if (!response.ok) throw new Error(await parseError(response, "Unable to load Tickets."));
  return (await response.json()) as MyTicketsResponse;
}

export async function getTicketDetail(requesterId: number, ticketId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/requesters/${requesterId}/tickets/${ticketId}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load Ticket Detail."));
  }
  const detail = (await response.json()) as TicketDetail;
  return {
    ...detail,
    attachments: detail.attachments.map((attachment) => ({
      ...attachment,
      downloadUrl: toApiUrl(attachment.downloadUrl),
    })),
  };
}

export async function getAuthenticatedTicketDetail(ticketId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, { credentials: "include" });
  if (!response.ok) throw new Error(await parseError(response, "Unable to load Ticket Detail."));
  const detail = (await response.json()) as TicketDetail;
  return {
    ...detail,
    attachments: detail.attachments.map((attachment) => ({ ...attachment, downloadUrl: toApiUrl(attachment.downloadUrl) })),
  };
}

export async function addAuthenticatedTicketAttachment(
  csrfToken: string,
  ticketId: number,
  file: File,
): Promise<TicketAttachment> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
    body,
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to upload Attachment."));
  const attachment = (await response.json()) as TicketAttachment;
  return { ...attachment, state: "active", downloadUrl: toApiUrl(attachment.downloadUrl) };
}

export async function removeAuthenticatedTicketAttachment(
  csrfToken: string,
  ticketId: number,
  attachmentId: number,
  reason: string,
): Promise<TicketAttachment> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to remove Attachment."));
  return (await response.json()) as TicketAttachment;
}

export async function getPublicComments(ticketId: number): Promise<PublicComment[]> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, { credentials: "include" });
  if (!response.ok) throw new Error(await parseError(response, "Unable to load Public Comments."));
  return (await response.json()) as PublicComment[];
}

export async function postPublicComment(csrfToken: string, ticketId: number, content: string): Promise<PublicComment> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to post Public Comment."));
  return (await response.json()) as PublicComment;
}

export async function markProblemAppearsResolved(
  csrfToken: string,
  ticketId: number,
): Promise<{ problemAppearsResolvedAt: string; currentStatus: TicketStatus }> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/problem-appears-resolved`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to record resolution indication."));
  return (await response.json()) as { problemAppearsResolvedAt: string; currentStatus: TicketStatus };
}

export async function addTicketAttachment(
  requesterId: number,
  ticketId: number,
  file: File,
): Promise<TicketAttachment> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_URL}/api/requesters/${requesterId}/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to upload Attachment."));
  const attachment = (await response.json()) as TicketAttachment;
  return {
    ...attachment,
    state: "active",
    downloadUrl: toApiUrl(
      attachment.downloadUrl ?? `/api/requesters/${requesterId}/tickets/${ticketId}/attachments/${attachment.id}/download`,
    ),
  };
}

export async function removeTicketAttachment(
  requesterId: number,
  ticketId: number,
  attachmentId: number,
  reason: string,
): Promise<TicketAttachment> {
  const response = await fetch(
    `${API_URL}/api/requesters/${requesterId}/tickets/${ticketId}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!response.ok) throw new Error(await parseError(response, "Unable to remove Attachment."));
  return (await response.json()) as TicketAttachment;
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  let healthResponse: Response;
  try {
    healthResponse = await fetch(`${API_URL}/api/health`);
  } catch {
    throw new Error("Backend health check failed. Is the API server running?");
  }

  if (!healthResponse.ok) {
    throw new Error(`Backend health check failed with HTTP ${healthResponse.status}.`);
  }

  try {
    const categories = await getCategories();
    return { online: true, categories };
  } catch {
    throw new Error("Category list request failed. Is the API server running?");
  }
}
