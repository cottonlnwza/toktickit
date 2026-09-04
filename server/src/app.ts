import express, { Request, Response } from "express";
import cors from "cors";
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
  if (!description) errors.push({ field: "description", message: "Description is required." });
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
    res.status(500).json({ error: "Unable to load Related Systems." });
  }
});

app.post("/api/tickets", async (req: Request, res: Response) => {
  const validation = validateCreateTicketInput(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: "Ticket validation failed.", fields: validation.errors });
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
      res.status(400).json({ error: "Ticket validation failed.", fields: referenceErrors });
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
    res.status(500).json({ error: "Unable to create Ticket." });
  }
});

app.post("/api/tickets/:ticketId/attachments", async (req: Request, res: Response) => {
  const ticketId = toPositiveInteger(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json({ error: "Ticket is required." });
    return;
  }

  try {
    const { fields, file } = await parseMultipartRequest(req);
    const requesterId = toPositiveInteger(fields.requesterId);

    if (!requesterId) {
      res.status(400).json({ error: "Requester is required." });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "Attachment file is required." });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }

    const activeAttachmentCount = await prisma.attachment.count({ where: { ticketId, removedAt: null } });
    const attachmentValidation = validateAttachmentCandidate(
      { filename: file.filename, sizeBytes: file.sizeBytes },
      activeAttachmentCount,
    );

    if (!attachmentValidation.valid) {
      res.status(attachmentValidation.error === "Attachment must be 5 MB or smaller." ? 413 : 400).json({
        error: attachmentValidation.error,
      });
      return;
    }

    const storedFilename = `${Date.now()}-${Math.random().toString(16).slice(2)}-${sanitizeFilename(file.filename)}`;
    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        originalFilename: file.filename,
        storedFilename,
        mimeType: file.contentType,
        sizeBytes: file.sizeBytes,
        storagePath: `server/uploads/lab-02/${storedFilename}`,
      },
    });

    res.status(201).json(attachment);
  } catch {
    res.status(500).json({ error: "Unable to upload Attachment." });
  }
});

export default app;
