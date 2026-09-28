import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Prisma, type RequestedPriority, type TicketStatus, type UserRole } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { hashPassword, validateNewPassword, verifyPassword } from "./auth/password.js";
import { normalizeEmail } from "./auth/identity.js";
import { canTransitionTicketStatus, validateCommunicationContent } from "./ticket-operations.js";
import {
  clearSessionCookie,
  createSession,
  requireAuthenticated,
  requireCsrf,
  requireNormalAccess,
  rotateCsrfToken,
  setSessionCookie,
} from "./auth/session.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

function frontendOrigin() {
  return process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
}

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    callback(null, !origin || origin === frontendOrigin());
  },
}));
app.use(express.json());

const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const allowedTicketStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const requesterResolutionEligibleStatuses = ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
const staffQueueSortFields = ["updatedAt", "createdAt", "ticketNumber", "requestedPriority", "itPriority", "status"] as const;
const staffQueuePageSizes = [10, 25, 50] as const;
const staffQueueQueryKeys = new Set([
  "search",
  "status",
  "requestedPriority",
  "itPriority",
  "owner",
  "categoryId",
  "relatedSystemId",
  "sortBy",
  "sortOrder",
  "page",
  "pageSize",
]);
const allowedAttachmentExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const maxAttachmentSizeBytes = 5 * 1024 * 1024;
const maxActiveAttachments = 5;
const supportedCategoryNames = ["Account and Access", "Hardware", "Software", "Network"];
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.basename(path.dirname(moduleDirectory)) === "dist"
  ? path.resolve(moduleDirectory, "../..")
  : path.resolve(moduleDirectory, "..");
const uploadDirectory = path.join(serverRoot, "uploads", "lab-02");

type RequestedPriorityInput = (typeof allowedPriorities)[number];

interface ValidationError {
  field: string;
  message: string;
}

interface ValidTicketInput {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriorityInput;
}

interface AuthenticatedValidTicketInput {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriorityInput;
}

interface MultipartFile {
  filename: string;
  contentType: string;
  sizeBytes: number;
  content: Buffer;
}

function errorResponse(code: string, message: string, fields?: Record<string, string>) {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

function requireRequesterRole(req: Request, res: Response, next: () => void) {
  if (req.auth?.user.role !== "REQUESTER") {
    res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
    return;
  }
  next();
}

function requireItStaffRole(req: Request, res: Response, next: () => void) {
  if (req.auth?.user.role !== "IT_STAFF") {
    res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
    return;
  }
  next();
}

function requireStaffDetailRole(req: Request, res: Response, next: () => void) {
  if (!req.auth || !["IT_STAFF", "ADMINISTRATOR"].includes(req.auth.user.role)) {
    res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
    return;
  }
  next();
}

function requireAdministratorRole(req: Request, res: Response, next: () => void) {
  if (req.auth?.user.role !== "ADMINISTRATOR") {
    res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
    return;
  }
  next();
}

const allowedUserRoles = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
const adminListQueryKeys = new Set(["search", "role"]);

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function initialPasswordError(value: unknown) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) return "Initial password must be 12-128 characters.";
  if (value.trim().length === 0) return "Initial password cannot be all whitespace.";
  return null;
}

function adminUserResponse(user: {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    ...(user.mustChangePassword === undefined ? {} : { mustChangePassword: user.mustChangePassword }),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function lockActiveAdministrators(tx: Prisma.TransactionClient) {
  return tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE "role" = 'ADMINISTRATOR'::"UserRole" AND "isActive" = true
    ORDER BY "id" ASC
    FOR UPDATE
  `);
}

function ticketStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NEW: "New",
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    WAITING_FOR_REQUESTER: "Waiting for Requester",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
    REOPENED: "Reopened",
    CANCELLED: "Cancelled",
  };
  return labels[status] ?? status;
}

function requesterCreateResponse(ticket: {
  id: number;
  ticketNumber: string;
  clientRequestId: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string;
  currentStatus: string;
  createdAt: Date;
}, replayed: boolean) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    clientRequestId: ticket.clientRequestId,
    requesterId: ticket.requesterId,
    categoryId: ticket.categoryId,
    relatedSystemId: ticket.relatedSystemId,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    currentStatusLabel: ticketStatusLabel(ticket.currentStatus),
    owner: null,
    replayed,
    createdAt: ticket.createdAt,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateAuthenticatedCreateTicketInput(input: Record<string, unknown>):
  | { valid: true; data: AuthenticatedValidTicketInput }
  | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const clientRequestId = typeof input.clientRequestId === "string" ? input.clientRequestId.trim() : "";
  const categoryId = toPositiveInteger(input.categoryId);
  const relatedSystemId = toPositiveInteger(input.relatedSystemId);
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const requestedPriority = typeof input.requestedPriority === "string" ? input.requestedPriority : "";

  if (Object.prototype.hasOwnProperty.call(input, "requesterId")) {
    errors.push({ field: "requesterId", message: "Requester identity is determined by the authenticated session." });
  }
  for (const protectedField of ["ownerId", "itPriority", "currentStatus"] as const) {
    if (Object.prototype.hasOwnProperty.call(input, protectedField)) {
      errors.push({ field: protectedField, message: `${protectedField} cannot be set by a Requester.` });
    }
  }
  if (!clientRequestId || !isUuid(clientRequestId)) errors.push({ field: "clientRequestId", message: "clientRequestId must be a valid UUID." });
  if (!categoryId) errors.push({ field: "categoryId", message: "Category is required." });
  if (!relatedSystemId) errors.push({ field: "relatedSystemId", message: "Related System is required." });
  if (!summary) errors.push({ field: "summary", message: "Summary is required." });
  else if (summary.length < 5 || summary.length > 120) errors.push({ field: "summary", message: "Summary must be 5-120 characters." });
  if (!description) errors.push({ field: "description", message: "Description is required." });
  else if (description.length < 20 || description.length > 2000) errors.push({ field: "description", message: "Description must be 20-2000 characters." });
  if (!allowedPriorities.includes(requestedPriority as RequestedPriorityInput)) {
    errors.push({ field: "requestedPriority", message: "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT." });
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    data: {
      clientRequestId,
      categoryId: categoryId!,
      relatedSystemId: relatedSystemId!,
      summary,
      description,
      requestedPriority: requestedPriority as RequestedPriorityInput,
    },
  };
}

function safeUser(user: { id: number; name: string; email: string; role: string; mustChangePassword: boolean }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

function requestOriginAllowed(req: Request) {
  const origin = req.get("Origin");
  return origin === frontendOrigin();
}

function requireApprovedOrigin(req: Request, res: Response, next: () => void) {
  if (!requestOriginAllowed(req)) {
    res.status(403).json(errorResponse("ORIGIN_FORBIDDEN", "Request origin is not allowed."));
    return;
  }
  next();
}

const loginAttempts = new Map<string, { failures: number[]; blockedUntil: number | null }>();
const loginWindowMs = 15 * 60 * 1000;

function loginAttemptKey(req: Request, normalizedEmail: string) {
  return `${normalizedEmail}|${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
}

function isLoginThrottled(key: string, now = Date.now()) {
  const record = loginAttempts.get(key);
  if (!record) return false;
  if (record.blockedUntil && record.blockedUntil > now) return true;
  const failures = record.failures.filter((time) => now - time <= loginWindowMs);
  if (failures.length === 0) {
    loginAttempts.delete(key);
    return false;
  }
  loginAttempts.set(key, { failures, blockedUntil: null });
  return false;
}

function recordLoginFailure(key: string, now = Date.now()) {
  const current = loginAttempts.get(key);
  const failures = [...(current?.failures ?? []).filter((time) => now - time <= loginWindowMs), now];
  loginAttempts.set(key, {
    failures,
    blockedUntil: failures.length >= 5 ? now + loginWindowMs : null,
  });
}

export function buildTicketNumber(date: Date, sequence: number) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const paddedSequence = String(sequence).padStart(4, "0");
  return `TTK-${year}${month}${day}-${paddedSequence}`;
}

function toPositiveInteger(value: unknown) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function singleQueryValue(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : null;
}

function positiveQueryInteger(value: string | undefined): number | undefined | null {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validateCreateTicketInput(input: Record<string, unknown>):
  | { valid: true; data: ValidTicketInput }
  | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const requesterId = toPositiveInteger(input.requesterId);
  const categoryId = toPositiveInteger(input.categoryId);
  const relatedSystemId = toPositiveInteger(input.relatedSystemId);
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const requestedPriority = typeof input.requestedPriority === "string" ? input.requestedPriority : "";

  if (!requesterId) errors.push({ field: "requesterId", message: "Requester is required." });
  if (!categoryId) errors.push({ field: "categoryId", message: "Category is required." });
  if (!relatedSystemId) errors.push({ field: "relatedSystemId", message: "Related System is required." });
  if (!summary) errors.push({ field: "summary", message: "Summary is required." });
  else if (summary.length < 5 || summary.length > 120) {
    errors.push({ field: "summary", message: "Summary must be 5-120 characters." });
  }
  if (!description) errors.push({ field: "description", message: "Description is required." });
  else if (description.length < 20 || description.length > 2000) {
    errors.push({ field: "description", message: "Description must be 20-2000 characters." });
  }
  if (!allowedPriorities.includes(requestedPriority as RequestedPriorityInput)) {
    errors.push({
      field: "requestedPriority",
      message: "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.",
    });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      requesterId: requesterId!,
      categoryId: categoryId!,
      relatedSystemId: relatedSystemId!,
      summary,
      description,
      requestedPriority: requestedPriority as RequestedPriorityInput,
    },
  };
}

export function validateAttachmentCandidate(file: { filename: string; sizeBytes: number }, activeCount: number) {
  const filename = file.filename.toLowerCase();
  const hasAllowedExtension = allowedAttachmentExtensions.some((extension) => filename.endsWith(extension));

  if (!hasAllowedExtension) {
    return { valid: false, error: "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed." };
  }

  if (file.sizeBytes > maxAttachmentSizeBytes) {
    return { valid: false, error: "Attachment must be 5 MB or smaller." };
  }

  if (activeCount >= maxActiveAttachments) {
    return { valid: false, error: "A Ticket may have at most five active attachments." };
  }

  return { valid: true };
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getAllowedExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return allowedAttachmentExtensions.includes(extension) ? extension : null;
}

function attachmentMetadata(
  attachment: {
    id: number;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: Date;
    removedAt: Date | null;
    removalReason: string | null;
  },
  downloadUrl?: string,
) {
  const removed = attachment.removedAt !== null;
  return {
    id: attachment.id,
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedAt: attachment.uploadedAt,
    removedAt: attachment.removedAt,
    removalReason: attachment.removalReason,
    state: removed ? "removed" : "active",
    ...(!removed && downloadUrl ? { downloadUrl } : {}),
  };
}

async function parseMultipartRequest(req: Request): Promise<{ fields: Record<string, string>; file: MultipartFile | null }> {
  const contentType = req.headers["content-type"] ?? "";
  const boundaryMatch = /boundary=([^;]+)/.exec(Array.isArray(contentType) ? contentType[0] : contentType);
  if (!boundaryMatch) return { fields: {}, file: null };

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("binary");
  const boundary = `--${boundaryMatch[1]}`;
  const fields: Record<string, string> = {};
  let file: MultipartFile | null = null;

  for (const part of body.split(boundary)) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.slice(0, headerEnd);
    const rawContent = part.slice(headerEnd + 4).replace(/\r\n--$/, "").replace(/\r\n$/, "");
    const nameMatch = /name="([^"]+)"/.exec(headers);
    const filenameMatch = /filename="([^"]*)"/.exec(headers);
    const contentTypeMatch = /Content-Type: ([^\r\n]+)/i.exec(headers);

    if (!nameMatch) continue;

    if (filenameMatch) {
      file = {
        filename: filenameMatch[1],
        contentType: contentTypeMatch?.[1] ?? "application/octet-stream",
        sizeBytes: Buffer.byteLength(rawContent, "binary"),
        content: Buffer.from(rawContent, "binary"),
      };
    } else {
      fields[nameMatch[1]] = rawContent;
    }
  }

  return { fields, file };
}

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.post("/api/auth/login", requireApprovedOrigin, async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !email.includes("@") || !password) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Email and password are required."));
    return;
  }

  const attemptKey = loginAttemptKey(req, email);
  if (isLoginThrottled(attemptKey)) {
    res.status(429).json(errorResponse("LOGIN_THROTTLED", "Too many login attempts. Please try again later."));
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({ where: { email } });
    const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !passwordValid) {
      recordLoginFailure(attemptKey);
      res.status(401).json(errorResponse("INVALID_CREDENTIALS", "Invalid email or password."));
      return;
    }
    if (!user.isActive) {
      res.status(403).json(errorResponse("ACCOUNT_INACTIVE", "This account is inactive."));
      return;
    }

    const created = await createSession(getPrisma(), user.id);
    setSessionCookie(res, created.sessionToken, created.expiresAt);
    res.status(200).json({ user: safeUser(user), csrfToken: created.csrfToken });
  } catch {
    res.status(500).json(errorResponse("AUTH_ERROR", "Unable to sign in."));
  }
});

