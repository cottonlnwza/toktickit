import { describe, expect, it } from "vitest";
import { hashPassword, isVersionedScryptHash, validateNewPassword, verifyPassword } from "../../src/auth/password.js";
import { normalizeEmail } from "../../src/auth/identity.js";

describe("Lab 3 identity normalization", () => {
  it("UNIT-01 trims and lowercases email values for duplicate comparison", () => {
    expect(normalizeEmail("  Student.User@Example.TEST  ")).toBe("student.user@example.test");
    expect(normalizeEmail("student.user@example.test")).toBe("student.user@example.test");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("Lab 3 password hashing", () => {
  it("hashes with the approved versioned scrypt format and verifies only the correct password", async () => {
    const hash = await hashPassword("Correct-Lab3-Password-2026");

    expect(isVersionedScryptHash(hash)).toBe(true);
    await expect(verifyPassword("Correct-Lab3-Password-2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("Wrong-Lab3-Password-2026", hash)).resolves.toBe(false);
  });

  it.each([
    "scrypt$v1$16384$8$1$zz$zz",
    "scrypt$v1$16384$8$1$0$0",
    "scrypt$v1$16384$8$1$00112233445566778899aabbccddeeff",
    "scrypt$v1$16384$8$1$00112233445566778899aabbccddeeff$00",
    "scrypt$v1$16384$8$1$00112233445566778899aabbccddeeff$" + "00".repeat(64) + "$extra",
    "scrypt$v1$1$8$1$00112233445566778899aabbccddeeff$" + "00".repeat(64),
  ])("fails closed for malformed or unsupported stored hashes: %s", async (storedHash) => {
    expect(isVersionedScryptHash(storedHash)).toBe(false);
    await expect(verifyPassword("any-password", storedHash)).resolves.toBe(false);
  });

  it("enforces the approved 12-128 character change-password boundaries without trimming exact password values", () => {
    expect(validateNewPassword("Current-Lab3-Password", "Valid-New-Lab3-Password", "Valid-New-Lab3-Password")).toEqual({});
    expect(validateNewPassword("Current-Lab3-Password", "12345678901", "12345678901")).toHaveProperty("newPassword");
    expect(validateNewPassword("Current-Lab3-Password", "x".repeat(129), "x".repeat(129))).toHaveProperty("newPassword");
    expect(validateNewPassword("Current-Lab3-Password", "            ", "            ")).toHaveProperty("newPassword");
    expect(validateNewPassword("Exact-Password-Value", "Exact-Password-Value", "Exact-Password-Value")).toHaveProperty("newPassword");
    expect(validateNewPassword("Current-Lab3-Password", "Valid-New-Lab3-Password", " valid-new-lab3-password ")).toHaveProperty("confirmPassword");
  });
});
