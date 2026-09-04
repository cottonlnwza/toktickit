import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getPrisma } from "./prisma.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
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

interface MultipartFile {
  filename: string;
  contentType: string;
  sizeBytes: number;
  content: Buffer;
}

function errorResponse(code: string, message: string, fields?: Record<string, string>) {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
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

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add:  GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
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

app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json(requesters);
  } catch {
    res.status(500).json({ error: "Unable to load Development Requesters." });
  }
});

app.get("/api/related-systems", async (_req: Request, res: Response) => {
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

app.post("/api/tickets", async (req: Request, res: Response) => {
  const validation = validateCreateTicketInput(req.body);
  if (!validation.valid) {
    const fields = Object.fromEntries(validation.errors.map((error) => [error.field, error.message]));
    res.status(400).json(errorResponse("VALIDATION_ERROR", "Please correct the highlighted fields.", fields));
    return;
  }

  const prisma = getPrisma();

  try {
    const [requester, category, relatedSystem] = await Promise.all([
      prisma.requesterUser.findFirst({ where: { id: validation.data.requesterId, isActive: true } }),
      prisma.category.findFirst({ where: { id: validation.data.categoryId, isActive: true } }),
      prisma.relatedSystem.findFirst({ where: { id: validation.data.relatedSystemId, isActive: true } }),
    ]);

    const referenceErrors: ValidationError[] = [];
    if (!requester) referenceErrors.push({ field: "requesterId", message: "Requester is not available." });
    if (!category) referenceErrors.push({ field: "categoryId", message: "Category is not available." });
    if (!relatedSystem) referenceErrors.push({ field: "relatedSystemId", message: "Related System is not available." });

    if (referenceErrors.length > 0) {
      const fields = Object.fromEntries(referenceErrors.map((error) => [error.field, error.message]));
      res.status(404).json(errorResponse("REFERENCE_NOT_FOUND", "Selected requester, category, or related system is not available.", fields));
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
        requesterId: validation.data.requesterId,
        categoryId: validation.data.categoryId,
        relatedSystemId: validation.data.relatedSystemId,
        summary: validation.data.summary,
        description: validation.data.description,
        requestedPriority: validation.data.requestedPriority,
        currentStatus: "NEW",
      },
    });

    res.status(201).json({ ...ticket, currentStatusLabel: "New" });
  } catch {
    res.status(500).json(errorResponse("CREATE_TICKET_ERROR", "Unable to create Ticket."));
  }
});

app.post("/api/requesters/:requesterId/tickets/:ticketId/attachments", async (req: Request, res: Response) => {
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

    res.status(201).json(attachment);
  } catch {
    res.status(500).json(errorResponse("UPLOAD_ATTACHMENT_ERROR", "Unable to upload Attachment."));
  }
});

export default app;