app.get("/api/auth/me", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const csrfToken = await rotateCsrfToken(req.auth!.sessionId);
    res.status(200).json({ user: req.auth!.user, csrfToken });
  } catch {
    res.status(500).json(errorResponse("AUTH_ERROR", "Unable to load the current user."));
  }
});

app.post(
  "/api/auth/change-password",
  requireApprovedOrigin,
  requireAuthenticated,
  requireCsrf,
  async (req: Request, res: Response) => {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";
    if (!currentPassword || typeof req.body?.newPassword !== "string" || typeof req.body?.confirmPassword !== "string") {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Please provide the current password, new password, and confirmation."));
      return;
    }

    const validationFields = validateNewPassword(currentPassword, newPassword, confirmPassword);
    if (Object.keys(validationFields).length > 0) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the password fields.", validationFields));
      return;
    }

    try {
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { id: req.auth!.user.id } });
      if (!user || !user.isActive) {
        clearSessionCookie(res);
        res.status(401).json(errorResponse("AUTH_REQUIRED", "Authentication required."));
        return;
      }
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        res.status(401).json(errorResponse("INVALID_CURRENT_PASSWORD", "Current password is incorrect."));
        return;
      }

      const newHash = await hashPassword(newPassword);
      const rotated = await prisma.$transaction(async (tx) => {
        const credentialUpdate = await tx.user.updateMany({
          where: {
            id: user.id,
            isActive: true,
            passwordHash: user.passwordHash,
          },
          data: { passwordHash: newHash, mustChangePassword: false },
        });
        if (credentialUpdate.count !== 1) return null;

        await tx.authSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const updatedUser = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        const session = await createSession(tx, user.id);
        return { updatedUser, ...session };
      });

      if (!rotated) {
        clearSessionCookie(res);
        res.status(401).json(errorResponse("INVALID_CURRENT_PASSWORD", "Current password is incorrect."));
        return;
      }

      setSessionCookie(res, rotated.sessionToken, rotated.expiresAt);
      res.status(200).json({ user: safeUser(rotated.updatedUser), csrfToken: rotated.csrfToken });
    } catch {
      res.status(500).json(errorResponse("AUTH_ERROR", "Unable to change password."));
    }
  },
);

app.post(
  "/api/auth/logout",
  requireApprovedOrigin,
  requireAuthenticated,
  requireCsrf,
  async (req: Request, res: Response) => {
    try {
      await getPrisma().authSession.update({
        where: { id: req.auth!.sessionId },
        data: { revokedAt: new Date() },
      });
      clearSessionCookie(res);
      res.status(204).send();
    } catch {
      res.status(500).json(errorResponse("AUTH_ERROR", "Unable to sign out."));
    }
  },
);

app.get("/api/admin/users", requireNormalAccess, requireAdministratorRole, async (req: Request, res: Response) => {
  if (Object.keys(req.query).some((key) => !adminListQueryKeys.has(key))) {
    res.status(400).json(errorResponse("INVALID_QUERY", "One or more User Management query parameters are invalid."));
    return;
  }

  const searchValue = singleQueryValue(req.query.search);
  const roleValue = singleQueryValue(req.query.role);
  if (searchValue === null || roleValue === null) {
    res.status(400).json(errorResponse("INVALID_QUERY", "One or more User Management query parameters are invalid."));
    return;
  }

  const search = searchValue?.trim() || undefined;
  if ((search && search.length > 100) || (roleValue !== undefined && !allowedUserRoles.includes(roleValue as UserRole))) {
    res.status(400).json(errorResponse("INVALID_QUERY", "One or more User Management query parameters are invalid."));
    return;
  }

  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (roleValue !== undefined) where.role = roleValue as UserRole;

  try {
    const users = await getPrisma().user.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(200).json(users.map(adminUserResponse));
  } catch {
    res.status(500).json(errorResponse("USER_MANAGEMENT_ERROR", "Unable to load Users."));
  }
});

