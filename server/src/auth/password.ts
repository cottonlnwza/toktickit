import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const FORMAT_PREFIX = "scrypt$v1";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    FORMAT_PREFIX,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!isVersionedScryptHash(storedHash)) return false;

  try {
    const parts = storedHash.split("$");
    if (parts.length !== 7) return false;

    const [, , nValue, rValue, pValue, saltHex, keyHex] = parts;
    const n = Number(nValue);
    const r = Number(rValue);
    const p = Number(pValue);
    if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    if (salt.length !== SCRYPT_SALT_LENGTH || expected.length !== SCRYPT_KEY_LENGTH) return false;

    const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
      N: n,
      r,
      p,
    });

    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function isVersionedScryptHash(value: string): boolean {
  return /^scrypt\$v1\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(value);
}

export function validateNewPassword(currentPassword: string, newPassword: string, confirmPassword: string) {
  const fields: Record<string, string> = {};
  if (newPassword.length < 12 || newPassword.length > 128) {
    fields.newPassword = "New password must be 12-128 characters.";
  } else if (newPassword.trim().length === 0) {
    fields.newPassword = "New password cannot be all whitespace.";
  } else if (newPassword === currentPassword) {
    fields.newPassword = "New password must differ from the current password.";
  }
  if (confirmPassword !== newPassword) {
    fields.confirmPassword = "Password confirmation must match the new password.";
  }
  return fields;
}
