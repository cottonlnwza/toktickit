import { useEffect, useState } from "react";
import {
  checkSystem,
  Category,
  createTicket,
  CreatedTicket,
  getCategories,
  getMyTickets,
  getRelatedSystems,
  MyTicketsQuery,
  MyTicketsResponse,
  RelatedSystem,
  uploadTicketAttachment,
} from "./api.js";
import { useRequesterContext } from "./requesterContext.js";
import "./App.css";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type AttachmentItem = { file: File; status: "pending" | "uploaded" | "failed" | "invalid"; message?: string };
type AppView = "createTicket" | "myTickets";

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
  const [referenceState, setReferenceState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);
  const [activeView, setActiveView] = useState<AppView>("createTicket");
  const [myTicketsState, setMyTicketsState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [myTickets, setMyTickets] = useState<MyTicketsResponse | null>(null);
  const [myTicketsError, setMyTicketsError] = useState("");
  const [ticketDetailNotice, setTicketDetailNotice] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState("");
  const [ticketSystemFilter, setTicketSystemFilter] = useState("");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("");
  const [ticketSortBy, setTicketSortBy] = useState<MyTicketsQuery["sortBy"]>("updatedAt");
  const [ticketSortDirection, setTicketSortDirection] = useState<MyTicketsQuery["sortDirection"]>("desc");
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketPageSize, setTicketPageSize] = useState<5 | 10 | 20>(10);
  const [myTicketsReload, setMyTicketsReload] = useState(0);
  const formDisabled = referenceState === "loading";

  useEffect(() => {
    if (requesterContext.selectedRequester && referenceState === "idle") {
      void loadTicketReferences();
    }
  }, [requesterContext.selectedRequester, referenceState]);

  useEffect(() => {
    const requester = requesterContext.selectedRequester;
    if (!requester || activeView !== "myTickets") return;

    let current = true;
    setMyTicketsState("loading");
    setMyTicketsError("");
    const query: MyTicketsQuery = {
      search: ticketSearch,
      categoryId: ticketCategoryFilter ? Number(ticketCategoryFilter) : undefined,
      relatedSystemId: ticketSystemFilter ? Number(ticketSystemFilter) : undefined,
      requestedPriority: ticketPriorityFilter ? ticketPriorityFilter as Priority : undefined,
      currentStatus: ticketStatusFilter === "NEW" ? "NEW" : undefined,
      sortBy: ticketSortBy,
      sortDirection: ticketSortDirection,
      page: ticketPage,
      pageSize: ticketPageSize,
    };

    void getMyTickets(requester.id, query)
      .then((result) => {
        if (!current) return;
        setMyTickets(result);
        setMyTicketsState("success");
      })
      .catch(() => {
        if (!current) return;
        setMyTickets(null);
        setMyTicketsError("Unable to load My Tickets. Please try again.");
        setMyTicketsState("error");
      });

    return () => {
      current = false;
    };
  }, [
    activeView,
    requesterContext.selectedRequester,
    ticketSearch,
    ticketCategoryFilter,
    ticketSystemFilter,
    ticketPriorityFilter,
    ticketStatusFilter,
    ticketSortBy,
    ticketSortDirection,
    ticketPage,
    ticketPageSize,
    myTicketsReload,
  ]);

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
      setActiveView("createTicket");
      void loadTicketReferences();
    } else {
      setSelectionError("Please select a Development Requester.");
    }
  }

  async function loadTicketReferences() {
    setReferenceState("loading");
    setTicketError("");
    try {
      const [loadedCategories, loadedRelatedSystems] = await Promise.all([getCategories(), getRelatedSystems()]);
      setTicketCategories(loadedCategories);
      setRelatedSystems(loadedRelatedSystems);
      setReferenceState("ready");
    } catch {
      setTicketCategories([]);
      setRelatedSystems([]);
      setReferenceState("error");
      setTicketError("Unable to load Create Ticket reference data.");
    }
  }

  function validateAttachments(files: File[]) {
    const activeSelections = attachments.filter((item) => item.status !== "invalid").length;
    if (activeSelections + files.length > 5) {
      setFieldErrors((current) => ({
        ...current,
        attachments: "A Ticket may have at most five active attachments.",
      }));
      return [];
    }

    setFieldErrors((current) => {
      const { attachments: _attachments, ...rest } = current;
      return rest;
    });

    return files.map((file) => {
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
    const trimmedSummary = summary.trim();
    const trimmedDescription = description.trim();
    if (!trimmedSummary) nextErrors.summary = "Summary is required.";
    else if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
      nextErrors.summary = "Summary must be 5-120 characters.";
    }
    if (!trimmedDescription) nextErrors.description = "Description is required.";
    else if (trimmedDescription.length < 20 || trimmedDescription.length > 2000) {
      nextErrors.description = "Description must be 20-2000 characters.";
    }
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
        summary: summary.trim(),
        description: description.trim(),
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

  function resetCreateTicketForm() {
    setCategoryId("");
    setRelatedSystemId("");
    setSummary("");
    setDescription("");
    setRequestedPriority("MEDIUM");
    setAttachments([]);
    setFieldErrors({});
    setTicketState("idle");
    setTicketError("");
    setCreatedTicket(null);
  }

  function resetMyTickets() {
    setMyTicketsState("idle");
    setMyTickets(null);
    setMyTicketsError("");
    setTicketDetailNotice("");
    setTicketSearch("");
    setTicketCategoryFilter("");
    setTicketSystemFilter("");
    setTicketPriorityFilter("");
    setTicketStatusFilter("");
    setTicketSortBy("updatedAt");
    setTicketSortDirection("desc");
    setTicketPage(1);
    setTicketPageSize(10);
  }

  function clearMyTicketsFilters() {
    setTicketSearch("");
    setTicketCategoryFilter("");
    setTicketSystemFilter("");
    setTicketPriorityFilter("");
    setTicketStatusFilter("");
    setTicketPage(1);
  }

  function handleOpenTicket(ticketId: number, ticketNumber: string) {
    setTicketDetailNotice(`Ticket ${ticketNumber} selected (ID ${ticketId}). Ticket Detail will be available in the next workflow.`);
  }

  function handleChangeRequester() {
    resetCreateTicketForm();
    resetMyTickets();
    setActiveView("createTicket");
    requesterContext.changeRequester();
  }

  const selectedRequester = requesterContext.selectedRequester;
  const showSelector = !selectedRequester;
  const hasMyTicketsQuery = Boolean(
    ticketSearch || ticketCategoryFilter || ticketSystemFilter || ticketPriorityFilter || ticketStatusFilter,
  );

  return (
    <div className="toktickit-app">
      <header className="app-shell">
        <div>
          <h1>TokTickIT IT Service Desk</h1>
          <nav aria-label="Primary navigation">
            <a
              href="#my-tickets"
              aria-current={activeView === "myTickets" ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setActiveView("myTickets");
              }}
            >
              My Tickets
            </a>
            <a
              href="#create-ticket"
              aria-current={activeView === "createTicket" ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setActiveView("createTicket");
              }}
            >
              Create Ticket
            </a>
          </nav>
        </div>
        <div className="requester-display">
          {selectedRequester ? (
            <>
              <span>Requester: {selectedRequester.name}</span>
              <button className="btn btn-outline-light btn-sm" onClick={handleChangeRequester}>
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
        ) : activeView === "myTickets" ? (
          <section className="my-tickets-panel" aria-labelledby="my-tickets-heading">
            <div className="my-tickets-heading">
              <div>
                <h2 id="my-tickets-heading">My Tickets</h2>
                <p>Tickets owned by {selectedRequester.name}.</p>
              </div>
              <button className="btn btn-success" type="button" onClick={() => setActiveView("createTicket")}>
                Create Ticket
              </button>
            </div>

            <div className="my-tickets-controls">
              <div className="search-control">
                <label className="form-label" htmlFor="ticket-search">Search Tickets</label>
                <input
                  id="ticket-search"
                  className="form-control"
                  type="search"
                  value={ticketSearch}
                  onChange={(event) => {
                    setTicketSearch(event.target.value);
                    setTicketPage(1);
                  }}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="ticket-category-filter">Category filter</label>
                <select id="ticket-category-filter" className="form-select" value={ticketCategoryFilter} onChange={(event) => { setTicketCategoryFilter(event.target.value); setTicketPage(1); }}>
                  <option value="">All categories</option>
                  {ticketCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="ticket-system-filter">Related System filter</label>
                <select id="ticket-system-filter" className="form-select" value={ticketSystemFilter} onChange={(event) => { setTicketSystemFilter(event.target.value); setTicketPage(1); }}>
                  <option value="">All systems</option>
                  {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="ticket-priority-filter">Priority filter</label>
                <select id="ticket-priority-filter" className="form-select" value={ticketPriorityFilter} onChange={(event) => { setTicketPriorityFilter(event.target.value); setTicketPage(1); }}>
                  <option value="">All priorities</option>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option><option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="ticket-status-filter">Status filter</label>
                <select id="ticket-status-filter" className="form-select" value={ticketStatusFilter} onChange={(event) => { setTicketStatusFilter(event.target.value); setTicketPage(1); }}>
                  <option value="">All statuses</option><option value="NEW">New</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="ticket-sort">Sort by</label>
                <select id="ticket-sort" className="form-select" value={ticketSortBy} onChange={(event) => { setTicketSortBy(event.target.value as MyTicketsQuery["sortBy"]); setTicketPage(1); }}>
                  <option value="updatedAt">Last updated</option><option value="createdAt">Created date</option>
                  <option value="requestedPriority">Priority</option><option value="ticketNumber">Ticket Number</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="ticket-sort-direction">Sort direction</label>
                <select id="ticket-sort-direction" className="form-select" value={ticketSortDirection} onChange={(event) => { setTicketSortDirection(event.target.value as MyTicketsQuery["sortDirection"]); setTicketPage(1); }}>
                  <option value="desc">Descending</option><option value="asc">Ascending</option>
                </select>
              </div>
              <button className="btn btn-outline-secondary align-self-end" type="button" onClick={clearMyTicketsFilters}>
                Clear filters
              </button>
            </div>

            {myTicketsState === "loading" && <div className="alert alert-info" role="status">Loading My Tickets...</div>}
            {myTicketsState === "error" && (
              <div className="alert alert-danger" role="alert">
                <span>{myTicketsError}</span>{" "}
                <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setMyTicketsReload((value) => value + 1)}>Retry</button>
              </div>
            )}
            {ticketDetailNotice && <div className="alert alert-info" role="status">{ticketDetailNotice}</div>}
            {myTicketsState === "success" && myTickets?.items.length === 0 && (
              <div className="empty-state" role="status">
                {hasMyTicketsQuery ? "No Tickets match your search or filters." : "You do not have any Tickets yet."}
              </div>
            )}
            {myTicketsState === "success" && myTickets && myTickets.items.length > 0 && (
              <>
                <div className="my-tickets-table-wrap">
                  <table className="table my-tickets-table">
                    <thead><tr><th>Ticket Number</th><th>Summary</th><th>Category</th><th>Related System</th><th>Priority</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead>
                    <tbody>{myTickets.items.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>{ticket.ticketNumber}</td><td>{ticket.summary}</td><td>{ticket.category.name}</td>
                        <td>{ticket.relatedSystem.name}</td><td><span className="ticket-badge">{ticket.requestedPriority}</span></td>
                        <td><span className="ticket-badge status">{ticket.currentStatusLabel}</span></td>
                        <td>{ticket.updatedAt.slice(0, 10)}</td>
                        <td><button className="btn btn-sm btn-outline-success" type="button" aria-label={`Open Ticket ${ticket.ticketNumber}`} onClick={() => handleOpenTicket(ticket.id, ticket.ticketNumber)}>Open</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="my-ticket-cards">
                  {myTickets.items.map((ticket) => (
                    <article key={ticket.id} className="my-ticket-card">
                      <strong>{ticket.ticketNumber}</strong><h3>{ticket.summary}</h3>
                      <dl><dt>Category</dt><dd>{ticket.category.name}</dd><dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd><dt>Priority</dt><dd>{ticket.requestedPriority}</dd><dt>Status</dt><dd>{ticket.currentStatusLabel}</dd><dt>Last Updated</dt><dd>{ticket.updatedAt.slice(0, 10)}</dd></dl>
                      <button className="btn btn-sm btn-outline-success open-ticket-action" type="button" aria-label={`Open Ticket ${ticket.ticketNumber}`} onClick={() => handleOpenTicket(ticket.id, ticket.ticketNumber)}>Open</button>
                    </article>
                  ))}
                </div>
              </>
            )}

            <div className="my-tickets-pagination">
              <button className="btn btn-outline-success" type="button" disabled={ticketPage <= 1 || myTicketsState === "loading"} onClick={() => setTicketPage((page) => page - 1)}>Previous page</button>
              <span>Page {myTickets?.page ?? ticketPage} of {myTickets?.totalPages ?? 0}</span>
              <label htmlFor="ticket-page-size">Page size</label>
              <select id="ticket-page-size" className="form-select" value={ticketPageSize} onChange={(event) => { setTicketPageSize(Number(event.target.value) as 5 | 10 | 20); setTicketPage(1); }}>
                <option value="5">5</option><option value="10">10</option><option value="20">20</option>
              </select>
              <button className="btn btn-outline-success" type="button" disabled={!myTickets || ticketPage >= myTickets.totalPages || myTicketsState === "loading"} onClick={() => setTicketPage((page) => page + 1)}>Next page</button>
            </div>
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

            {referenceState === "loading" && (
              <div className="alert alert-info" role="status">
                Loading Create Ticket reference data...
              </div>
            )}

            {referenceState === "error" && (
              <div className="alert alert-danger" role="alert">
                {ticketError}
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

            <div className="ticket-grid readonly-grid">
              <div className="readonly-field compact">
                <span className="form-label">Ticket Number</span>
                <strong>{createdTicket?.ticketNumber ?? "Generated after submit"}</strong>
              </div>
              <div className="readonly-field compact">
                <span className="form-label">Ticket Date</span>
                <strong>{createdTicket ? createdTicket.createdAt.slice(0, 10) : "Generated after submit"}</strong>
              </div>
              <div className="readonly-field compact">
                <span className="form-label">Current Status</span>
                <strong>{createdTicket?.currentStatusLabel ?? "New after submit"}</strong>
              </div>
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
                  disabled={formDisabled}
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
                  disabled={formDisabled}
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
                  disabled={formDisabled}
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
              disabled={formDisabled}
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
              disabled={formDisabled}
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
              disabled={formDisabled}
              onChange={(event) => handleAttachmentSelection(event.target.files)}
            />
            <p className="attachment-help">JPG, JPEG, PNG, WEBP, and PDF only. Max 5 MB each. Max five files.</p>
            {fieldErrors.attachments && <div className="invalid-feedback d-block">{fieldErrors.attachments}</div>}

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
              <button className="btn btn-outline-secondary" type="button" disabled={formDisabled} onClick={resetCreateTicketForm}>
                Cancel
              </button>
              <button
                className="btn btn-success"
                disabled={ticketState === "submitting" || referenceState !== "ready"}
                onClick={handleSubmitTicket}
              >
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
