import { useState } from "react";
import {
  checkSystem,
  Category,
  createTicket,
  CreatedTicket,
  getCategories,
  getRelatedSystems,
  RelatedSystem,
  uploadTicketAttachment,
} from "./api.js";
import { useRequesterContext } from "./requesterContext.js";
import "./App.css";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type AttachmentItem = { file: File; status: "pending" | "uploaded" | "failed" | "invalid"; message?: string };

const allowedAttachmentExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const maxAttachmentSizeBytes = 5 * 1024 * 1024;

export default function App() {
  const requesterContext = useRequesterContext();
  const [pendingRequesterId, setPendingRequesterId] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [ticketCategories, setTicketCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [requestedPriority, setRequestedPriority] = useState<Priority>("MEDIUM");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ticketState, setTicketState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [ticketError, setTicketError] = useState("");
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch (error) {
      setCategories([]);
      setErrorMessage(error instanceof Error ? error.message : "Backend health check failed.");
      setState("error");
    }
  }

  function handleContinue() {
    const requester = requesterContext.selectRequester(pendingRequesterId);
    if (requester) {
      setSelectionError("");
      void loadTicketReferences();
    } else {
      setSelectionError("Please select a Development Requester.");
    }
  }

  async function loadTicketReferences() {
    try {
      const [loadedCategories, loadedRelatedSystems] = await Promise.all([getCategories(), getRelatedSystems()]);
      setTicketCategories(loadedCategories);
      setRelatedSystems(loadedRelatedSystems);
    } catch {
      setTicketError("Unable to load Create Ticket reference data.");
    }
  }

  function validateAttachments(files: File[]) {
    const remainingSlots = Math.max(0, 5 - attachments.filter((item) => item.status !== "invalid").length);
    return files.slice(0, remainingSlots).map((file) => {
      const filename = file.name.toLowerCase();
      const allowedType = allowedAttachmentExtensions.some((extension) => filename.endsWith(extension));
      if (!allowedType) {
        return { file, status: "invalid" as const, message: "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed." };
      }
      if (file.size > maxAttachmentSizeBytes) {
        return { file, status: "invalid" as const, message: "Attachment must be 5 MB or smaller." };
      }
      return { file, status: "pending" as const };
    });
  }

  function handleAttachmentSelection(files: FileList | null) {
    if (!files) return;
    setAttachments((current) => [...current, ...validateAttachments(Array.from(files))]);
  }

  function validateTicketForm() {
    const nextErrors: Record<string, string> = {};
    if (!categoryId) nextErrors.categoryId = "Category is required.";
    if (!relatedSystemId) nextErrors.relatedSystemId = "Related System is required.";
    if (!summary.trim()) nextErrors.summary = "Summary is required.";
    if (!description.trim()) nextErrors.description = "Description is required.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function uploadPendingAttachments(ticketId: number, requesterId: number) {
    const nextAttachments: AttachmentItem[] = [];
    let failed = false;

    for (const item of attachments) {
      if (item.status === "invalid") {
        nextAttachments.push(item);
        continue;
      }

      try {
        await uploadTicketAttachment(ticketId, requesterId, item.file);
        nextAttachments.push({ ...item, status: "uploaded", message: "Uploaded" });
      } catch (error) {
        failed = true;
        nextAttachments.push({
          ...item,
          status: "failed",
          message: error instanceof Error ? error.message : "Unable to upload Attachment.",
        });
      }
    }

    setAttachments(nextAttachments);
    return failed;
  }

  async function handleSubmitTicket() {
    if (!requesterContext.selectedRequester || !validateTicketForm()) return;

    setTicketState("submitting");
    setTicketError("");

    try {
      const ticket = await createTicket({
        requesterId: requesterContext.selectedRequester.id,
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary,
        description,
        requestedPriority,
      });
      setCreatedTicket(ticket);
      const hadAttachmentFailure = await uploadPendingAttachments(ticket.id, requesterContext.selectedRequester.id);
      setTicketError(hadAttachmentFailure ? "Some attachments could not be uploaded. Use Retry or Remove for failed files." : "");
      setTicketState("success");
    } catch (error) {
      setTicketError(error instanceof Error ? error.message : "Unable to create ticket. Please try again.");
      setTicketState("error");
    }
  }

  async function handleRetryAttachment(index: number) {
    if (!createdTicket || !requesterContext.selectedRequester) return;
    const item = attachments[index];
    if (!item) return;

    try {
      await uploadTicketAttachment(createdTicket.id, requesterContext.selectedRequester.id, item.file);
      setAttachments((current) =>
        current.map((attachment, currentIndex) =>
          currentIndex === index ? { ...attachment, status: "uploaded", message: "Uploaded" } : attachment,
        ),
      );
    } catch (error) {
      setAttachments((current) =>
        current.map((attachment, currentIndex) =>
          currentIndex === index
            ? { ...attachment, status: "failed", message: error instanceof Error ? error.message : "Unable to upload Attachment." }
            : attachment,
        ),
      );
    }
  }

  function handleRemoveAttachment(index: number) {
    setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  const selectedRequester = requesterContext.selectedRequester;
  const showSelector = !selectedRequester;

  return (
    <div className="toktickit-app">
      <header className="app-shell">
        <div>
          <h1>TokTickIT IT Service Desk</h1>
          <nav aria-label="Primary navigation">
            <a href="#my-tickets">My Tickets</a>
            <a href="#create-ticket">Create Ticket</a>
          </nav>
        </div>
        <div className="requester-display">
          {selectedRequester ? (
            <>
              <span>Requester: {selectedRequester.name}</span>
              <button className="btn btn-outline-light btn-sm" onClick={requesterContext.changeRequester}>
                Change Requester
              </button>
            </>
          ) : (
            <span>No requester set</span>
          )}
        </div>
      </header>

      <main className="container py-5">
        {showSelector ? (
          <section className="requester-panel" aria-labelledby="requester-heading">
            <h2 id="requester-heading">Select Development Requester</h2>
            <p>
              This selector is for Lab 2 testing only. It is not a login screen. Authentication and
              role-based access will be introduced in Lab 3.
            </p>

            {requesterContext.state === "loading" && (
              <div className="alert alert-info" role="status">
                Loading active requesters...
              </div>
            )}

            {requesterContext.state === "empty" && (
              <div className="alert alert-warning" role="status">
                No active Development Requesters are available.
              </div>
            )}

            {requesterContext.state === "error" && (
              <div className="alert alert-danger" role="alert">
                Unable to load Development Requesters.
                {requesterContext.errorMessage && <span> {requesterContext.errorMessage}</span>}
              </div>
            )}

            <label className="form-label" htmlFor="requester-select">
              Development Requester <span className="required-marker">*</span>
            </label>
            <select
              id="requester-select"
              className={`form-select ${selectionError ? "is-invalid" : ""}`}
              value={pendingRequesterId}
              disabled={requesterContext.state !== "ready"}
              onChange={(event) => {
                setPendingRequesterId(event.target.value);
                setSelectionError("");
              }}
            >
              <option value="">Select an active requester...</option>
              {requesterContext.requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name} ({requester.email})
                </option>
              ))}
            </select>
            {selectionError && <div className="invalid-feedback d-block">{selectionError}</div>}

            <button
              className="btn btn-success mt-4"
              disabled={requesterContext.state !== "ready" || !pendingRequesterId}
              onClick={handleContinue}
            >
              Continue
            </button>
          </section>
        ) : (
          <section className="ticket-panel" aria-labelledby="create-ticket-heading">
            <h2 id="create-ticket-heading">Create Ticket</h2>
            <p>
              Attachments use a two-step workflow: create the Ticket first, then upload files to the saved Ticket.
            </p>

            {ticketState === "error" && (
              <div className="alert alert-danger" role="alert">
                Unable to create ticket. {ticketError}
              </div>
            )}

            {ticketState === "success" && createdTicket && (
              <div className="alert alert-success" role="status">
                Ticket created successfully. Official Ticket Number: {createdTicket.ticketNumber}. Current Status:{" "}
                {createdTicket.currentStatusLabel}
              </div>
            )}

            {ticketState === "success" && ticketError && (
              <div className="alert alert-warning" role="status">
                {ticketError}
              </div>
            )}

            <div className="readonly-field">
              <span className="form-label">Requester</span>
              <strong>
                {selectedRequester?.name} ({selectedRequester?.email})
              </strong>
            </div>

            <div className="ticket-grid">
              <div>
                <label className="form-label" htmlFor="ticket-category">
                  Category <span className="required-marker">*</span>
                </label>
                <select
                  id="ticket-category"
                  className={`form-select ${fieldErrors.categoryId ? "is-invalid" : ""}`}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Select category...</option>
                  {ticketCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoryId && <div className="invalid-feedback d-block">{fieldErrors.categoryId}</div>}
              </div>

              <div>
                <label className="form-label" htmlFor="ticket-related-system">
                  Related System <span className="required-marker">*</span>
                </label>
                <select
                  id="ticket-related-system"
                  className={`form-select ${fieldErrors.relatedSystemId ? "is-invalid" : ""}`}
                  value={relatedSystemId}
                  onChange={(event) => setRelatedSystemId(event.target.value)}
                >
                  <option value="">Select related system...</option>
                  {relatedSystems.map((relatedSystem) => (
                    <option key={relatedSystem.id} value={relatedSystem.id}>
                      {relatedSystem.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.relatedSystemId && (
                  <div className="invalid-feedback d-block">{fieldErrors.relatedSystemId}</div>
                )}
              </div>

              <div>
                <label className="form-label" htmlFor="ticket-priority">
                  Requested Priority <span className="required-marker">*</span>
                </label>
                <select
                  id="ticket-priority"
                  className="form-select"
                  value={requestedPriority}
                  onChange={(event) => setRequestedPriority(event.target.value as Priority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <label className="form-label mt-3" htmlFor="ticket-summary">
              Ticket Summary <span className="required-marker">*</span>
            </label>
            <input
              id="ticket-summary"
              className={`form-control ${fieldErrors.summary ? "is-invalid" : ""}`}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
            {fieldErrors.summary && <div className="invalid-feedback d-block">{fieldErrors.summary}</div>}

            <label className="form-label mt-3" htmlFor="ticket-description">
              Description <span className="required-marker">*</span>
            </label>
            <textarea
              id="ticket-description"
              className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            {fieldErrors.description && <div className="invalid-feedback d-block">{fieldErrors.description}</div>}

            <label className="form-label mt-3" htmlFor="ticket-attachments">
              Attachments
            </label>
            <input
              id="ticket-attachments"
              className="form-control"
              type="file"
              multiple
              onChange={(event) => handleAttachmentSelection(event.target.files)}
            />
            <p className="attachment-help">JPG, JPEG, PNG, WEBP, and PDF only. Max 5 MB each. Max five files.</p>

            {attachments.length > 0 && (
              <ul className="attachment-list">
                {attachments.map((item, index) => (
                  <li key={`${item.file.name}-${index}`} className={`attachment-item ${item.status}`}>
                    <span>
                      {item.file.name} {item.message && <strong>{item.message}</strong>}
                    </span>
                    {item.status === "failed" && (
                      <span className="attachment-actions">
                        <button className="btn btn-sm btn-outline-success" onClick={() => void handleRetryAttachment(index)}>
                          Retry {item.file.name}
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveAttachment(index)}>
                          Remove {item.file.name}
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="ticket-actions">
              <button className="btn btn-outline-secondary" type="button">
                Cancel
              </button>
              <button className="btn btn-success" disabled={ticketState === "submitting"} onClick={handleSubmitTicket}>
                {ticketState === "submitting" ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </section>
        )}

        <section className="system-check-panel" aria-label="System check">
          <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
            {state === "loading" ? "Loading…" : "Check System"}
          </button>

          {state === "loading" && (
            <div className="alert alert-info mt-4" role="status">
              Checking backend health…
            </div>
          )}

          {state === "success" && (
            <div className="alert alert-success mt-4" role="status">
              <p className="mb-2">Online: backend health check passed.</p>
              <ul className="mb-0">
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ul>
            </div>
          )}

          {state === "error" && (
            <div className="alert alert-danger mt-4" role="alert">
              Offline: {errorMessage}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