app.post(
  "/api/admin/users",
  requireNormalAccess,
  requireAdministratorRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const allowedFields = new Set(["name", "email", "role", "isActive", "initialPassword"]);
    const unknownField = Object.keys(req.body ?? {}).find((key) => !allowedFields.has(key));
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = normalizeEmail(req.body?.email);
    const role = typeof req.body?.role === "string" ? req.body.role : "";
    const isActive = req.body?.isActive;
    const initialPassword = req.body?.initialPassword;
    const fields: Record<string, string> = {};

    if (unknownField) fields[unknownField] = `${unknownField} is not accepted.`;
    if (!name) fields.name = "Name is required.";
    if (!email || !isValidEmail(email)) fields.email = "Enter a valid email address.";
    if (!allowedUserRoles.includes(role as UserRole)) fields.role = "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR.";
    if (typeof isActive !== "boolean") fields.isActive = "Active state is required.";
    const passwordError = initialPasswordError(initialPassword);
    if (passwordError) fields.initialPassword = passwordError;

    if (Object.keys(fields).length > 0) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the highlighted fields.", fields));
      return;
    }

    try {
      const passwordHash = await hashPassword(initialPassword as string);
      const outcome = await getPrisma().$transaction(async (tx) => {
        const activeAdmins = await lockActiveAdministrators(tx);
        if (!activeAdmins.some((admin) => admin.id === req.auth!.user.id)) return { kind: "forbidden" as const };

        const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
        if (existing) return { kind: "duplicate" as const };

        const user = await tx.user.create({
          data: {
            name,
            email,
            role: role as UserRole,
            isActive: isActive as boolean,
            passwordHash,
            mustChangePassword: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { kind: "success" as const, user };
      });

      if (outcome.kind === "forbidden") {
        res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
        return;
      }
      if (outcome.kind === "duplicate") {
        res.status(409).json(errorResponse("DUPLICATE_EMAIL", "A User with this email already exists.", { email: "Email is already in use." }));
        return;
      }
      res.status(201).json(adminUserResponse(outcome.user));
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (code === "P2002") {
        res.status(409).json(errorResponse("DUPLICATE_EMAIL", "A User with this email already exists.", { email: "Email is already in use." }));
        return;
      }
      res.status(500).json(errorResponse("USER_MANAGEMENT_ERROR", "Unable to create User."));
    }
  },
);

app.patch(
  "/api/admin/users/:userId",
  requireNormalAccess,
  requireAdministratorRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const userId = toPositiveInteger(req.params.userId);
    if (!userId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "User ID must be a positive integer."));
      return;
    }

    const allowedFields = new Set(["name", "email", "role", "isActive"]);
    const bodyKeys = Object.keys(req.body ?? {});
    const fields: Record<string, string> = {};
    for (const key of bodyKeys) {
      if (!allowedFields.has(key)) fields[key] = `${key} cannot be changed through profile edit.`;
    }
    if (bodyKeys.length === 0) fields.user = "At least one editable field is required.";

    const data: { name?: string; email?: string; role?: UserRole; isActive?: boolean } = {};
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name) fields.name = "Name is required.";
      else data.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "email")) {
      const email = normalizeEmail(req.body.email);
      if (!email || !isValidEmail(email)) fields.email = "Enter a valid email address.";
      else data.email = email;
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "role")) {
      const role = typeof req.body.role === "string" ? req.body.role : "";
      if (!allowedUserRoles.includes(role as UserRole)) fields.role = "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR.";
      else data.role = role as UserRole;
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "isActive")) {
      if (typeof req.body.isActive !== "boolean") fields.isActive = "Active state must be true or false.";
      else data.isActive = req.body.isActive;
    }

    if (Object.keys(fields).length > 0) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the highlighted fields.", fields));
      return;
    }

    try {
      const outcome = await getPrisma().$transaction(async (tx) => {
        const activeAdmins = await lockActiveAdministrators(tx);
        if (!activeAdmins.some((admin) => admin.id === req.auth!.user.id)) return { kind: "forbidden" as const };

        const rows = await tx.$queryRaw<Array<{
          id: number;
          name: string;
          email: string;
          role: UserRole;
          isActive: boolean;
          mustChangePassword: boolean;
          createdAt: Date;
          updatedAt: Date;
        }>>(Prisma.sql`
          SELECT "id", "name", "email", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt"
          FROM "User"
          WHERE "id" = ${userId}
          FOR UPDATE
        `);
        const target = rows[0];
        if (!target) return { kind: "notFound" as const };

        const finalRole = data.role ?? target.role;
        const finalIsActive = data.isActive ?? target.isActive;
        if (target.id === req.auth!.user.id && target.isActive && finalIsActive === false) {
          return { kind: "selfDeactivate" as const };
        }
        if (target.role === "ADMINISTRATOR" && target.isActive && (finalRole !== "ADMINISTRATOR" || !finalIsActive) && activeAdmins.length <= 1) {
          return { kind: "lastAdmin" as const };
        }

        if (data.email && data.email !== target.email) {
          const duplicate = await tx.user.findUnique({ where: { email: data.email }, select: { id: true } });
          if (duplicate) return { kind: "duplicate" as const };
        }

        const roleChanged = finalRole !== target.role;
        const deactivated = target.isActive && !finalIsActive;
        const remainsEligibleOwner = finalIsActive && ["IT_STAFF", "ADMINISTRATOR"].includes(finalRole);
        if (!remainsEligibleOwner) {
          await tx.ticket.updateMany({ where: { ownerId: target.id }, data: { ownerId: null } });
        }
        if (roleChanged || deactivated) {
          await tx.authSession.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
        }

        const updated = await tx.user.update({
          where: { id: target.id },
          data,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { kind: "success" as const, user: updated };
      });

      if (outcome.kind === "forbidden") {
        res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
        return;
      }
      if (outcome.kind === "notFound") {
        res.status(404).json(errorResponse("NOT_FOUND", "User was not found."));
        return;
      }
      if (outcome.kind === "selfDeactivate") {
        res.status(409).json(errorResponse("SELF_DEACTIVATION_FORBIDDEN", "You cannot deactivate your own Administrator account."));
        return;
      }
      if (outcome.kind === "lastAdmin") {
        res.status(409).json(errorResponse("LAST_ACTIVE_ADMIN_REQUIRED", "At least one active Administrator is required."));
        return;
      }
      if (outcome.kind === "duplicate") {
        res.status(409).json(errorResponse("DUPLICATE_EMAIL", "A User with this email already exists.", { email: "Email is already in use." }));
        return;
      }
      res.status(200).json(adminUserResponse(outcome.user));
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (code === "P2002") {
        res.status(409).json(errorResponse("DUPLICATE_EMAIL", "A User with this email already exists.", { email: "Email is already in use." }));
        return;
      }
      res.status(500).json(errorResponse("USER_MANAGEMENT_ERROR", "Unable to update User."));
    }
  },
);

app.post(
  "/api/admin/users/:userId/initial-password",
  requireNormalAccess,
  requireAdministratorRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const userId = toPositiveInteger(req.params.userId);
    if (!userId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "User ID must be a positive integer."));
      return;
    }
    const bodyKeys = Object.keys(req.body ?? {});
    const initialPassword = req.body?.initialPassword;
    const fields: Record<string, string> = {};
    if (bodyKeys.some((key) => key !== "initialPassword")) fields.initialPassword = "Only initialPassword is accepted.";
    const passwordError = initialPasswordError(initialPassword);
    if (passwordError) fields.initialPassword = passwordError;
    if (Object.keys(fields).length > 0) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the highlighted fields.", fields));
      return;
    }

    try {
      const prisma = getPrisma();
      const outcome = await prisma.$transaction(async (tx) => {
        const activeAdmins = await lockActiveAdministrators(tx);
        if (!activeAdmins.some((admin) => admin.id === req.auth!.user.id)) return { kind: "forbidden" as const };
        if (userId === req.auth!.user.id) return { kind: "self" as const };

        const rows = await tx.$queryRaw<Array<{ id: number; passwordHash: string }>>(Prisma.sql`
          SELECT "id", "passwordHash"
          FROM "User"
          WHERE "id" = ${userId}
          FOR UPDATE
        `);
        const target = rows[0];
        if (!target) return { kind: "notFound" as const };
        if (await verifyPassword(initialPassword as string, target.passwordHash)) return { kind: "samePassword" as const };

        const passwordHash = await hashPassword(initialPassword as string);
        await tx.user.update({ where: { id: target.id }, data: { passwordHash, mustChangePassword: true } });
        await tx.authSession.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
        return { kind: "success" as const };
      });

      if (outcome.kind === "forbidden" || outcome.kind === "self") {
        res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
        return;
      }
      if (outcome.kind === "notFound") {
        res.status(404).json(errorResponse("NOT_FOUND", "User was not found."));
        return;
      }
      if (outcome.kind === "samePassword") {
        res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the highlighted fields.", { initialPassword: "New initial password must differ from the current password." }));
        return;
      }
      res.status(200).json({ userId, mustChangePassword: true });
    } catch {
      res.status(500).json(errorResponse("USER_MANAGEMENT_ERROR", "Unable to set the new initial password."));
    }
  },
);

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add:  GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// ---------------------------------------------------------------------------
app.get("/api/categories", requireNormalAccess, async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true, name: { in: supportedCategoryNames } },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Unable to load categories." });
  }
});

app.get("/api/requesters", requireNormalAccess, (_req: Request, res: Response) => {
  res.status(404).json(errorResponse("NOT_FOUND", "This endpoint is not available in the authenticated Requester workflow."));
});

app.get("/api/related-systems", requireNormalAccess, async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json(relatedSystems);
  } catch {
    res.status(500).json(errorResponse("REFERENCE_DATA_ERROR", "Unable to load Related Systems."));
  }
});

