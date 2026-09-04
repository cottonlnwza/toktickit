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

async function parseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
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
  body.append("requesterId", String(requesterId));
  body.append("file", file);

  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Unable to upload Attachment."));
  }

  return (await response.json()) as UploadedAttachment;
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
