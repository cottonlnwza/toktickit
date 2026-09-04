import { describe, expect, it } from "vitest";
import { validateAttachmentCandidate, validateCreateTicketInput } from "../../src/app.js";

describe("Lab 2 Ticket validation", () => {
  it("trims valid summary and description input", () => {
    const result = validateCreateTicketInput({
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 3,
      summary: "  Laptop battery drains quickly  ",
      description: "  Battery drops during class.  ",
      requestedPriority: "MEDIUM",
    });

    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("Expected valid Ticket input.");
    expect(result.data).toMatchObject({
      summary: "Laptop battery drains quickly",
      description: "Battery drops during class.",
      requestedPriority: "MEDIUM",
    });
  });

  it("rejects missing fields and unsupported priority values", () => {
    const result = validateCreateTicketInput({
      requesterId: 0,
      categoryId: undefined,
      relatedSystemId: null,
      summary: " ",
      description: "",
      requestedPriority: "CRITICAL",
    });

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected invalid Ticket input.");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { field: "requesterId", message: "Requester is required." },
        { field: "categoryId", message: "Category is required." },
        { field: "relatedSystemId", message: "Related System is required." },
        { field: "summary", message: "Summary is required." },
        { field: "description", message: "Description is required." },
        { field: "requestedPriority", message: "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT." },
      ]),
    );
  });

  it("enforces Summary and Description boundary lengths", () => {
    const tooShort = validateCreateTicketInput({
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 3,
      summary: "1234",
      description: "too short",
      requestedPriority: "MEDIUM",
    });
    const validLowerBoundary = validateCreateTicketInput({
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 3,
      summary: "12345",
      description: "12345678901234567890",
      requestedPriority: "MEDIUM",
    });
    const validUpperBoundary = validateCreateTicketInput({
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 3,
      summary: "a".repeat(120),
      description: "b".repeat(2000),
      requestedPriority: "MEDIUM",
    });
    const tooLong = validateCreateTicketInput({
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 3,
      summary: "a".repeat(121),
      description: "b".repeat(2001),
      requestedPriority: "MEDIUM",
    });

    expect(tooShort.valid).toBe(false);
    if (tooShort.valid) throw new Error("Expected short input to fail.");
    expect(tooShort.errors).toEqual(
      expect.arrayContaining([
        { field: "summary", message: "Summary must be 5-120 characters." },
        { field: "description", message: "Description must be 20-2000 characters." },
      ]),
    );
    expect(validLowerBoundary.valid).toBe(true);
    expect(validUpperBoundary.valid).toBe(true);
    expect(tooLong.valid).toBe(false);
    if (tooLong.valid) throw new Error("Expected long input to fail.");
    expect(tooLong.errors).toEqual(
      expect.arrayContaining([
        { field: "summary", message: "Summary must be 5-120 characters." },
        { field: "description", message: "Description must be 20-2000 characters." },
      ]),
    );
  });

  it("rejects invalid attachment type, size, and max-five boundary", () => {
    expect(validateAttachmentCandidate({ filename: "error-log.pdf", sizeBytes: 5 * 1024 * 1024 }, 0)).toEqual({
      valid: true,
    });
    expect(validateAttachmentCandidate({ filename: "malware.exe", sizeBytes: 1000 }, 0)).toEqual({
      valid: false,
      error: "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.",
    });
    expect(validateAttachmentCandidate({ filename: "large.pdf", sizeBytes: 5 * 1024 * 1024 + 1 }, 0)).toEqual({
      valid: false,
      error: "Attachment must be 5 MB or smaller.",
    });
    expect(validateAttachmentCandidate({ filename: "extra.pdf", sizeBytes: 1000 }, 5)).toEqual({
      valid: false,
      error: "A Ticket may have at most five active attachments.",
    });
  });
});