app.get("/api/staff/tickets", requireNormalAccess, requireItStaffRole, async (req: Request, res: Response) => {
  if (Object.keys(req.query).some((key) => !staffQueueQueryKeys.has(key))) {
    res.status(400).json(errorResponse("INVALID_QUERY", "One or more queue query parameters are invalid."));
    return;
  }

  const searchValue = singleQueryValue(req.query.search);
  const statusValue = singleQueryValue(req.query.status);
  const requestedPriorityValue = singleQueryValue(req.query.requestedPriority);
  const itPriorityValue = singleQueryValue(req.query.itPriority);
  const ownerValue = singleQueryValue(req.query.owner);
  const categoryValue = singleQueryValue(req.query.categoryId);
  const relatedSystemValue = singleQueryValue(req.query.relatedSystemId);
  const sortByValue = singleQueryValue(req.query.sortBy);
  const sortOrderValue = singleQueryValue(req.query.sortOrder);
  const pageValue = singleQueryValue(req.query.page);
  const pageSizeValue = singleQueryValue(req.query.pageSize);

  if ([searchValue, statusValue, requestedPriorityValue, itPriorityValue, ownerValue, categoryValue, relatedSystemValue, sortByValue, sortOrderValue, pageValue, pageSizeValue].includes(null)) {
    res.status(400).json(errorResponse("INVALID_QUERY", "One or more queue query parameters are invalid."));
    return;
  }

  const search = searchValue?.trim() || undefined;
  const categoryId = positiveQueryInteger(categoryValue ?? undefined);
  const relatedSystemId = positiveQueryInteger(relatedSystemValue ?? undefined);
  const page = positiveQueryInteger(pageValue ?? undefined) ?? 1;
  const parsedPageSize = positiveQueryInteger(pageSizeValue ?? undefined);
  const pageSize = parsedPageSize ?? 10;
  const sortBy = sortByValue ?? "updatedAt";
  const sortOrder = sortOrderValue ?? "desc";

  let ownerId: number | undefined;
  let unassignedOnly = false;
  if (typeof ownerValue === "string") {
    if (ownerValue === "unassigned") {
      unassignedOnly = true;
    } else {
      const parsedOwnerId = positiveQueryInteger(ownerValue);
      if (!parsedOwnerId) {
        res.status(400).json(errorResponse("INVALID_QUERY", "One or more queue query parameters are invalid."));
        return;
      }
      ownerId = parsedOwnerId;
    }
  }

  const invalidQuery =
    (search !== undefined && search.length > 100) ||
    (statusValue !== undefined && !allowedTicketStatuses.includes(statusValue as (typeof allowedTicketStatuses)[number])) ||
    (requestedPriorityValue !== undefined && !allowedPriorities.includes(requestedPriorityValue as RequestedPriorityInput)) ||
    (itPriorityValue !== undefined && !allowedPriorities.includes(itPriorityValue as RequestedPriorityInput)) ||
    categoryId === null ||
    relatedSystemId === null ||
    pageValue !== undefined && positiveQueryInteger(pageValue ?? undefined) === null ||
    pageSizeValue !== undefined && (parsedPageSize === null || !staffQueuePageSizes.includes(pageSize as (typeof staffQueuePageSizes)[number])) ||
    !staffQueueSortFields.includes(sortBy as (typeof staffQueueSortFields)[number]) ||
    !["asc", "desc"].includes(sortOrder);

  if (invalidQuery) {
    res.status(400).json(errorResponse("INVALID_QUERY", "One or more queue query parameters are invalid."));
    return;
  }

  const where: Prisma.TicketWhereInput = {};
  if (search) {
    where.OR = [
      { ticketNumber: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { requester: { is: { name: { contains: search, mode: "insensitive" } } } },
      { requester: { is: { email: { contains: search, mode: "insensitive" } } } },
    ];
  }
  if (statusValue !== undefined) where.currentStatus = statusValue as TicketStatus;
  if (requestedPriorityValue !== undefined) where.requestedPriority = requestedPriorityValue as RequestedPriority;
  if (itPriorityValue !== undefined) where.itPriority = itPriorityValue as RequestedPriority;
  if (unassignedOnly) where.ownerId = null;
  else if (ownerId !== undefined) where.ownerId = ownerId;
  if (categoryId !== undefined) where.categoryId = categoryId;
  if (relatedSystemId !== undefined) where.relatedSystemId = relatedSystemId;

  const orderField = sortBy === "status" ? "currentStatus" : sortBy;
  const orderBy = [
    { [orderField]: sortOrder },
    { id: "desc" },
  ] as Prisma.TicketOrderByWithRelationInput[];

  try {
    const prisma = getPrisma();
    const [totalItems, items, ownerOptions] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          createdAt: true,
          updatedAt: true,
          requester: { select: { id: true, name: true, email: true } },
          owner: { select: { id: true, name: true } },
        },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
        },
        select: { id: true, name: true, role: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    ]);

    res.status(200).json({
      items,
      ownerOptions,
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
    });
  } catch {
    res.status(500).json(errorResponse("QUEUE_ERROR", "Unable to load Ticket Queue."));
  }
});

app.get("/api/staff/tickets/:ticketId", requireNormalAccess, requireStaffDetailRole, async (req: Request, res: Response) => {
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
    return;
  }
  try {
    const prisma = getPrisma();
    const [ticket, ownerOptions] = await Promise.all([
      prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          description: true,
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          problemAppearsResolvedAt: true,
          createdAt: true,
          updatedAt: true,
          requester: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, role: true } },
          attachments: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removalReason: true },
            orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
          },
          publicComments: {
            select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          internalNotes: {
            select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      }),
      prisma.user.findMany({
        where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
        select: { id: true, name: true, role: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    ]);
    if (!ticket) {
      res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
      return;
    }
    res.status(200).json({
      ...ticket,
      currentStatusLabel: ticketStatusLabel(ticket.currentStatus),
      ownerOptions,
      attachments: ticket.attachments.map((attachment) => attachmentMetadata(
        attachment,
        `/api/staff/tickets/${ticketId}/attachments/${attachment.id}/download`,
      )),
    });
  } catch {
    res.status(500).json(errorResponse("STAFF_TICKET_DETAIL_ERROR", "Unable to load Ticket Detail."));
  }
});

app.get(
  "/api/staff/tickets/:ticketId/attachments/:attachmentId/download",
  requireNormalAccess,
  requireStaffDetailRole,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    const attachmentId = toPositiveInteger(req.params.attachmentId);
    if (!ticketId || !attachmentId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket and Attachment IDs must be positive integers."));
      return;
    }
    try {
      const attachment = await getPrisma().attachment.findFirst({ where: { id: attachmentId, ticketId, removedAt: null } });
      if (!attachment) {
        res.status(404).json(errorResponse("NOT_FOUND", "Attachment was not found."));
        return;
      }
      const content = await readFile(attachment.storagePath);
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(attachment.originalFilename)}"`);
      res.status(200).send(content);
    } catch {
      res.status(500).json(errorResponse("DOWNLOAD_ATTACHMENT_ERROR", "Unable to download Attachment."));
    }
  },
);

app.post(
  "/api/staff/tickets/:ticketId/claim",
  requireNormalAccess,
  requireItStaffRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    if (!ticketId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
      return;
    }
    try {
      const prisma = getPrisma();
      const outcome = await prisma.$transaction(async (tx) => {
        const claimants = await tx.$queryRaw<Array<{ id: number; name: string; role: string; isActive: boolean }>>(Prisma.sql`
          SELECT "id", "name", "role", "isActive"
          FROM "User"
          WHERE "id" = ${req.auth!.user.id}
          FOR UPDATE
        `);
        const claimant = claimants[0];
        if (!claimant || !claimant.isActive || claimant.role !== "IT_STAFF") {
          return { kind: "forbidden" as const };
        }

        const tickets = await tx.$queryRaw<Array<{ id: number; ownerId: number | null }>>(Prisma.sql`
          SELECT "id", "ownerId"
          FROM "Ticket"
          WHERE "id" = ${ticketId}
          FOR UPDATE
        `);
        const ticket = tickets[0];
        if (!ticket) return { kind: "notFound" as const };
        if (ticket.ownerId !== null) return { kind: "conflict" as const };

        await tx.ticket.update({ where: { id: ticketId }, data: { ownerId: claimant.id } });
        return {
          kind: "success" as const,
          owner: { id: claimant.id, name: claimant.name, role: claimant.role },
        };
      });

      if (outcome.kind === "forbidden") {
        res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
        return;
      }
      if (outcome.kind === "notFound") {
        res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
        return;
      }
      if (outcome.kind === "conflict") {
        res.status(409).json(errorResponse("OWNER_CONFLICT", "Ticket is already assigned."));
        return;
      }
      res.status(200).json({ owner: outcome.owner });
    } catch {
      res.status(500).json(errorResponse("OWNER_UPDATE_ERROR", "Unable to claim Ticket."));
    }
  },
);

