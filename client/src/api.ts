const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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

export interface CreatedTicket extends CreateTicketRequest {
  id: number;
  ticketNumber: string;
  createdAt: string;
  currentStatus: "NEW";
  currentStatusLabel: "New";
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

export interface MyTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  currentStatus: "NEW";
  currentStatusLabel: "New";
  updatedAt: string;
}

export interface MyTicketsQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  currentStatus?: "NEW";
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
  attachments: TicketAttachment[];
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

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories`);
  if (!response.ok) {
    throw new Error(await parseError(response, `Unable to load Categories. HTTP ${response.status}.`));
  }
  return (await response.json()) as Category[];
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`);
  if (!response.ok) {
    throw new Error(await parseError(response, `Unable to load Related Systems. HTTP ${response.status}.`));
  }
  return (await response.json()) as RelatedSystem[];
}

export async function getRequesters(): Promise<Requester[]> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/requesters`);
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to create Ticket."));
  }

  return (await response.json()) as CreatedTicket;
}

export async function uploadTicketAttachment(ticketId: number, requesterId: number, file: File): Promise<UploadedAttachment> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${API_URL}/api/requesters/${requesterId}/tickets/${ticketId}/attachments`, {
    method: "POST",
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
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load Tickets."));
  }
  return (await response.json()) as MyTicketsResponse;
}

export async function getTicketDetail(requesterId: number, ticketId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/requesters/${requesterId}/tickets/${ticketId}`);
  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to load Ticket Detail."));
  }
  return (await response.json()) as TicketDetail;
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
    body,
  });
  if (!response.ok) throw new Error(await parseError(response, "Unable to upload Attachment."));
  return (await response.json()) as TicketAttachment;
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
