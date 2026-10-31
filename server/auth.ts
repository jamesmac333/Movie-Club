import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { readDb } from "./db.ts";

// --- Login attempt limits ---
// After too many wrong passwords for one account (or from one address) within the window,
// further attempts are refused until the window passes. Kept in memory: the site runs one server.

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_ACCOUNT = 5;
const MAX_FAILURES_PER_ADDRESS = 20;
const loginFailures = new Map<string, number[]>();

function recentFailures(key: string): number[] {
  const cutoff = Date.now() - LOGIN_WINDOW_MS;
  const times = (loginFailures.get(key) || []).filter((t) => t > cutoff);
  if (times.length) loginFailures.set(key, times);
  else loginFailures.delete(key);
  return times;
}

function loginKeys(username: string, address: string): [string, string] {
  return [`account:${username.toLowerCase().trim()}`, `address:${address}`];
}

// Minutes until another attempt is allowed, or 0 if the attempt may go ahead
export function loginRetryMinutes(username: string, address: string): number {
  const [account, addr] = loginKeys(username, address);
  const a = recentFailures(account);
  const b = recentFailures(addr);
  const blocked = [a.length >= MAX_FAILURES_PER_ACCOUNT ? a : null, b.length >= MAX_FAILURES_PER_ADDRESS ? b : null].filter(Boolean) as number[][];
  if (!blocked.length) return 0;
  const until = Math.max(...blocked.map((times) => times[0] + LOGIN_WINDOW_MS));
  return Math.max(1, Math.ceil((until - Date.now()) / 60000));
}

export function recordLoginFailure(username: string, address: string): void {
  for (const key of loginKeys(username, address)) loginFailures.set(key, [...recentFailures(key), Date.now()]);
}

export function recordLoginSuccess(username: string): void {
  loginFailures.delete(loginKeys(username, "")[0]);
}

// Caller's address: the first hop added by Vercel's proxy, else the direct connection
export function clientAddress(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

// --- Signed session tokens ---

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  console.warn("SESSION_SECRET is not set: using a temporary secret, so everyone is signed out whenever the server restarts.");
  return crypto.randomBytes(32).toString("hex");
}

const SESSION_SECRET = getSessionSecret();

function sign(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

// Private part of the club calendar link: calendar apps can't sign in, so the link itself is the key
export function calendarKey(): string {
  return sign("club-calendar-feed").slice(0, 32);
}

export function createToken(username: string): string {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof u !== "string" || typeof exp !== "number" || exp < Date.now()) return null;
    return u;
  } catch {
    return null;
  }
}

// --- Request identity ---

export interface AuthUser {
  username: string;
  name: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export function isAdminUser(user?: AuthUser): boolean {
  if (!user) return false;
  const u = user.username.toLowerCase();
  return user.isAdmin || u === "james" || u === "ash";
}

// Routes anyone may call without signing in
const PUBLIC_ROUTES: Array<[string, RegExp]> = [
  ["POST", /^\/api\/auth\/login$/],
  ["GET", /^\/api\/users$/],
  ["GET", /^\/api\/users\/[^/]+\/avatar$/],
  ["GET", /^\/api\/nights$/],
  ["GET", /^\/api\/reviews$/],
  ["GET", /^\/api\/overviews$/],
  ["GET", /^\/api\/overviews\/[^/]+\/image$/],
  ["GET", /^\/api\/calendar\/[^/]+\.ics$/],
];

// Routes that only admins may call (on top of each route's own checks)
const ADMIN_ROUTES: RegExp[] = [/^\/api\/admin\//, /^\/api\/edm(\/|$)/, /^\/api\/auth\/admin-set-password$/];

// Identifies the caller from their session token, rejects unsigned requests to
// protected routes, and overwrites every client-supplied identity field with the
// verified one so the existing per-route permission checks can be trusted.
export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) return next();

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const username = token ? readToken(token) : null;

  if (username) {
    const dbUser = readDb().users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (dbUser) {
      req.authUser = { username: dbUser.username, name: dbUser.name, isAdmin: !!dbUser.isAdmin };
    }
  }

  const isPublic = PUBLIC_ROUTES.some(([method, pattern]) => method === req.method && pattern.test(req.path));
  if (isPublic) return next();

  if (!req.authUser) {
    return res.status(401).json({ error: "Please sign in again.", code: "AUTH_REQUIRED" });
  }

  if (ADMIN_ROUTES.some((pattern) => pattern.test(req.path)) && !isAdminUser(req.authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admins only." });
  }

  const me = req.authUser;
  if (req.query) req.query.requester = me.username;
  if (req.body && typeof req.body === "object") {
    req.body.requester = me.username;
    req.body.requesterName = me.name;
    if ("adminUsername" in req.body) req.body.adminUsername = me.username;
    if (req.path === "/api/auth/change-password") req.body.username = me.username;
    if (req.path === "/api/reviews" && req.method === "POST") req.body.user = me.name;
  }
  next();
}