app.patch(
  "/api/staff/tickets/:ticketId/owner",
  requireNormalAccess,
  requireItStaffRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    if (!ticketId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
      return;
    }
    const ownerId = req.body.ownerId === null ? null : toPositiveInteger(req.body.ownerId);
    if (req.body.ownerId !== null && !ownerId) {
      res.status(400).json(errorResponse("INVALID_OWNER", "Owner must be an active IT Staff or Administrator."));
      return;
    }
    try {
      const prisma = getPrisma();
      const outcome = await prisma.$transaction(async (tx) => {
        let owner: { id: number; name: string; role: string } | null = null;
        if (ownerId !== null) {
          const owners = await tx.$queryRaw<Array<{ id: number; name: string; role: string; isActive: boolean }>>(Prisma.sql`
            SELECT "id", "name", "role", "isActive"
            FROM "User"
            WHERE "id" = ${ownerId}
            FOR UPDATE
          `);
          const candidate = owners[0];
          if (!candidate || !candidate.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(candidate.role)) {
            return { kind: "invalidOwner" as const };
          }
          owner = { id: candidate.id, name: candidate.name, role: candidate.role };
        }

        const tickets = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          SELECT "id"
          FROM "Ticket"
          WHERE "id" = ${ticketId}
          FOR UPDATE
        `);
        if (!tickets[0]) return { kind: "notFound" as const };

        await tx.ticket.update({ where: { id: ticketId }, data: { ownerId } });
        return { kind: "success" as const, owner };
      });

      if (outcome.kind === "notFound") {
        res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
        return;
      }
      if (outcome.kind === "invalidOwner") {
        res.status(400).json(errorResponse("INVALID_OWNER", "Owner must be an active IT Staff or Administrator."));
        return;
      }
      res.status(200).json({ owner: outcome.owner });
    } catch {
      res.status(500).json(errorResponse("OWNER_UPDATE_ERROR", "Unable to update Ticket owner."));
    }
  },
);

app.patch(
  "/api/staff/tickets/:ticketId/it-priority",
  requireNormalAccess,
  requireStaffDetailRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    const itPriority = typeof req.body.itPriority === "string" ? req.body.itPriority : "";
    if (!ticketId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
      return;
    }
    if (!allowedPriorities.includes(itPriority as RequestedPriorityInput)) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "IT Priority is invalid."));
      return;
    }
    try {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, requestedPriority: true } });
      if (!ticket) {
        res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
        return;
      }
      const updated = await prisma.ticket.update({ where: { id: ticketId }, data: { itPriority: itPriority as RequestedPriority }, select: { itPriority: true, requestedPriority: true } });
      res.status(200).json(updated);
    } catch {
      res.status(500).json(errorResponse("IT_PRIORITY_ERROR", "Unable to update IT Priority."));
    }
  },
);

app.patch(
  "/api/staff/tickets/:ticketId/status",
  requireNormalAccess,
  requireItStaffRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    const status = typeof req.body.status === "string" ? req.body.status : "";
    if (!ticketId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
      return;
    }
    if (!allowedTicketStatuses.includes(status as (typeof allowedTicketStatuses)[number])) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket status is invalid."));
      return;
    }
    try {
      const prisma = getPrisma();
      const outcome = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: number; currentStatus: TicketStatus }>>(Prisma.sql`
          SELECT "id", "currentStatus" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE
        `);
        const ticket = rows[0];
        if (!ticket) return { kind: "notFound" as const };
        if (!canTransitionTicketStatus(ticket.currentStatus, status as TicketStatus)) {
          return { kind: "invalid" as const };
        }
        const updated = await tx.ticket.update({ where: { id: ticketId }, data: { currentStatus: status as TicketStatus }, select: { currentStatus: true } });
        return { kind: "success" as const, currentStatus: updated.currentStatus };
      });
      if (outcome.kind === "notFound") {
        res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
        return;
      }
      if (outcome.kind === "invalid") {
        res.status(400).json(errorResponse("INVALID_TRANSITION", "Ticket status transition is not allowed."));
        return;
      }
      res.status(200).json({ currentStatus: outcome.currentStatus, currentStatusLabel: ticketStatusLabel(outcome.currentStatus) });
    } catch {
      res.status(500).json(errorResponse("STATUS_UPDATE_ERROR", "Unable to update Ticket status."));
    }
  },
);

app.get("/api/staff/tickets/:ticketId/internal-notes", requireNormalAccess, requireStaffDetailRole, async (req: Request, res: Response) => {
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
    return;
  }
  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) {
      res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
      return;
    }
    const notes = await prisma.internalNote.findMany({
      where: { ticketId },
      select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    res.status(200).json(notes);
  } catch {
    res.status(500).json(errorResponse("INTERNAL_NOTES_ERROR", "Unable to load Internal Notes."));
  }
});

app.post(
  "/api/staff/tickets/:ticketId/internal-notes",
  requireNormalAccess,
  requireItStaffRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    if (!ticketId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
      return;
    }
    const validation = validateCommunicationContent(req.body.content);
    if (!validation.valid) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the highlighted fields.", { content: validation.message }));
      return;
    }
    try {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
      if (!ticket) {
        res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
        return;
      }
      const note = await prisma.internalNote.create({
        data: { ticketId, authorId: req.auth!.user.id, content: validation.content },
        select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
      });
      res.status(201).json(note);
    } catch {
      res.status(500).json(errorResponse("INTERNAL_NOTES_ERROR", "Unable to add Internal Note."));
    }
  },
);

app.post("/api/tickets", requireNormalAccess, requireRequesterRole, requireApprovedOrigin, requireCsrf, async (req: Request, res: Response) => {
  const validation = validateAuthenticatedCreateTicketInput(req.body);
  if (!validation.valid) {
    const fields = Object.fromEntries(validation.errors.map((error) => [error.field, error.message]));
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the highlighted fields.", fields));
    return;
  }

  const prisma = getPrisma();
  const requesterId = req.auth!.user.id;

  try {
    const [category, relatedSystem, existing] = await Promise.all([
      prisma.category.findFirst({ where: { id: validation.data.categoryId, isActive: true } }),
      prisma.relatedSystem.findFirst({ where: { id: validation.data.relatedSystemId, isActive: true } }),
      prisma.ticket.findUnique({ where: { clientRequestId: validation.data.clientRequestId } }),
    ]);

    const referenceErrors: ValidationError[] = [];
    if (!category) referenceErrors.push({ field: "categoryId", message: "Category is not available." });
    if (!relatedSystem) referenceErrors.push({ field: "relatedSystemId", message: "Related System is not available." });

    if (referenceErrors.length > 0) {
      const fields = Object.fromEntries(referenceErrors.map((error) => [error.field, error.message]));
      res.status(404).json(errorResponse("REFERENCE_NOT_FOUND", "Selected category or related system is not available.", fields));
      return;
    }

    if (existing) {
      const samePayload = existing.requesterId === requesterId &&
        existing.categoryId === validation.data.categoryId &&
        existing.relatedSystemId === validation.data.relatedSystemId &&
        existing.summary === validation.data.summary &&
        existing.description === validation.data.description &&
        existing.requestedPriority === validation.data.requestedPriority;
      if (!samePayload) {
        res.status(409).json(errorResponse("IDEMPOTENCY_CONFLICT", "clientRequestId is already in use."));
        return;
      }
      res.status(200).json(requesterCreateResponse(existing, true));
      return;
    }

    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const sequence = (await prisma.ticket.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } })) + 1;
    const ticketNumber = buildTicketNumber(now, sequence);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        clientRequestId: validation.data.clientRequestId,
        requesterId,
        categoryId: validation.data.categoryId,
        relatedSystemId: validation.data.relatedSystemId,
        summary: validation.data.summary,
        description: validation.data.description,
        requestedPriority: validation.data.requestedPriority,
        itPriority: validation.data.requestedPriority,
        currentStatus: "NEW",
      },
    });

    res.status(201).json(requesterCreateResponse(ticket, false));
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "P2002") {
      const existing = await prisma.ticket.findUnique({ where: { clientRequestId: validation.data.clientRequestId } });
      if (existing) {
        const samePayload = existing.requesterId === requesterId &&
          existing.categoryId === validation.data.categoryId &&
          existing.relatedSystemId === validation.data.relatedSystemId &&
          existing.summary === validation.data.summary &&
          existing.description === validation.data.description &&
          existing.requestedPriority === validation.data.requestedPriority;
        if (samePayload) {
          res.status(200).json(requesterCreateResponse(existing, true));
          return;
        }
        res.status(409).json(errorResponse("IDEMPOTENCY_CONFLICT", "clientRequestId is already in use."));
        return;
      }
    }
    res.status(500).json(errorResponse("CREATE_TICKET_ERROR", "Unable to create Ticket."));
  }
});

app.get("/api/tickets/mine", requireNormalAccess, requireRequesterRole, async (req: Request, res: Response) => {
  const requesterId = req.auth!.user.id;
  const queryErrors: Record<string, string> = {};
  const parseOptionalId = (field: "categoryId" | "relatedSystemId") => {
    const value = req.query[field];
    if (value === undefined) return undefined;
    const parsed = typeof value === "string" ? toPositiveInteger(value) : null;
    if (!parsed) queryErrors[field] = `${field === "categoryId" ? "Category" : "Related System"} ID must be a positive integer.`;
    return parsed ?? undefined;
  };

  const categoryId = parseOptionalId("categoryId");
  const relatedSystemId = parseOptionalId("relatedSystemId");
  const requestedPriority = req.query.requestedPriority;
  const currentStatus = req.query.currentStatus;
  const sortBy = req.query.sortBy ?? "updatedAt";
  const sortDirection = req.query.sortDirection ?? "desc";
  const page = req.query.page === undefined ? 1 : toPositiveInteger(req.query.page);
  const pageSize = req.query.pageSize === undefined ? 10 : toPositiveInteger(req.query.pageSize);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const sortableFields = ["createdAt", "updatedAt", "requestedPriority", "ticketNumber"];

  if (requestedPriority !== undefined &&
      (typeof requestedPriority !== "string" || !allowedPriorities.includes(requestedPriority as RequestedPriorityInput))) {
    queryErrors.requestedPriority = "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.";
  }
  if (currentStatus !== undefined &&
      (typeof currentStatus !== "string" || !allowedTicketStatuses.includes(currentStatus as (typeof allowedTicketStatuses)[number]))) {
    queryErrors.currentStatus = "Current Status is invalid.";
  }
  if (typeof sortBy !== "string" || !sortableFields.includes(sortBy)) queryErrors.sortBy = "Sort field must be createdAt, updatedAt, requestedPriority, or ticketNumber.";
  if (sortDirection !== "asc" && sortDirection !== "desc") queryErrors.sortDirection = "Sort direction must be asc or desc.";
  if (!page) queryErrors.page = "Page must be a positive integer.";
  if (!pageSize || ![5, 10, 20].includes(pageSize)) queryErrors.pageSize = "Page size must be 5, 10, or 20.";
  if (req.query.search !== undefined && typeof req.query.search !== "string") queryErrors.search = "Search must be text.";

  if (Object.keys(queryErrors).length > 0) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the invalid query parameters.", queryErrors));
    return;
  }

  try {
    const prisma = getPrisma();
    const where: Prisma.TicketWhereInput = {
      requesterId,
      ...(categoryId ? { categoryId } : {}),
      ...(relatedSystemId ? { relatedSystemId } : {}),
      ...(typeof requestedPriority === "string" ? { requestedPriority: requestedPriority as RequestedPriorityInput } : {}),
      ...(typeof currentStatus === "string" ? { currentStatus: currentStatus as (typeof allowedTicketStatuses)[number] } : {}),
      ...(search ? {
        OR: [
          { ticketNumber: { contains: search, mode: "insensitive" } },
          { summary: { contains: search, mode: "insensitive" } },
          { category: { name: { contains: search, mode: "insensitive" } } },
          { relatedSystem: { name: { contains: search, mode: "insensitive" } } },
        ],
      } : {}),
    };
    const select = {
      id: true,
      ticketNumber: true,
      summary: true,
      category: { select: { id: true, name: true } },
      relatedSystem: { select: { id: true, name: true } },
      requestedPriority: true,
      currentStatus: true,
      updatedAt: true,
    } satisfies Prisma.TicketSelect;
    const totalItems = await prisma.ticket.count({ where });
    let tickets;
    if (sortBy === "requestedPriority") {
      const priorityRank: Record<RequestedPriorityInput, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
      const allTickets = await prisma.ticket.findMany({ where, select });
      const direction = sortDirection === "asc" ? 1 : -1;
      allTickets.sort((left, right) => {
        const priorityDifference = (priorityRank[left.requestedPriority] - priorityRank[right.requestedPriority]) * direction;
        return priorityDifference || right.ticketNumber.localeCompare(left.ticketNumber);
      });
      tickets = allTickets.slice(((page as number) - 1) * (pageSize as number), (page as number) * (pageSize as number));
    } else {
      tickets = await prisma.ticket.findMany({
        where,
        select,
        orderBy: [{ [sortBy as string]: sortDirection } as Prisma.TicketOrderByWithRelationInput, { ticketNumber: "desc" }],
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
      });
    }
    res.status(200).json({
      items: tickets.map((ticket) => ({ ...ticket, currentStatusLabel: ticketStatusLabel(ticket.currentStatus) })),
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / (pageSize as number)),
    });
  } catch {
    res.status(500).json(errorResponse("MY_TICKETS_ERROR", "Unable to load Tickets."));
  }
});

app.get("/api/tickets/:ticketId", requireNormalAccess, requireRequesterRole, async (req: Request, res: Response) => {
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
    return;
  }
  try {
    const requesterId = req.auth!.user.id;
    const ticket = await getPrisma().ticket.findFirst({
      where: { id: ticketId, requesterId },
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        description: true,
        requestedPriority: true,
        currentStatus: true,
        problemAppearsResolvedAt: true,
        createdAt: true,
        updatedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: {
          select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removalReason: true },
          orderBy: { uploadedAt: "asc" },
        },
      },
    });
    if (!ticket) {
      res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
      return;
    }
    res.status(200).json({
      ...ticket,
      currentStatusLabel: ticketStatusLabel(ticket.currentStatus),
      attachments: ticket.attachments.map((attachment) => attachmentMetadata(
        attachment,
        `/api/tickets/${ticketId}/attachments/${attachment.id}/download`,
      )),
    });
  } catch {
    res.status(500).json(errorResponse("TICKET_DETAIL_ERROR", "Unable to load Ticket Detail."));
  }
});

app.get("/api/tickets/:ticketId/attachments", requireNormalAccess, requireRequesterRole, async (req: Request, res: Response) => {
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
    return;
  }
  try {
    const requesterId = req.auth!.user.id;
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
    if (!ticket) {
      res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
      return;
    }
    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removalReason: true },
      orderBy: { uploadedAt: "asc" },
    });
    res.status(200).json(attachments.map((attachment) => attachmentMetadata(
      attachment,
      `/api/tickets/${ticketId}/attachments/${attachment.id}/download`,
    )));
  } catch {
    res.status(500).json(errorResponse("ATTACHMENTS_ERROR", "Unable to load Attachments."));
  }
});

app.post(
  "/api/tickets/:ticketId/attachments",
  requireNormalAccess,
  requireRequesterRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    if (!ticketId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket is required.", { ticketId: "Ticket is required." }));
      return;
    }
    try {
      const { file } = await parseMultipartRequest(req);
      if (!file) {
        res.status(400).json(errorResponse("VALIDATION_ERROR", "Attachment file is required.", { file: "Attachment file is required." }));
        return;
      }
      const requesterId = req.auth!.user.id;
      const prisma = getPrisma();
      const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
      if (!ticket) {
        res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
        return;
      }
      const activeAttachmentCount = await prisma.attachment.count({ where: { ticketId, removedAt: null } });
      const attachmentValidation = validateAttachmentCandidate({ filename: file.filename, sizeBytes: file.sizeBytes }, activeAttachmentCount);
      if (!attachmentValidation.valid) {
        const errorMessage = attachmentValidation.error ?? "Attachment is invalid.";
        const status = errorMessage === "Attachment must be 5 MB or smaller." ? 413 : errorMessage === "A Ticket may have at most five active attachments." ? 400 : 415;
        const code = status === 413 ? "FILE_TOO_LARGE" : status === 400 ? "VALIDATION_ERROR" : "UNSUPPORTED_FILE_TYPE";
        res.status(status).json(errorResponse(code, errorMessage));
        return;
      }
      const extension = getAllowedExtension(file.filename);
      if (!extension) {
        res.status(415).json(errorResponse("UNSUPPORTED_FILE_TYPE", "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed."));
        return;
      }
      const storedFilename = `${randomUUID()}${extension}`;
      const storagePath = path.join(uploadDirectory, storedFilename);
      await mkdir(uploadDirectory, { recursive: true });
      await writeFile(storagePath, file.content);
      let attachment;
      try {
        attachment = await prisma.attachment.create({
          data: {
            ticketId,
            originalFilename: sanitizeFilename(file.filename),
            storedFilename,
            mimeType: file.contentType,
            sizeBytes: file.sizeBytes,
            storagePath,
          },
        });
      } catch (error) {
        await unlink(storagePath).catch(() => undefined);
        throw error;
      }
      const { storagePath: _storagePath, ...safeAttachment } = attachment;
      res.status(201).json({
        ...safeAttachment,
        state: "active",
        downloadUrl: `/api/tickets/${ticketId}/attachments/${attachment.id}/download`,
      });
    } catch {
      res.status(500).json(errorResponse("UPLOAD_ATTACHMENT_ERROR", "Unable to upload Attachment."));
    }
  },
);

app.get(
  "/api/tickets/:ticketId/attachments/:attachmentId/download",
  requireNormalAccess,
  requireRequesterRole,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    const attachmentId = toPositiveInteger(req.params.attachmentId);
    if (!ticketId || !attachmentId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket and Attachment IDs must be positive integers."));
      return;
    }
    try {
      const requesterId = req.auth!.user.id;
      const attachment = await getPrisma().attachment.findFirst({
        where: { id: attachmentId, ticketId, ticket: { requesterId }, removedAt: null },
      });
      if (!attachment) {
        res.status(404).json(errorResponse("NOT_FOUND", "Attachment was not found."));
        return;
      }
      const content = await readFile(attachment.storagePath);
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(attachment.originalFilename)}"`);
      res.status(200).send(content);
    } catch {
      res.status(500).json(errorResponse("DOWNLOAD_ATTACHMENT_ERROR", "Unable to download Attachment."));
    }
  },
);

