import { describe, expect, it } from "vitest";
import { canResolveCurrentCycle } from "../../src/ticket-operations.js";

describe("Lab 4 Ticket workflow unit rules", () => {
  it("UNIT-03 requires completed work and no active Action in the current cycle", () => {
    expect(canResolveCurrentCycle([])).toBe(false);
    expect(canResolveCurrentCycle(["CANCELLED"])).toBe(false);
    expect(canResolveCurrentCycle(["COMPLETED"])).toBe(true);
    expect(canResolveCurrentCycle(["COMPLETED", "CANCELLED"])).toBe(true);
    expect(canResolveCurrentCycle(["COMPLETED", "PLANNED"])).toBe(false);
    expect(canResolveCurrentCycle(["COMPLETED", "IN_PROGRESS"])).toBe(false);
  });
});
