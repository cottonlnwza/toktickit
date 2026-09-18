import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Prisma, UserRole } from "@prisma/client";
import { getPrisma } from "../prisma.js";

export const SESSION_COOKIE_NAME = "tt_session";
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

export interface SafeAuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AuthContext {
  sessionId: string;
  csrfTokenHash: string;
  user: SafeAuthenticatedUser;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

type SessionDb = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

function safeError(code: string, message: string) {
  return { error: { code, message } };
}

export function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function readSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return valueParts.join("=") || null;
  }
  return null;
}

export async function createSession(db: SessionDb, userId: number) {
  const sessionToken = newOpaqueToken();
  const csrfToken = newOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  const session = await db.authSession.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(sessionToken),
      csrfTokenHash: hashOpaqueToken(csrfToken),
      expiresAt,
    },
  });
  return { session, sessionToken, csrfToken, expiresAt };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  const rawToken = readSessionToken(req);
  if (!rawToken) {
    res.status(401).json(safeError("AUTH_REQUIRED", "Authentication required."));
    return;
  }

  try {
    const session = await getPrisma().authSession.findUnique({
      where: { tokenHash: hashOpaqueToken(rawToken) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
      clearSessionCookie(res);
      res.status(401).json(safeError("AUTH_REQUIRED", "Authentication required."));
      return;
    }

    req.auth = {
      sessionId: session.id,
      csrfTokenHash: session.csrfTokenHash,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        mustChangePassword: session.user.mustChangePassword,
      },
    };
    next();
  } catch {
    res.status(500).json(safeError("AUTH_ERROR", "Unable to verify authentication."));
  }
}

export function requireNormalAccess(req: Request, res: Response, next: NextFunction) {
  requireAuthenticated(req, res, () => {
    if (req.auth?.user.mustChangePassword) {
      res.status(403).json(safeError("PASSWORD_CHANGE_REQUIRED", "Password change is required before continuing."));
      return;
    }
    next();
  }).catch(() => {
    res.status(500).json(safeError("AUTH_ERROR", "Unable to verify authentication."));
  });
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const provided = req.get("X-CSRF-Token");
  const expectedHash = req.auth?.csrfTokenHash;
  if (!provided || !expectedHash) {
    res.status(403).json(safeError("CSRF_INVALID", "Request verification failed."));
    return;
  }

  const actualHash = hashOpaqueToken(provided);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(403).json(safeError("CSRF_INVALID", "Request verification failed."));
    return;
  }
  next();
}

export async function rotateCsrfToken(sessionId: string) {
  const csrfToken = newOpaqueToken();
  await getPrisma().authSession.update({
    where: { id: sessionId },
    data: { csrfTokenHash: hashOpaqueToken(csrfToken) },
  });
  return csrfToken;
}
