import { describe, expect, it } from "vitest";
import { validateCommunicationContent } from "../../src/ticket-operations.js";

describe("Lab 3 Comment/Internal Note validation", () => {
  it.each([undefined, null, "", "   ", "x".repeat(2001)])("UNIT-04 rejects invalid content", (value) => {
    expect(validateCommunicationContent(value)).toMatchObject({ valid: false });
  });

  it("UNIT-04 trims valid content and preserves markup-like text as plain content", () => {
    expect(validateCommunicationContent('  <script>alert("x")</script> plain text  ')).toEqual({
      valid: true,
      content: '<script>alert("x")</script> plain text',
    });
  });
});