app.delete(
  "/api/tickets/:ticketId/attachments/:attachmentId",
  requireNormalAccess,
  requireRequesterRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    const attachmentId = toPositiveInteger(req.params.attachmentId);
    if (!ticketId || !attachmentId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket and Attachment IDs must be positive integers."));
      return;
    }
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Removal reason is required.", { reason: "Removal reason is required." }));
      return;
    }
    try {
      const requesterId = req.auth!.user.id;
      const prisma = getPrisma();
      const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, ticketId, ticket: { requesterId } } });
      if (!attachment) {
        res.status(404).json(errorResponse("NOT_FOUND", "Attachment was not found."));
        return;
      }
      if (attachment.removedAt) {
        res.status(409).json(errorResponse("ATTACHMENT_REMOVED", "Attachment has already been removed."));
        return;
      }
      const removed = await prisma.attachment.update({
        where: { id: attachmentId },
        data: { removedAt: new Date(), removedByUserId: requesterId, removalReason: reason },
      });
      res.status(200).json(attachmentMetadata(removed));
    } catch {
      res.status(500).json(errorResponse("REMOVE_ATTACHMENT_ERROR", "Unable to remove Attachment."));
    }
  },
);

app.get("/api/tickets/:ticketId/comments", requireNormalAccess, async (req: Request, res: Response) => {
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
    return;
  }
  try {
    const user = req.auth!.user;
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: user.role === "REQUESTER" ? { id: ticketId, requesterId: user.id } : { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
      return;
    }
    const comments = await prisma.publicComment.findMany({
      where: { ticketId },
      select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    res.status(200).json(comments);
  } catch {
    res.status(500).json(errorResponse("COMMENTS_ERROR", "Unable to load Public Comments."));
  }
});

app.post(
  "/api/tickets/:ticketId/comments",
  requireNormalAccess,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    if (!ticketId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
      return;
    }
    const user = req.auth!.user;
    if (user.role === "ADMINISTRATOR") {
      res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
      return;
    }
    const contentValidation = validateCommunicationContent(req.body.content);
    if (!contentValidation.valid) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the highlighted fields.", {
        content: contentValidation.message.replace("Content", "Comment"),
      }));
      return;
    }
    try {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.findFirst({
        where: user.role === "REQUESTER" ? { id: ticketId, requesterId: user.id } : { id: ticketId },
        select: { id: true },
      });
      if (!ticket) {
        res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
        return;
      }
      const comment = await prisma.publicComment.create({
        data: { ticketId, authorId: user.id, content: contentValidation.content },
        select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
      });
      res.status(201).json(comment);
    } catch {
      res.status(500).json(errorResponse("COMMENTS_ERROR", "Unable to post Public Comment."));
    }
  },
);

