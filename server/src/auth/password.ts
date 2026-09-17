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
  const [algorithm, version, nValue, rValue, pValue, saltHex, keyHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || version !== "v1" || !saltHex || !keyHex) return false;

  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: n,
    r,
    p,
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isVersionedScryptHash(value: string): boolean {
  return /^scrypt\$v1\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(value);
}
