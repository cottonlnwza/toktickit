import { describe, expect, it } from "vitest";
import { hashPassword, isVersionedScryptHash, verifyPassword } from "../../src/auth/password.js";

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
});
