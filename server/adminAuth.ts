/**
 * server/adminAuth.ts
 * ─────────────────────
 * Real, server-enforced admin auth. Previously the "passcode gate" was
 * client-side only — the admin.tsx UI hid itself behind a form, but every
 * /api/admin/* endpoint had no server-side check at all, so anyone who found
 * the URL could read customer PII or change settings with no login.
 *
 * This issues a signed, httpOnly session cookie on successful passcode entry
 * and gates every /api/admin/* route on it. No new dependencies: cookies are
 * parsed by hand and sessions are a signed timestamp (HMAC), not a server-side
 * store, so there's nothing to clean up or persist.
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import tenantConfig from "../tenant.config";

const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

// Falls back to a random secret generated at boot if none is set. That means
// sessions don't survive a redeploy/restart (admin has to log in again) —
// an acceptable default for a low-traffic admin panel. Set ADMIN_SESSION_SECRET
// in Railway for sessions that persist across restarts.
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString("hex");

function sign(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function issueSessionCookie(res: Response) {
  const expires = Date.now() + SESSION_MAX_AGE_MS;
  const payload = String(expires);
  const token = `${payload}.${sign(payload)}`;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return false;
  if (!timingSafeEqual(sign(payload), sig)) return false;
  const expires = Number(payload);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  return true;
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  if (!isValidSession(cookies[COOKIE_NAME])) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// Small in-memory throttle on the login endpoint itself — the passcode is a
// single shared secret with no username, so it's worth making it costly to
// guess by brute force now that it's the only thing standing between the
// internet and customer data. Resets on redeploy; that's fine, it's a
// deterrent, not a hard limit.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export function verifyPasscode(passcode: string): boolean {
  return passcode.trim().toLowerCase() === tenantConfig.admin.passcode.toLowerCase();
}
