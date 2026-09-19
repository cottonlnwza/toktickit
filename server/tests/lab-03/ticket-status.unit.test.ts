import { describe, expect, it } from "vitest";
import type { TicketStatus } from "@prisma/client";
import { allowedStatusTransitions, canTransitionTicketStatus } from "../../src/ticket-operations.js";

describe("Lab 3 Ticket status transition matrix", () => {
  const expected: Record<TicketStatus, TicketStatus[]> = {
    NEW: ["OPEN", "CANCELLED"],
    OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    CANCELLED: ["REOPENED"],
  };

  it("UNIT-03 matches BR-24 exactly", () => {
    expect(allowedStatusTransitions).toEqual(expected);
    for (const from of Object.keys(expected) as TicketStatus[]) {
      for (const to of Object.keys(expected) as TicketStatus[]) {
        expect(canTransitionTicketStatus(from, to)).toBe(expected[from].includes(to));
      }
    }
  });
});
