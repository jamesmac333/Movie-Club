import crypto from "crypto";

// Passwords are stored as "scrypt$<salt hex>$<hash hex>"
const HASH_PREFIX = "scrypt$";

export function isHashedPassword(stored?: string): boolean {
  return typeof stored === "string" && stored.startsWith(HASH_PREFIX);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${HASH_PREFIX}${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored?: string): boolean {
  if (!stored || typeof password !== "string") return false;
  if (!isHashedPassword(stored)) {
    // Legacy plain-text value (only until the startup migration has hashed it)
    const a = Buffer.from(password);
    const b = Buffer.from(stored);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const [, saltHex, hashHex] = stored.split("$");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Hashes any plain-text passwords in place. Returns true if anything changed.
export function migratePlainPasswords(users: { password?: string }[]): boolean {
  let changed = false;
  for (const u of users) {
    if (u.password && !isHashedPassword(u.password)) {
      u.password = hashPassword(u.password);
      changed = true;
    }
  }
  return changed;
}
