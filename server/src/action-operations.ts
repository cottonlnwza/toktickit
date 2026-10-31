import { createHash } from "node:crypto";
import type { ActionStatus } from "@prisma/client";

export const actionStatuses = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const activeTicketStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeRequiredText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > max) return null;
  return normalized;
}

export function normalizeOptionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > max) return undefined;
  return normalized;
}

export type NormalizedCreateIntent = {
  ticketId: number;
  workflowCycle: number;
  createdById: number;
  actionDescription: string;
  assigneeId: number;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

export function createActionFingerprint(intent: NormalizedCreateIntent): string {
  return createHash("sha256").update(JSON.stringify(intent)).digest("hex");
}

export function canTransitionActionStatus(from: ActionStatus, to: ActionStatus) {
  const allowed: Record<ActionStatus, readonly ActionStatus[]> = {
    PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  return allowed[from].includes(to);
}

export function canCompleteAction(assigneeId: number, actorId: number) {
  return assigneeId === actorId;
}

export function validateFollowUp(followUpRequired: unknown, followUpNote: unknown) {
  if (typeof followUpRequired !== "boolean") return { valid: false as const, note: null, message: "Follow-Up Required must be true or false." };
  if (!followUpRequired) return { valid: true as const, note: null };
  const note = normalizeRequiredText(followUpNote, 1000);
  if (!note) return { valid: false as const, note: null, message: "Follow-up Note is required when follow-up is needed." };
  return { valid: true as const, note };
}

export function actionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PLANNED: "Planned",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return labels[status] ?? status;
}
