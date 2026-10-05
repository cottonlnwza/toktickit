import type { RequestedPriority, TicketStatus } from "@prisma/client";

export const activeDashboardTicketStatuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
export const dashboardTicketStatusKeys: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
export const dashboardPriorityKeys: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function dashboardWindowSnapshot(generatedAt = new Date()) {
  return {
    generatedAt,
    updatedCutoff: new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000),
    resolvedCutoff: new Date(generatedAt.getTime() - 30 * 24 * 60 * 60 * 1000),
  };
}

export function inInclusiveDashboardWindow(value: Date, lowerBound: Date, generatedAt: Date) {
  return value.getTime() >= lowerBound.getTime() && value.getTime() <= generatedAt.getTime();
}
