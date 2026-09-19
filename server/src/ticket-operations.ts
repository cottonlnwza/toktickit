import type { TicketStatus } from "@prisma/client";

export const allowedStatusTransitions: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};

export function canTransitionTicketStatus(from: TicketStatus, to: TicketStatus) {
  return allowedStatusTransitions[from].includes(to);
}

export function validateCommunicationContent(value: unknown):
  | { valid: true; content: string }
  | { valid: false; message: string } {
  const content = typeof value === "string" ? value.trim() : "";
  if (!content) return { valid: false, message: "Content is required." };
  if (content.length > 2000) return { valid: false, message: "Content must be 2000 characters or fewer." };
  return { valid: true, content };
}