app.get("/api/tickets/:ticketId/notes", requireNormalAccess, async (req: Request, res: Response) => {
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
    return;
  }
  if (req.auth!.user.role === "REQUESTER") {
    res.status(403).json(errorResponse("FORBIDDEN", "This operation is not permitted for the current role."));
    return;
  }
  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) {
      res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
      return;
    }
    const notes = await prisma.internalNote.findMany({
      where: { ticketId },
      select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    res.status(200).json(notes);
  } catch {
    res.status(500).json(errorResponse("INTERNAL_NOTES_ERROR", "Unable to load Internal Notes."));
  }
});

app.post(
  "/api/tickets/:ticketId/problem-appears-resolved",
  requireNormalAccess,
  requireRequesterRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const ticketId = toPositiveInteger(req.params.ticketId);
    if (!ticketId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
      return;
    }
    try {
      const requesterId = req.auth!.user.id;
      const prisma = getPrisma();
      const outcome = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{
          id: number;
          currentStatus: string;
          problemAppearsResolvedAt: Date | null;
          problemAppearsResolvedById: number | null;
        }>>(Prisma.sql`
          SELECT
            "id",
            "currentStatus",
            "problemAppearsResolvedAt",
            "problemAppearsResolvedById"
          FROM "Ticket"
          WHERE "id" = ${ticketId}
            AND "requesterId" = ${requesterId}
          FOR UPDATE
        `);

        const ticket = rows[0];
        if (!ticket) return { kind: "notFound" as const };
        if (!requesterResolutionEligibleStatuses.includes(
          ticket.currentStatus as (typeof requesterResolutionEligibleStatuses)[number],
        )) {
          return { kind: "ineligible" as const };
        }
        if (ticket.problemAppearsResolvedAt) {
          return {
            kind: "success" as const,
            problemAppearsResolvedAt: ticket.problemAppearsResolvedAt,
            currentStatus: ticket.currentStatus,
          };
        }

        const updated = await tx.ticket.update({
          where: { id: ticketId },
          data: { problemAppearsResolvedAt: new Date(), problemAppearsResolvedById: requesterId },
          select: { currentStatus: true, problemAppearsResolvedAt: true },
        });
        return {
          kind: "success" as const,
          problemAppearsResolvedAt: updated.problemAppearsResolvedAt,
          currentStatus: updated.currentStatus,
        };
      });

      if (outcome.kind === "notFound") {
        res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
        return;
      }
      if (outcome.kind === "ineligible") {
        res.status(409).json(errorResponse(
          "RESOLUTION_INDICATION_NOT_ALLOWED",
          "Problem Appears Resolved is not available for the Ticket's current status.",
        ));
        return;
      }
      res.status(200).json({
        problemAppearsResolvedAt: outcome.problemAppearsResolvedAt,
        currentStatus: outcome.currentStatus,
      });
    } catch {
      res.status(500).json(errorResponse("RESOLUTION_INDICATION_ERROR", "Unable to record the resolution indication."));
    }
  },
);

app.get("/api/requesters/:requesterId/tickets", requireNormalAccess, requireRequesterRole, async (req: Request, res: Response) => {
  const requesterId = toPositiveInteger(req.params.requesterId);
  if (!requesterId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Requester ID must be a positive integer."));
    return;
  }
  if (requesterId !== req.auth!.user.id) {
    res.status(404).json(errorResponse("NOT_FOUND", "Requester was not found."));
    return;
  }

  const queryErrors: Record<string, string> = {};
  const parseOptionalId = (field: "categoryId" | "relatedSystemId") => {
    const value = req.query[field];
    if (value === undefined) return undefined;
    const parsed = typeof value === "string" ? toPositiveInteger(value) : null;
    if (!parsed) queryErrors[field] = `${field === "categoryId" ? "Category" : "Related System"} ID must be a positive integer.`;
    return parsed ?? undefined;
  };

  const categoryId = parseOptionalId("categoryId");
  const relatedSystemId = parseOptionalId("relatedSystemId");
  const requestedPriority = req.query.requestedPriority;
  const currentStatus = req.query.currentStatus;
  const sortBy = req.query.sortBy ?? "updatedAt";
  const sortDirection = req.query.sortDirection ?? "desc";
  const page = req.query.page === undefined ? 1 : toPositiveInteger(req.query.page);
  const pageSize = req.query.pageSize === undefined ? 10 : toPositiveInteger(req.query.pageSize);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const sortableFields = ["createdAt", "updatedAt", "requestedPriority", "ticketNumber"];

  if (requestedPriority !== undefined &&
      (typeof requestedPriority !== "string" || !allowedPriorities.includes(requestedPriority as RequestedPriorityInput))) {
    queryErrors.requestedPriority = "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.";
  }
  if (currentStatus !== undefined && currentStatus !== "NEW") {
    queryErrors.currentStatus = "Current Status must be NEW.";
  }
  if (typeof sortBy !== "string" || !sortableFields.includes(sortBy)) {
    queryErrors.sortBy = "Sort field must be createdAt, updatedAt, requestedPriority, or ticketNumber.";
  }
  if (sortDirection !== "asc" && sortDirection !== "desc") {
    queryErrors.sortDirection = "Sort direction must be asc or desc.";
  }
  if (!page) queryErrors.page = "Page must be a positive integer.";
  if (!pageSize || ![5, 10, 20].includes(pageSize)) queryErrors.pageSize = "Page size must be 5, 10, or 20.";
  if (req.query.search !== undefined && typeof req.query.search !== "string") {
    queryErrors.search = "Search must be text.";
  }

  if (Object.keys(queryErrors).length > 0) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the invalid query parameters.", queryErrors));
    return;
  }

  try {
    const prisma = getPrisma();
    const requester = await prisma.user.findFirst({
      where: { id: requesterId, role: "REQUESTER", isActive: true },
      select: { id: true },
    });
    if (!requester) {
      res.status(404).json(errorResponse("NOT_FOUND", "Requester was not found."));
      return;
    }

    const where: Prisma.TicketWhereInput = {
      requesterId,
      ...(categoryId ? { categoryId } : {}),
      ...(relatedSystemId ? { relatedSystemId } : {}),
      ...(typeof requestedPriority === "string" ? { requestedPriority: requestedPriority as RequestedPriorityInput } : {}),
      ...(currentStatus === "NEW" ? { currentStatus: "NEW" } : {}),
      ...(search
        ? {
            OR: [
              { ticketNumber: { contains: search, mode: "insensitive" } },
              { summary: { contains: search, mode: "insensitive" } },
              { category: { name: { contains: search, mode: "insensitive" } } },
              { relatedSystem: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const select = {
      id: true,
      ticketNumber: true,
      summary: true,
      category: { select: { id: true, name: true } },
      relatedSystem: { select: { id: true, name: true } },
      requestedPriority: true,
      currentStatus: true,
      updatedAt: true,
    } satisfies Prisma.TicketSelect;
    const totalItems = await prisma.ticket.count({ where });
    let tickets;

    if (sortBy === "requestedPriority") {
      const priorityRank: Record<RequestedPriorityInput, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
      const allTickets = await prisma.ticket.findMany({ where, select });
      const direction = sortDirection === "asc" ? 1 : -1;
      allTickets.sort((left, right) => {
        const priorityDifference = (priorityRank[left.requestedPriority] - priorityRank[right.requestedPriority]) * direction;
        return priorityDifference || right.ticketNumber.localeCompare(left.ticketNumber);
      });
      tickets = allTickets.slice(((page as number) - 1) * (pageSize as number), (page as number) * (pageSize as number));
    } else {
      const primaryOrder = { [sortBy as string]: sortDirection } as Prisma.TicketOrderByWithRelationInput;
      tickets = await prisma.ticket.findMany({
        where,
        select,
        orderBy: [primaryOrder, { ticketNumber: "desc" }],
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
      });
    }

    res.status(200).json({
      items: tickets.map((ticket) => ({ ...ticket, currentStatusLabel: "New" })),
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / (pageSize as number)),
    });
  } catch {
    res.status(500).json(errorResponse("MY_TICKETS_ERROR", "Unable to load Tickets."));
  }
});

app.get("/api/requesters/:requesterId/tickets/:ticketId", requireNormalAccess, requireRequesterRole, async (req: Request, res: Response) => {
  const requesterId = toPositiveInteger(req.params.requesterId);
  const ticketId = toPositiveInteger(req.params.ticketId);

  if (!requesterId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Requester ID must be a positive integer."));
    return;
  }
  if (!ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket ID must be a positive integer."));
    return;
  }
  if (requesterId !== req.auth!.user.id) {
    res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
    return;
  }

  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id: ticketId, requesterId },
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        description: true,
        requestedPriority: true,
        currentStatus: true,
        createdAt: true,
        updatedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
            removedAt: true,
            removalReason: true,
          },
          orderBy: { uploadedAt: "asc" },
        },
      },
    });

    if (!ticket) {
      res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
      return;
    }

    res.status(200).json({
      ...ticket,
      currentStatusLabel: "New",
      attachments: ticket.attachments.map((attachment) => attachmentMetadata(
        attachment,
        `/api/requesters/${requesterId}/tickets/${ticketId}/attachments/${attachment.id}/download`,
      )),
    });
  } catch {
    res.status(500).json(errorResponse("TICKET_DETAIL_ERROR", "Unable to load Ticket Detail."));
  }
});

