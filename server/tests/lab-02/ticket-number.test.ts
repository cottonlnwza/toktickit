import { describe, expect, it } from "vitest";
import { buildTicketNumber } from "../../src/app.js";

describe("Lab 2 Ticket Number", () => {
  it("uses the approved TTK-YYYYMMDD sequence format", () => {
    expect(buildTicketNumber(new Date("2026-09-04T08:30:00.000Z"), 1)).toBe("TTK-20260904-0001");
    expect(buildTicketNumber(new Date("2026-09-04T23:59:00.000Z"), 42)).toBe("TTK-20260904-0042");
  });

  it("keeps the date portion tied to the ticket creation date", () => {
    expect(buildTicketNumber(new Date("2026-12-31T16:59:00.000Z"), 7)).toBe("TTK-20261231-0007");
  });
});
