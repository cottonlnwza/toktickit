import { describe, expect, it } from "vitest";
import {
  canCompleteAction,
  canTransitionActionStatus,
  createActionFingerprint,
  normalizeOptionalText,
  normalizeRequiredText,
  validateFollowUp,
} from "../../src/action-operations.js";

describe("Lab 4 Action Taken helpers", () => {
  it("UNIT-01 allows only the approved Action transitions", () => {
    expect(canTransitionActionStatus("PLANNED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionActionStatus("PLANNED", "COMPLETED")).toBe(true);
    expect(canTransitionActionStatus("PLANNED", "CANCELLED")).toBe(true);
    expect(canTransitionActionStatus("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransitionActionStatus("IN_PROGRESS", "CANCELLED")).toBe(true);
    expect(canTransitionActionStatus("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransitionActionStatus("CANCELLED", "IN_PROGRESS")).toBe(false);
    expect(canCompleteAction(7, 7)).toBe(true);
    expect(canCompleteAction(7, 8)).toBe(false);
  });

  it("UNIT-02 normalizes required/optional plain text deterministically", () => {
    expect(normalizeRequiredText("  work  ", 20)).toBe("work");
    expect(normalizeRequiredText("   ", 20)).toBeNull();
    expect(normalizeRequiredText("x".repeat(21), 20)).toBeNull();
    expect(normalizeOptionalText(null, 20)).toBeNull();
    expect(normalizeOptionalText("  note  ", 20)).toBe("note");
    expect(normalizeOptionalText("x".repeat(21), 20)).toBeUndefined();
    expect(validateFollowUp(false, "ignored")).toEqual({ valid: true, note: null });
    expect(validateFollowUp(true, "  check tomorrow ")).toEqual({ valid: true, note: "check tomorrow" });
    expect(validateFollowUp(true, "   ")).toMatchObject({ valid: false });
  });

  it("UNIT-05 create fingerprint is deterministic and changes with original intent", () => {
    const base = {
      ticketId: 10,
      workflowCycle: 1,
      createdById: 2,
      actionDescription: "Check cable",
      assigneeId: 3,
      result: null,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    };
    expect(createActionFingerprint(base)).toBe(createActionFingerprint({ ...base }));
    expect(createActionFingerprint(base)).not.toBe(createActionFingerprint({ ...base, actionDescription: "Check port" }));
  });
});