app.get("/api/requesters/:requesterId/tickets/:ticketId/attachments", requireNormalAccess, requireRequesterRole, async (req: Request, res: Response) => {
  const requesterId = toPositiveInteger(req.params.requesterId);
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!requesterId || !ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Requester ID and Ticket ID must be positive integers."));
    return;
  }
  if (requesterId !== req.auth!.user.id) {
    res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId },
      select: { id: true },
    });
    if (!ticket) {
      res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
      return;
    }

    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
        removedAt: true,
        removalReason: true,
      },
      orderBy: { uploadedAt: "asc" },
    });
    res.status(200).json(attachments.map((attachment) => attachmentMetadata(
      attachment,
      `/api/requesters/${requesterId}/tickets/${ticketId}/attachments/${attachment.id}/download`,
    )));
  } catch {
    res.status(500).json(errorResponse("ATTACHMENTS_ERROR", "Unable to load Attachments."));
  }
});

app.post("/api/requesters/:requesterId/tickets/:ticketId/attachments", requireNormalAccess, requireRequesterRole, requireApprovedOrigin, requireCsrf, async (req: Request, res: Response) => {
  const requesterId = toPositiveInteger(req.params.requesterId);
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!requesterId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Requester is required.", { requesterId: "Requester is required." }));
    return;
  }
  if (!ticketId) {
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Ticket is required.", { ticketId: "Ticket is required." }));
    return;
  }
  if (requesterId !== req.auth!.user.id) {
    res.status(404).json(errorResponse("NOT_FOUND", "Ticket was not found."));
    return;
  }

  try {
    const { file } = await parseMultipartRequest(req);

    if (!file) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Attachment file is required.", { file: "Attachment file is required." }));
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId } });
    if (!ticket) {
      res.status(404).json(errorResponse("TICKET_NOT_FOUND", "Ticket not found."));
      return;
    }

    const activeAttachmentCount = await prisma.attachment.count({ where: { ticketId, removedAt: null } });
    const attachmentValidation = validateAttachmentCandidate(
      { filename: file.filename, sizeBytes: file.sizeBytes },
      activeAttachmentCount,
    );

    if (!attachmentValidation.valid) {
      const errorMessage = attachmentValidation.error ?? "Attachment is invalid.";
      const status =
        errorMessage === "Attachment must be 5 MB or smaller."
          ? 413
          : errorMessage === "A Ticket may have at most five active attachments."
            ? 400
            : 415;
      const code =
        status === 413 ? "FILE_TOO_LARGE" : status === 400 ? "VALIDATION_ERROR" : "UNSUPPORTED_FILE_TYPE";
      res.status(status).json(errorResponse(code, errorMessage));
      return;
    }

    const extension = getAllowedExtension(file.filename);
    if (!extension) {
      res.status(415).json(errorResponse("UNSUPPORTED_FILE_TYPE", "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed."));
      return;
    }

    const storedFilename = `${randomUUID()}${extension}`;
    const storagePath = path.join(uploadDirectory, storedFilename);

    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(storagePath, file.content);

    let attachment;
    try {
      attachment = await prisma.attachment.create({
        data: {
          ticketId,
          originalFilename: sanitizeFilename(file.filename),
          storedFilename,
          mimeType: file.contentType,
          sizeBytes: file.sizeBytes,
          storagePath,
        },
      });
    } catch (error) {
      await unlink(storagePath).catch(() => undefined);
      throw error;
    }

    const { storagePath: _storagePath, ...safeAttachment } = attachment;
    res.status(201).json(safeAttachment);
  } catch {
    res.status(500).json(errorResponse("UPLOAD_ATTACHMENT_ERROR", "Unable to upload Attachment."));
  }
});

app.get(
  "/api/requesters/:requesterId/tickets/:ticketId/attachments/:attachmentId/download",
  requireNormalAccess,
  requireRequesterRole,
  async (req: Request, res: Response) => {
    const requesterId = toPositiveInteger(req.params.requesterId);
    const ticketId = toPositiveInteger(req.params.ticketId);
    const attachmentId = toPositiveInteger(req.params.attachmentId);
    if (!requesterId || !ticketId || !attachmentId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Requester, Ticket, and Attachment IDs must be positive integers."));
      return;
    }
    if (requesterId !== req.auth!.user.id) {
      res.status(404).json(errorResponse("NOT_FOUND", "Attachment was not found."));
      return;
    }

    try {
      const attachment = await getPrisma().attachment.findFirst({
        where: { id: attachmentId, ticketId, ticket: { requesterId }, removedAt: null },
      });
      if (!attachment) {
        res.status(404).json(errorResponse("NOT_FOUND", "Attachment was not found."));
        return;
      }

      const content = await readFile(attachment.storagePath);
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(attachment.originalFilename)}"`);
      res.status(200).send(content);
    } catch {
      res.status(500).json(errorResponse("DOWNLOAD_ATTACHMENT_ERROR", "Unable to download Attachment."));
    }
  },
);

app.delete(
  "/api/requesters/:requesterId/tickets/:ticketId/attachments/:attachmentId",
  requireNormalAccess,
  requireRequesterRole,
  requireApprovedOrigin,
  requireCsrf,
  async (req: Request, res: Response) => {
    const requesterId = toPositiveInteger(req.params.requesterId);
    const ticketId = toPositiveInteger(req.params.ticketId);
    const attachmentId = toPositiveInteger(req.params.attachmentId);
    if (!requesterId || !ticketId || !attachmentId) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Requester, Ticket, and Attachment IDs must be positive integers."));
      return;
    }
    if (requesterId !== req.auth!.user.id) {
      res.status(404).json(errorResponse("NOT_FOUND", "Attachment was not found."));
      return;
    }

    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      res.status(400).json(errorResponse(
        "VALIDATION_ERROR",
        "Removal reason is required.",
        { reason: "Removal reason is required." },
      ));
      return;
    }

    try {
      const prisma = getPrisma();
      const attachment = await prisma.attachment.findFirst({
        where: { id: attachmentId, ticketId, ticket: { requesterId } },
      });
      if (!attachment) {
        res.status(404).json(errorResponse("NOT_FOUND", "Attachment was not found."));
        return;
      }
      if (attachment.removedAt) {
        res.status(409).json(errorResponse("ATTACHMENT_REMOVED", "Attachment has already been removed."));
        return;
      }

      const removed = await prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          removedAt: new Date(),
          removedByUserId: requesterId,
          removalReason: reason,
        },
      });
      res.status(200).json(attachmentMetadata(removed));
    } catch {
      res.status(500).json(errorResponse("REMOVE_ATTACHMENT_ERROR", "Unable to remove Attachment."));
    }
  },
);

export default app;
