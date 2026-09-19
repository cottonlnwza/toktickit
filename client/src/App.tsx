import { useEffect, useState, type FormEvent } from "react";
import {
  AuthApiError,
  AuthUser,
  addAuthenticatedTicketAttachment,
  changePassword as changeOwnPassword,
  claimStaffTicket,
  checkSystem,
  Category,
  createAuthenticatedTicket,
  createTicket,
  CreatedTicket,
  getAuthenticatedMyTickets,
  getAuthenticatedTicketDetail,
  getCurrentUser,
  getCategories,
  getMyTickets,
  getPublicComments,
  getRelatedSystems,
  getStaffTicketQueue,
  getStaffTicketDetail,
  getTicketDetail,
  login as loginUser,
  logout as logoutUser,
  markProblemAppearsResolved,
  MyTicketsQuery,
  MyTicketsResponse,
  postPublicComment,
  postInternalNote,
  PublicComment,
  Requester,
  removeAuthenticatedTicketAttachment,
  removeTicketAttachment,
  RelatedSystem,
  StaffQueueApiError,
  StaffQueueResponse,
  StaffQueueTicket,
  StaffTicketApiError,
  StaffTicketDetail,
  TicketAttachment,
  TicketDetail,
  TicketStatus,
  updateStaffTicketItPriority,
  updateStaffTicketOwner,
  updateStaffTicketStatus,
  addTicketAttachment,
  uploadTicketAttachment,
} from "./api.js";
import { useRequesterContext } from "./requesterContext.js";
import "./App.css";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type AttachmentItem = { file: File; status: "pending" | "uploaded" | "failed" | "invalid"; message?: string };
type AppView = "createTicket" | "myTickets" | "ticketDetail";

const allowedAttachmentExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const maxAttachmentSizeBytes = 5 * 1024 * 1024;

type AuthState = "loading" | "unauthenticated" | "authenticated";

function roleLabel(role: AuthUser["role"]) {
  if (role === "IT_STAFF") return "IT Staff";
  if (role === "ADMINISTRATOR") return "Administrator";
  return "Requester";
}

function safeLoginMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    if (error.code === "INVALID_CREDENTIALS") return "Invalid email or password.";
    if (error.code === "ACCOUNT_INACTIVE") return "This account is inactive. Contact an Administrator for access.";
    if (error.code === "LOGIN_THROTTLED") return "Too many login attempts. Please try again later.";
    if (error.status === 400) return "Enter a valid email and password.";
  }
  return "Unable to sign in. Please try again.";
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser, csrfToken: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!email.trim().includes("@")) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Password is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setMessage("");
    try {
      const response = await loginUser(email, password);
      onAuthenticated(response.user, response.csrfToken);
    } catch (error) {
      setMessage(safeLoginMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading">
        <div className="auth-brand">
          <h1 id="login-heading">TokTickIT</h1>
          <p>IT Service Desk</p>
        </div>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="mb-3">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input id="login-email" className={"form-control " + (errors.email ? "is-invalid" : "")} type="email" autoComplete="username" disabled={submitting} value={email} onChange={(event) => setEmail(event.target.value)} />
            {errors.email && <div className="invalid-feedback">{errors.email}</div>}
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input id="login-password" className={"form-control " + (errors.password ? "is-invalid" : "")} type="password" autoComplete="current-password" disabled={submitting} value={password} onChange={(event) => setPassword(event.target.value)} />
            {errors.password && <div className="invalid-feedback">{errors.password}</div>}
          </div>
          {message && <div className="alert alert-danger" role="alert">{message}</div>}
          <button className="btn btn-success w-100" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ChangePasswordScreen({
  csrfToken,
  forced,
  onChanged,
  onLogout,
  onCancel,
  logoutError,
}: {
  csrfToken: string;
  forced: boolean;
  onChanged: (user: AuthUser, csrfToken: string) => void;
  onLogout: () => Promise<void>;
  onCancel?: () => void;
  logoutError?: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.currentPassword = "Current password is required.";
    if (newPassword.length < 12 || newPassword.length > 128) nextErrors.newPassword = "New password must be 12-128 characters.";
    else if (newPassword.trim().length === 0) nextErrors.newPassword = "New password cannot be all whitespace.";
    else if (newPassword === currentPassword) nextErrors.newPassword = "New password must differ from the current password.";
    if (confirmPassword !== newPassword) nextErrors.confirmPassword = "Password confirmation must match the new password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setMessage("");
    try {
      const response = await changeOwnPassword(csrfToken, { currentPassword, newPassword, confirmPassword });
      onChanged(response.user, response.csrfToken);
    } catch (error) {
      if (error instanceof AuthApiError && Object.keys(error.fields).length > 0) setErrors(error.fields);
      setMessage(error instanceof AuthApiError ? error.message : "Unable to change password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="change-password-heading">
        <div className="auth-brand">
          <h1 id="change-password-heading">Change Password</h1>
          <p>{forced ? "You must change your initial password before continuing." : "Update your TokTickIT password."}</p>
        </div>
        <p className="auth-rule">Use 12-128 characters. The new password must differ from the current password and confirmation must match.</p>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="mb-3">
            <label className="form-label" htmlFor="current-password">Current / Initial Password</label>
            <input id="current-password" className={"form-control " + (errors.currentPassword ? "is-invalid" : "")} type="password" autoComplete="current-password" disabled={saving} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            {errors.currentPassword && <div className="invalid-feedback">{errors.currentPassword}</div>}
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="new-password">New Password</label>
            <input id="new-password" className={"form-control " + (errors.newPassword ? "is-invalid" : "")} type="password" autoComplete="new-password" disabled={saving} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            {errors.newPassword && <div className="invalid-feedback">{errors.newPassword}</div>}
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="confirm-password">Confirm New Password</label>
            <input id="confirm-password" className={"form-control " + (errors.confirmPassword ? "is-invalid" : "")} type="password" autoComplete="new-password" disabled={saving} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
          </div>
          {message && <div className="alert alert-danger" role="alert">{message}</div>}
          {logoutError && <div className="alert alert-danger" role="alert">{logoutError}</div>}
          <div className="auth-actions">
            {!forced && onCancel && <button className="btn btn-outline-secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button>}
            <button className="btn btn-success" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Password"}</button>
            <button className="btn btn-outline-danger" type="button" disabled={saving} onClick={() => void onLogout()}>Logout</button>
          </div>
        </form>
      </section>
    </main>
  );
}

function queueStatusLabel(status: TicketStatus) {
  return {
    NEW: "NEW",
    OPEN: "OPEN",
    IN_PROGRESS: "IN PROGRESS",
    WAITING_FOR_REQUESTER: "WAITING FOR REQUESTER",
    RESOLVED: "RESOLVED",
    CLOSED: "CLOSED",
    REOPENED: "REOPENED",
    CANCELLED: "CANCELLED",
  }[status];
}

function StaffTicketQueue() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | TicketStatus>("");
  const [requestedPriority, setRequestedPriority] = useState("");
  const [itPriority, setItPriority] = useState("");
  const [owner, setOwner] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [sortBy, setSortBy] = useState<"updatedAt" | "createdAt" | "ticketNumber" | "requestedPriority" | "itPriority" | "status">("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [queue, setQueue] = useState<StaffQueueResponse | null>(null);
  const [queueState, setQueueState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [retryToken, setRetryToken] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  useEffect(() => {
    let current = true;
    void Promise.all([getCategories(), getRelatedSystems()])
      .then(([nextCategories, nextSystems]) => {
        if (!current) return;
        setCategories(nextCategories);
        setRelatedSystems(nextSystems);
      })
      .catch(() => {
        if (!current) return;
        setCategories([]);
        setRelatedSystems([]);
      });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    setQueueState("loading");
    void getStaffTicketQueue({
      search: search.trim() || undefined,
      status: status || undefined,
      requestedPriority: requestedPriority ? requestedPriority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" : undefined,
      itPriority: itPriority ? itPriority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" : undefined,
      owner: owner === "unassigned" ? "unassigned" : owner ? Number(owner) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      relatedSystemId: relatedSystemId ? Number(relatedSystemId) : undefined,
      sortBy,
      sortOrder,
      page,
      pageSize,
    })
      .then((response) => {
        if (!current) return;
        setQueue(response);
        setQueueState("ready");
      })
      .catch((error) => {
        if (!current) return;
        setQueue(null);
        if (error instanceof StaffQueueApiError && error.status === 403) setQueueState("forbidden");
        else setQueueState("error");
      });
    return () => { current = false; };
  }, [search, status, requestedPriority, itPriority, owner, categoryId, relatedSystemId, sortBy, sortOrder, page, pageSize, retryToken]);

  function resetPageAnd(action: () => void) {
    setPage(1);
    action();
  }

  function clearFilters() {
    setPage(1);
    setSearch("");
    setStatus("");
    setRequestedPriority("");
    setItPriority("");
    setOwner("");
    setCategoryId("");
    setRelatedSystemId("");
  }

  const hasFilters = Boolean(search.trim() || status || requestedPriority || itPriority || owner || categoryId || relatedSystemId);
  function openTicket(ticket: StaffQueueTicket) {
    window.location.hash = `staff-ticket-${ticket.id}`;
  }

  function renderOpenAction(ticket: StaffQueueTicket) {
    return (
      <button className="btn btn-sm btn-outline-success" type="button" aria-label={`Open Ticket ${ticket.ticketNumber}`} onClick={() => openTicket(ticket)}>
        Open
      </button>
    );
  }

  return (
    <main className="container py-4 staff-queue-page">
      <section className="staff-queue-panel" aria-labelledby="staff-queue-heading">
        <div className="staff-queue-heading">
          <div>
            <h2 id="staff-queue-heading">Ticket Queue</h2>
            <p className="text-muted mb-0">Search and prioritize the shared IT Staff workload.</p>
          </div>
          {queue && <span className="queue-count" aria-label={`${queue.totalItems} total Tickets`}>{queue.totalItems} Tickets</span>}
        </div>

        <div className="staff-queue-controls" aria-label="Ticket Queue controls">
          <div className="queue-search-control">
            <label className="form-label" htmlFor="staff-queue-search">Search Tickets</label>
            <input id="staff-queue-search" className="form-control" value={search} onChange={(event) => resetPageAnd(() => setSearch(event.target.value))} placeholder="Ticket Number, Summary, Requester name/email" />
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-status">Status</label>
            <select id="staff-queue-status" className="form-select" value={status} onChange={(event) => resetPageAnd(() => setStatus(event.target.value as "" | TicketStatus))}>
              <option value="">All</option>
              <option value="NEW">New</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option><option value="WAITING_FOR_REQUESTER">Waiting for Requester</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option><option value="REOPENED">Reopened</option><option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-requested-priority">Requested Priority</label>
            <select id="staff-queue-requested-priority" className="form-select" value={requestedPriority} onChange={(event) => resetPageAnd(() => setRequestedPriority(event.target.value))}>
              <option value="">All</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-it-priority">IT Priority</label>
            <select id="staff-queue-it-priority" className="form-select" value={itPriority} onChange={(event) => resetPageAnd(() => setItPriority(event.target.value))}>
              <option value="">All</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-owner">Owner</label>
            <select id="staff-queue-owner" className="form-select" value={owner} onChange={(event) => resetPageAnd(() => setOwner(event.target.value))}>
              <option value="">All</option>
              <option value="unassigned">Unassigned</option>
              {(queue?.ownerOptions ?? []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-category">Category</label>
            <select id="staff-queue-category" className="form-select" value={categoryId} onChange={(event) => resetPageAnd(() => setCategoryId(event.target.value))}>
              <option value="">All</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-related-system">Related System</label>
            <select id="staff-queue-related-system" className="form-select" value={relatedSystemId} onChange={(event) => resetPageAnd(() => setRelatedSystemId(event.target.value))}>
              <option value="">All</option>
              {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-sort-by">Sort By</label>
            <select id="staff-queue-sort-by" className="form-select" value={sortBy} onChange={(event) => resetPageAnd(() => setSortBy(event.target.value as typeof sortBy))}>
              <option value="updatedAt">Last Updated</option><option value="createdAt">Created</option><option value="ticketNumber">Ticket Number</option><option value="requestedPriority">Requested Priority</option><option value="itPriority">IT Priority</option><option value="status">Status</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-sort-order">Sort Order</label>
            <select id="staff-queue-sort-order" className="form-select" value={sortOrder} onChange={(event) => resetPageAnd(() => setSortOrder(event.target.value as "asc" | "desc"))}>
              <option value="desc">Descending</option><option value="asc">Ascending</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-queue-page-size">Page Size</label>
            <select id="staff-queue-page-size" className="form-select" value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) as 10 | 25 | 50); }}>
              <option value="10">10</option><option value="25">25</option><option value="50">50</option>
            </select>
          </div>
          <div className="queue-clear-control">
            <button className="btn btn-outline-secondary" type="button" onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>

        {queueState === "loading" && <div className="queue-state" role="status">Loading Ticket Queue...</div>}
        {queueState === "forbidden" && <div className="alert alert-danger" role="alert">Forbidden. Your role is not permitted to use the IT Staff Ticket Queue.</div>}
        {queueState === "error" && (
          <div className="alert alert-danger queue-failure" role="alert">
            <span>Unable to load Ticket Queue. Please try again.</span>
            <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button>
          </div>
        )}

        {queueState === "ready" && queue && queue.items.length === 0 && (
          <div className="queue-state">
            {queue.totalItems === 0 && hasFilters ? (
              <><strong>No Tickets match the current filters.</strong><button className="btn btn-sm btn-outline-secondary" type="button" onClick={clearFilters}>Clear Filters</button></>
            ) : queue.totalItems === 0 ? (
              <strong>The Ticket Queue is empty. No Tickets are waiting for IT Staff.</strong>
            ) : (
              <strong>No Tickets are available on this page.</strong>
            )}
          </div>
        )}

        {queueState === "ready" && queue && queue.items.length > 0 && (
          <>
            <div className="staff-queue-desktop" data-testid="staff-queue-desktop">
              <div className="table-responsive">
                <table className="table align-middle staff-queue-table" aria-label="Ticket Queue">
                  <thead><tr><th>Ticket Number</th><th>Summary</th><th>Requested Priority</th><th>IT Priority</th><th>Status</th><th>Owner</th><th>Last Updated</th><th><span className="visually-hidden">Open</span></th></tr></thead>
                  <tbody>
                    {queue.items.map((ticket) => (
                      <tr key={ticket.id}>
                        <td><strong>{ticket.ticketNumber}</strong></td>
                        <td><div>{ticket.summary}</div><small>{ticket.requester.name}</small></td>
                        <td><span className="queue-badge">{ticket.requestedPriority}</span></td>
                        <td><span className="queue-badge">{ticket.itPriority}</span></td>
                        <td><span className="queue-badge">{queueStatusLabel(ticket.currentStatus)}</span></td>
                        <td>{ticket.owner?.name ?? "Unassigned"}</td>
                        <td>{new Date(ticket.updatedAt).toLocaleString()}</td>
                        <td>{renderOpenAction(ticket)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="staff-queue-mobile" data-testid="staff-queue-mobile">
              {queue.items.map((ticket) => (
                <article className="staff-queue-card" key={ticket.id} aria-label={`Ticket ${ticket.ticketNumber}`}>
                  <div className="staff-queue-card-heading"><strong>{ticket.ticketNumber}</strong><span className="queue-badge">{queueStatusLabel(ticket.currentStatus)}</span></div>
                  <h3>{ticket.summary}</h3>
                  <p className="mb-2">Requester: {ticket.requester.name}</p>
                  <dl><dt>Requested Priority</dt><dd>{ticket.requestedPriority}</dd><dt>IT Priority</dt><dd>{ticket.itPriority}</dd><dt>Owner</dt><dd>{ticket.owner?.name ?? "Unassigned"}</dd><dt>Updated</dt><dd>{new Date(ticket.updatedAt).toLocaleString()}</dd></dl>
                  {renderOpenAction(ticket)}
                </article>
              ))}
            </div>
          </>
        )}

        {queueState === "ready" && queue && queue.totalItems > 0 && (
          <div className="staff-queue-pagination" aria-label="Ticket Queue pagination">
            <button className="btn btn-outline-secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <span>Page {queue.page} of {Math.max(queue.totalPages, 1)}</span>
            <button className="btn btn-outline-secondary" type="button" disabled={queue.totalPages === 0 || page >= queue.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </section>
    </main>
  );
}

const staffStatusTransitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};

function StaffTicketDetailView({ ticketId, user, csrfToken }: { ticketId: number; user: AuthUser; csrfToken: string }) {
  const [detail, setDetail] = useState<StaffTicketDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusTarget, setStatusTarget] = useState("");
  const [publicContent, setPublicContent] = useState("");
  const [internalContent, setInternalContent] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const staffMode = user.role === "IT_STAFF";

  useEffect(() => {
    let current = true;
    setState("loading");
    setError("");
    void getStaffTicketDetail(ticketId)
      .then((response) => {
        if (!current) return;
        setDetail(response);
        setState("ready");
        setStatusTarget("");
      })
      .catch((caught) => {
        if (!current) return;
        setState("error");
        if (caught instanceof StaffTicketApiError && caught.status === 403) setError("Forbidden. Your role is not permitted to view this Ticket Detail.");
        else if (caught instanceof StaffTicketApiError && caught.status === 404) setError("Ticket Detail was not found.");
        else setError("Unable to load Ticket Detail. Please try again.");
      });
    return () => { current = false; };
  }, [ticketId, retryToken]);

  async function runMutation(action: () => Promise<void>, success: string) {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (caught) {
      if (caught instanceof StaffTicketApiError && caught.status === 409) {
        setError("The Ticket changed before this action completed. Refresh the Ticket Detail and try again.");
      } else if (caught instanceof StaffTicketApiError && caught.status === 403) {
        setError("Forbidden. Your role is not permitted to perform this Ticket action.");
      } else {
        setError("Unable to save the Ticket change. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <main className="container py-4"><div className="queue-state" role="status">Loading Ticket Detail...</div></main>;
  if (state === "error" || !detail) return <main className="container py-4"><div className="alert alert-danger" role="alert">{error || "Unable to load Ticket Detail."}<button className="btn btn-sm btn-outline-danger ms-3" type="button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button></div></main>;

  const requiresConfirmation = (status: TicketStatus) => ["RESOLVED", "CLOSED", "CANCELLED", "REOPENED"].includes(status);
  const nextStatuses = staffStatusTransitions[detail.currentStatus];

  return (
    <main className="container py-4 staff-detail-page">
      <div className="staff-detail-topbar"><button className="btn btn-outline-secondary" type="button" onClick={() => { window.location.hash = staffMode ? "ticket-queue" : "user-management"; }}>{staffMode ? "Back to Queue" : "Back to User Management"}</button><span className="queue-badge">{detail.currentStatusLabel}</span></div>
      <section className="staff-detail-panel" aria-labelledby="staff-detail-heading">
        <div className="staff-detail-heading"><div><h2 id="staff-detail-heading">Ticket Detail</h2><strong>{detail.ticketNumber}</strong></div><div><span className="queue-badge">Requested {detail.requestedPriority}</span> <span className="queue-badge">IT {detail.itPriority}</span></div></div>
        {message && <div className="alert alert-success" role="status">{message}</div>}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="staff-detail-grid">
          <section className="staff-detail-section"><h3>Ticket Information</h3><dl><dt>Summary</dt><dd>{detail.summary}</dd><dt>Description</dt><dd>{detail.description}</dd><dt>Created</dt><dd>{new Date(detail.createdAt).toLocaleString()}</dd><dt>Last Updated</dt><dd>{new Date(detail.updatedAt).toLocaleString()}</dd></dl></section>
          <section className="staff-detail-section"><h3>Requester & Classification</h3><dl><dt>Requester</dt><dd>{detail.requester.name} ({detail.requester.email})</dd><dt>Category</dt><dd>{detail.category.name}</dd><dt>Related System</dt><dd>{detail.relatedSystem.name}</dd></dl></section>
        </div>

        <section className="staff-detail-section"><h3>Operations</h3><div className="staff-operation-grid">
          <div><label className="form-label" htmlFor="staff-requested-priority">Requested Priority</label><input id="staff-requested-priority" aria-label="Requested Priority" className="form-control readonly-control" value={detail.requestedPriority} disabled readOnly /></div>
          <div><label className="form-label" htmlFor="staff-it-priority">IT Priority</label><select id="staff-it-priority" aria-label="IT Priority" className="form-select" value={detail.itPriority} disabled={saving} onChange={(event) => void runMutation(async () => { const response = await updateStaffTicketItPriority(csrfToken, detail.id, event.target.value as Priority); setDetail((current) => current ? { ...current, itPriority: response.itPriority } : current); }, "IT Priority updated.")}><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option></select></div>
          {staffMode && <div><label className="form-label" htmlFor="staff-owner">Owner</label><select id="staff-owner" aria-label="Owner" className="form-select" value={detail.owner?.id ?? ""} disabled={saving} onChange={(event) => { const nextOwnerId = event.target.value ? Number(event.target.value) : null; if (detail.owner && nextOwnerId !== detail.owner.id && !window.confirm("Reassign this Ticket owner?")) return; void runMutation(async () => { const response = await updateStaffTicketOwner(csrfToken, detail.id, nextOwnerId); setDetail((current) => current ? { ...current, owner: response.owner } : current); }, "Owner updated."); }}><option value="">Unassigned</option>{detail.ownerOptions.map((option) => <option value={option.id} key={option.id}>{option.name} ({option.role === "IT_STAFF" ? "IT Staff" : "Administrator"})</option>)}</select>{!detail.owner && <button className="btn btn-sm btn-success mt-2" type="button" disabled={saving} onClick={() => void runMutation(async () => { const response = await claimStaffTicket(csrfToken, detail.id); setDetail((current) => current ? { ...current, owner: response.owner } : current); }, "Ticket claimed.")}>Claim Ticket</button>}</div>}
          {staffMode && <div><label className="form-label" htmlFor="staff-status-transition">Status Transition</label><select id="staff-status-transition" aria-label="Status Transition" className="form-select" value={statusTarget} disabled={saving} onChange={(event) => setStatusTarget(event.target.value)}><option value="">Select next status</option>{nextStatuses.map((status) => <option value={status} key={status}>{queueStatusLabel(status)}</option>)}</select><button className="btn btn-sm btn-success mt-2" type="button" disabled={saving || !statusTarget} onClick={() => { const target = statusTarget as TicketStatus; if (requiresConfirmation(target) && !window.confirm(`Confirm transition to ${queueStatusLabel(target)}?`)) return; void runMutation(async () => { const response = await updateStaffTicketStatus(csrfToken, detail.id, target); setDetail((current) => current ? { ...current, currentStatus: response.currentStatus, currentStatusLabel: response.currentStatusLabel } : current); setStatusTarget(""); }, "Status updated."); }}>Apply Status</button></div>}
        </div></section>

        {detail.problemAppearsResolvedAt && <div className="alert alert-info" role="status"><strong>Problem Appears Resolved</strong> indicated by the Requester on {new Date(detail.problemAppearsResolvedAt).toLocaleString()}. This does not change formal Ticket status.</div>}

        <section className="staff-detail-section public-communication"><h3>Public Comments <span className="communication-label">Public</span></h3><p>Visible to the Requester, IT Staff, and Administrator.</p>{detail.publicComments.length === 0 ? <p>No Public Comments yet.</p> : <div className="communication-list">{detail.publicComments.map((comment) => <article key={comment.id}><strong>{comment.author.name}</strong><small>{new Date(comment.createdAt).toLocaleString()}</small><p>{comment.content}</p></article>)}</div>}{staffMode && <><label className="form-label" htmlFor="staff-public-comment">Public Comment</label><textarea id="staff-public-comment" aria-label="Public Comment" className="form-control" maxLength={2000} value={publicContent} disabled={saving} onChange={(event) => setPublicContent(event.target.value)} /><button className="btn btn-success mt-2" type="button" disabled={saving || !publicContent.trim()} onClick={() => void runMutation(async () => { const comment = await postPublicComment(csrfToken, detail.id, publicContent); setDetail((current) => current ? { ...current, publicComments: [...current.publicComments, comment] } : current); setPublicContent(""); }, "Public Comment posted.")}>Post Public Comment</button></>}</section>

        <section className="staff-detail-section internal-communication"><h3>Internal Notes <span className="communication-label internal-label">Internal - not visible to Requester</span></h3><p>Private Staff communication. Internal Notes are append-only in Lab 3.</p>{detail.internalNotes.length === 0 ? <p>No Internal Notes yet.</p> : <div className="communication-list">{detail.internalNotes.map((note) => <article key={note.id}><strong>{note.author.name}</strong><small>{new Date(note.createdAt).toLocaleString()}</small><p>{note.content}</p></article>)}</div>}{staffMode && <><label className="form-label" htmlFor="staff-internal-note">Internal Note</label><textarea id="staff-internal-note" aria-label="Internal Note" className="form-control" maxLength={2000} value={internalContent} disabled={saving} onChange={(event) => setInternalContent(event.target.value)} /><button className="btn btn-warning mt-2" type="button" disabled={saving || !internalContent.trim()} onClick={() => void runMutation(async () => { const note = await postInternalNote(csrfToken, detail.id, internalContent); setDetail((current) => current ? { ...current, internalNotes: [...current.internalNotes, note] } : current); setInternalContent(""); }, "Internal Note added.")}>Add Internal Note</button></>}</section>

        <section className="staff-detail-section"><h3>Attachments</h3>{detail.attachments.length === 0 ? <p>No Attachments.</p> : <ul className="staff-attachment-list">{detail.attachments.map((attachment) => <li key={attachment.id}><span>{attachment.originalFilename}</span>{attachment.state === "active" && attachment.downloadUrl ? <a className="btn btn-sm btn-outline-success" href={attachment.downloadUrl}>Download</a> : <span>Removed{attachment.removalReason ? `: ${attachment.removalReason}` : ""}</span>}</li>)}</ul>}</section>
      </section>
    </main>
  );
}

function AuthenticatedShell({ user, csrfToken, onLogout, onChangePassword, errorMessage, successMessage }: { user: AuthUser; csrfToken: string; onLogout: () => Promise<void>; onChangePassword: () => void; errorMessage?: string; successMessage?: string }) {
  const [routeHash, setRouteHash] = useState(() => window.location.hash);
  useEffect(() => {
    const update = () => setRouteHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const staffTicketMatch = routeHash.match(/^#staff-ticket-(\d+)$/);
  const staffTicketId = staffTicketMatch ? Number(staffTicketMatch[1]) : null;
  const navigation = user.role === "REQUESTER"
    ? [{ label: "My Tickets", href: "#my-tickets" }, { label: "Create Ticket", href: "#create-ticket" }]
    : user.role === "IT_STAFF"
      ? [{ label: "Ticket Queue", href: "#ticket-queue" }]
      : [{ label: "User Management", href: "#user-management" }];

  return (
    <div className="toktickit-app">
      <header className="app-shell auth-shell">
        <div>
          <h1>TokTickIT IT Service Desk</h1>
          <nav aria-label="Primary navigation">
            {navigation.map((item) => <a className="auth-nav-item" href={item.href} key={item.href}>{item.label}</a>)}
          </nav>
        </div>
        <div className="auth-identity">
          <div><strong>{user.name}</strong><span className="role-badge">{roleLabel(user.role)}</span></div>
          <div className="auth-shell-actions">
            <button className="btn btn-sm btn-outline-light" type="button" onClick={onChangePassword}>Change Password</button>
            <button className="btn btn-sm btn-light" type="button" onClick={() => void onLogout()}>Logout</button>
          </div>
        </div>
      </header>
      {staffTicketId && (user.role === "IT_STAFF" || user.role === "ADMINISTRATOR") ? (
        <StaffTicketDetailView ticketId={staffTicketId} user={user} csrfToken={csrfToken} />
      ) : user.role === "REQUESTER" ? (
        <>
          <div className="container pt-4">
            {errorMessage && <div className="alert alert-danger auth-shell-error" role="alert">{errorMessage}</div>}
            {successMessage && <div className="alert alert-success" role="status">{successMessage}</div>}
          </div>
          <RequesterWorkflow
            authenticatedRequester={{ id: user.id, name: user.name, email: user.email }}
            csrfToken={csrfToken}
            embedded
          />
        </>
      ) : user.role === "IT_STAFF" ? (
        <>
          <div className="container pt-4">
            {errorMessage && <div className="alert alert-danger auth-shell-error" role="alert">{errorMessage}</div>}
            {successMessage && <div className="alert alert-success" role="status">{successMessage}</div>}
          </div>
          <StaffTicketQueue />
        </>
      ) : (
        <main className="container py-5">
          {errorMessage && <div className="alert alert-danger auth-shell-error" role="alert">{errorMessage}</div>}
          {successMessage && <div className="alert alert-success" role="status">{successMessage}</div>}
          <section className="auth-ready-panel">
            <h2>Authenticated session ready</h2>
            <p>Signed in successfully. Use the available navigation for your role.</p>
          </section>
        </main>
      )}
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [authActionError, setAuthActionError] = useState("");
  const [authSuccessMessage, setAuthSuccessMessage] = useState("");

  useEffect(() => {
    if (!authSuccessMessage) return;
    const timer = window.setTimeout(() => setAuthSuccessMessage(""), 3_000);
    return () => window.clearTimeout(timer);
  }, [authSuccessMessage]);

  useEffect(() => {
    let current = true;
    void getCurrentUser()
      .then((response) => {
        if (!current) return;
        setUser(response.user);
        setCsrfToken(response.csrfToken);
        setAuthState("authenticated");
      })
      .catch(() => {
        if (!current) return;
        setUser(null);
        setCsrfToken("");
        setAuthState("unauthenticated");
      });
    return () => { current = false; };
  }, []);

  function acceptAuthentication(nextUser: AuthUser, nextCsrfToken: string) {
    setUser(nextUser);
    setCsrfToken(nextCsrfToken);
    setShowChangePassword(false);
    setAuthActionError("");
    setAuthSuccessMessage("");
    setAuthState("authenticated");
  }

  function acceptPasswordChange(nextUser: AuthUser, nextCsrfToken: string) {
    setUser(nextUser);
    setCsrfToken(nextCsrfToken);
    setShowChangePassword(false);
    setAuthActionError("");
    setAuthSuccessMessage("Password changed successfully.");
    setAuthState("authenticated");
  }

  async function handleLogout() {
    setAuthActionError("");
    try {
      if (!csrfToken) throw new Error("Missing CSRF token");
      await logoutUser(csrfToken);
      setUser(null);
      setCsrfToken("");
      setShowChangePassword(false);
      setAuthSuccessMessage("");
      setAuthState("unauthenticated");
    } catch {
      setAuthActionError("Unable to sign out. Please try again.");
    }
  }

  if (authState === "loading") {
    return <main className="auth-page"><div className="auth-loading" role="status">Loading TokTickIT...</div></main>;
  }
  if (authState === "unauthenticated" || !user) {
    return <LoginScreen onAuthenticated={acceptAuthentication} />;
  }
  if (user.mustChangePassword || showChangePassword) {
    return (
      <ChangePasswordScreen
        csrfToken={csrfToken}
        forced={user.mustChangePassword}
        onChanged={acceptPasswordChange}
        onLogout={handleLogout}
        onCancel={user.mustChangePassword ? undefined : () => setShowChangePassword(false)}
        logoutError={authActionError}
      />
    );
  }
  return <AuthenticatedShell user={user} csrfToken={csrfToken} onLogout={handleLogout} onChangePassword={() => { setAuthActionError(""); setAuthSuccessMessage(""); setShowChangePassword(true); }} errorMessage={authActionError} successMessage={authSuccessMessage} />;
}

function RequesterWorkflow({ authenticatedRequester, csrfToken = "", embedded = false }: { authenticatedRequester?: Requester; csrfToken?: string; embedded?: boolean } = {}) {
  const requesterContext = useRequesterContext(authenticatedRequester);
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
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [ticketDetailState, setTicketDetailState] = useState<"idle" | "loading" | "success" | "notFound" | "error">("idle");
  const [ticketDetailError, setTicketDetailError] = useState("");
  const [ticketDetailReload, setTicketDetailReload] = useState(0);
  const [publicComments, setPublicComments] = useState<PublicComment[]>([]);
  const [publicCommentText, setPublicCommentText] = useState("");
  const [publicCommentsState, setPublicCommentsState] = useState<"idle" | "loading" | "success" | "posting" | "error">("idle");
  const [publicCommentsError, setPublicCommentsError] = useState("");
  const [resolutionState, setResolutionState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [resolutionError, setResolutionError] = useState("");
  const [detailUploadState, setDetailUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [detailUploadError, setDetailUploadError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<TicketAttachment | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalError, setRemovalError] = useState("");
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
  const [createClientRequestId, setCreateClientRequestId] = useState("");
  const formDisabled = referenceState === "loading";
  const authenticatedMode = Boolean(authenticatedRequester);

  useEffect(() => {
    if (requesterContext.selectedRequester && referenceState === "idle") {
      void loadTicketReferences();
    }
  }, [requesterContext.selectedRequester, referenceState]);

  useEffect(() => {
    if (!embedded) return;
    const syncViewFromHash = () => {
      if (window.location.hash === "#my-tickets") setActiveView("myTickets");
      if (window.location.hash === "#create-ticket") setActiveView("createTicket");
    };
    syncViewFromHash();
    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, [embedded]);

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
      currentStatus: ticketStatusFilter ? ticketStatusFilter as NonNullable<MyTicketsQuery["currentStatus"]> : undefined,
      sortBy: ticketSortBy,
      sortDirection: ticketSortDirection,
      page: ticketPage,
      pageSize: ticketPageSize,
    };

    const ticketsRequest = authenticatedMode ? getAuthenticatedMyTickets(query) : getMyTickets(requester.id, query);
    void ticketsRequest
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
    authenticatedMode,
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

  useEffect(() => {
    const requester = requesterContext.selectedRequester;
    if (!requester || activeView !== "ticketDetail" || selectedTicketId === null) return;
    let current = true;
    setTicketDetailState("loading");
    setTicketDetailError("");
    const detailRequest = authenticatedMode ? getAuthenticatedTicketDetail(selectedTicketId) : getTicketDetail(requester.id, selectedTicketId);
    void detailRequest
      .then((detail) => {
        if (!current) return;
        setTicketDetail(detail);
        setTicketDetailState("success");
        if (authenticatedMode) {
          setPublicCommentsState("loading");
          setPublicCommentsError("");
          void getPublicComments(selectedTicketId)
            .then((comments) => {
              if (!current) return;
              setPublicComments(comments);
              setPublicCommentsState("success");
            })
            .catch(() => {
              if (!current) return;
              setPublicComments([]);
              setPublicCommentsState("error");
              setPublicCommentsError("Unable to load Public Comments. Please try again.");
            });
        }
      })
      .catch((error) => {
        if (!current) return;
        setTicketDetail(null);
        const message = error instanceof Error ? error.message : "Unable to load Ticket Detail.";
        if (/not.*found/i.test(message)) {
          setTicketDetailState("notFound");
        } else {
          setTicketDetailError("Unable to load Ticket Detail. Please try again.");
          setTicketDetailState("error");
        }
      });
    return () => { current = false; };
  }, [activeView, authenticatedMode, requesterContext.selectedRequester, selectedTicketId, ticketDetailReload]);

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
        if (authenticatedMode) {
          await addAuthenticatedTicketAttachment(csrfToken, ticketId, item.file);
        } else {
          await uploadTicketAttachment(ticketId, requesterId, item.file);
        }
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
      const clientRequestId = createClientRequestId || crypto.randomUUID();
      if (authenticatedMode && !createClientRequestId) setCreateClientRequestId(clientRequestId);
      const ticket = authenticatedMode
        ? await createAuthenticatedTicket(csrfToken, {
            clientRequestId,
            categoryId: Number(categoryId),
            relatedSystemId: Number(relatedSystemId),
            summary: summary.trim(),
            description: description.trim(),
            requestedPriority,
          })
        : await createTicket({
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
      if (authenticatedMode) setCreateClientRequestId("");
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
      if (authenticatedMode) {
        await addAuthenticatedTicketAttachment(csrfToken, createdTicket.id, item.file);
      } else {
        await uploadTicketAttachment(createdTicket.id, requesterContext.selectedRequester.id, item.file);
      }
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
    setCreateClientRequestId("");
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
    setSelectedTicketId(null);
    setTicketDetail(null);
    setTicketDetailState("idle");
    setTicketDetailError("");
    setPublicComments([]);
    setPublicCommentText("");
    setPublicCommentsState("idle");
    setPublicCommentsError("");
    setResolutionState("idle");
    setResolutionError("");
    setDetailUploadState("idle");
    setDetailUploadError("");
    setRemoveTarget(null);
    setRemovalReason("");
    setRemovalError("");
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
    setTicketDetailNotice("");
    setSelectedTicketId(ticketId);
    setActiveView("ticketDetail");
  }

  async function handleDetailUpload(file: File | undefined) {
    if (!file || !selectedRequester || !ticketDetail) return;
    const extensionAllowed = allowedAttachmentExtensions.some((extension) => file.name.toLowerCase().endsWith(extension));
    if (!extensionAllowed) {
      setDetailUploadError("Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.");
      return;
    }
    if (file.size > maxAttachmentSizeBytes) {
      setDetailUploadError("Attachment must be 5 MB or smaller.");
      return;
    }
    setDetailUploadState("uploading");
    setDetailUploadError("");
    try {
      const uploaded = authenticatedMode
        ? await addAuthenticatedTicketAttachment(csrfToken, ticketDetail.id, file)
        : await addTicketAttachment(selectedRequester.id, ticketDetail.id, file);
      const attachment: TicketAttachment = {
        ...uploaded,
        state: "active",
        downloadUrl: uploaded.downloadUrl,
      };
      setTicketDetail((current) => current ? { ...current, attachments: [...current.attachments, attachment] } : current);
      setDetailUploadState("idle");
    } catch (error) {
      setDetailUploadState("error");
      const message = error instanceof Error ? error.message : "";
      const isValidationMessage = /Only JPG|5 MB or smaller|at most five active attachments/i.test(message);
      setDetailUploadError(isValidationMessage ? message : "Unable to upload Attachment. Please retry.");
    }
  }

  async function handleConfirmRemoval() {
    if (!selectedRequester || !ticketDetail || !removeTarget) return;
    const reason = removalReason.trim();
    if (!reason) {
      setRemovalError("Removal reason is required.");
      return;
    }
    setRemovalError("");
    try {
      const removed = authenticatedMode
        ? await removeAuthenticatedTicketAttachment(csrfToken, ticketDetail.id, removeTarget.id, reason)
        : await removeTicketAttachment(selectedRequester.id, ticketDetail.id, removeTarget.id, reason);
      setTicketDetail((current) => current ? {
        ...current,
        attachments: current.attachments.map((item) => item.id === removed.id ? removed : item),
      } : current);
      setRemoveTarget(null);
      setRemovalReason("");
    } catch {
      setRemovalError("Unable to remove Attachment. Please try again.");
    }
  }

  async function handlePostPublicComment() {
    if (!authenticatedMode || !ticketDetail) return;
    const content = publicCommentText.trim();
    if (!content) {
      setPublicCommentsError("Public Comment is required.");
      return;
    }
    if (content.length > 2000) {
      setPublicCommentsError("Public Comment must be 2000 characters or fewer.");
      return;
    }
    setPublicCommentsState("posting");
    setPublicCommentsError("");
    try {
      const comment = await postPublicComment(csrfToken, ticketDetail.id, content);
      setPublicComments((current) => [...current, comment]);
      setPublicCommentText("");
      setPublicCommentsState("success");
    } catch {
      setPublicCommentsState("error");
      setPublicCommentsError("Unable to post Public Comment. Please try again.");
    }
  }

  async function handleProblemAppearsResolved() {
    if (!authenticatedMode || !ticketDetail) return;
    setResolutionState("saving");
    setResolutionError("");
    try {
      const result = await markProblemAppearsResolved(csrfToken, ticketDetail.id);
      setTicketDetail((current) => current ? { ...current, problemAppearsResolvedAt: result.problemAppearsResolvedAt } : current);
      setResolutionState("success");
    } catch {
      setResolutionState("error");
      setResolutionError("Unable to record the resolution indication. Please try again.");
    }
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
  const resolutionIndicationEligible = ticketDetail
    ? ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(ticketDetail.currentStatus)
    : false;

  return (
    <div className={embedded ? "requester-workflow-embedded" : "toktickit-app"}>
      {!embedded && (
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
      )}

      <main className={embedded ? "container pb-5" : "container py-5"}>
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
        ) : activeView === "ticketDetail" ? (
          <section className="ticket-detail-panel" aria-labelledby="ticket-detail-heading">
            <button className="btn btn-outline-success mb-3" type="button" onClick={() => setActiveView("myTickets")}>Back to My Tickets</button>

            {ticketDetailState === "loading" && <div className="alert alert-info" role="status">Loading Ticket Detail...</div>}
            {ticketDetailState === "notFound" && <div className="alert alert-warning" role="alert">Ticket is unavailable or does not belong to the selected Requester.</div>}
            {ticketDetailState === "error" && (
              <div className="alert alert-danger" role="alert">
                {ticketDetailError}{" "}
                <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setTicketDetailReload((value) => value + 1)}>Retry</button>
              </div>
            )}

            {ticketDetailState === "success" && ticketDetail && (
              <>
                <div className="ticket-detail-heading">
                  <div><h2 id="ticket-detail-heading">Ticket Detail</h2><p>Requester-owned ticket information is read-only.</p></div>
                  <span className="ticket-badge status">{ticketDetail.currentStatusLabel}</span>
                </div>
                <dl className="ticket-detail-grid">
                  <div><dt>Ticket Number</dt><dd>{ticketDetail.ticketNumber}</dd></div>
                  <div><dt>Status</dt><dd>{ticketDetail.currentStatusLabel}</dd></div>
                  <div><dt>Requester</dt><dd>{ticketDetail.requester.name} ({ticketDetail.requester.email})</dd></div>
                  <div><dt>Category</dt><dd>{ticketDetail.category.name}</dd></div>
                  <div><dt>Related System</dt><dd>{ticketDetail.relatedSystem.name}</dd></div>
                  <div><dt>Requested Priority</dt><dd>{ticketDetail.requestedPriority}</dd></div>
                  <div className="detail-wide"><dt>Summary</dt><dd>{ticketDetail.summary}</dd></div>
                  <div className="detail-wide"><dt>Description</dt><dd>{ticketDetail.description}</dd></div>
                  <div><dt>Created</dt><dd>{ticketDetail.createdAt.slice(0, 10)}</dd></div>
                  <div><dt>Last Updated</dt><dd>{ticketDetail.updatedAt.slice(0, 10)}</dd></div>
                </dl>

                <section className="detail-attachments" aria-labelledby="detail-attachments-heading">
                  <div className="detail-attachments-heading">
                    <div><h3 id="detail-attachments-heading">Attachments</h3><p>Add or manage permitted evidence for this Ticket.</p></div>
                    <label className="btn btn-success attachment-upload-button">
                      {detailUploadState === "uploading" ? "Uploading..." : "Add Attachment"}
                      <input type="file" aria-label="Add Attachment" disabled={detailUploadState === "uploading"} onChange={(event) => void handleDetailUpload(event.target.files?.[0])} />
                    </label>
                  </div>
                  {detailUploadError && <div className="alert alert-danger" role="alert">{detailUploadError}</div>}
                  {ticketDetail.attachments.length === 0 ? (
                    <div className="empty-state" role="status">No attachments have been added.</div>
                  ) : (
                    <ul className="attachment-list detail-attachment-list">
                      {ticketDetail.attachments.map((attachment) => (
                        <li key={attachment.id} className={`attachment-item ${attachment.state}`}>
                          <div>
                            <strong>{attachment.originalFilename}</strong>
                            <div className="attachment-meta">
                              {attachment.state === "removed" ? (
                                <>
                                  <div>Uploaded {attachment.uploadedAt.slice(0, 10)} - {attachment.mimeType} - {attachment.sizeBytes} bytes</div>
                                  <div>Removed {attachment.removedAt?.slice(0, 10) ?? "date unavailable"} - {attachment.removalReason ?? "Reason unavailable"}</div>
                                  <div>Download unavailable</div>
                                </>
                              ) : (
                                `Active - Uploaded ${attachment.uploadedAt.slice(0, 10)} - ${attachment.mimeType} - ${attachment.sizeBytes} bytes`
                              )}
                            </div>
                          </div>
                          {attachment.state === "active" && attachment.downloadUrl && (
                            <span className="attachment-actions">
                              <a className="btn btn-sm btn-outline-success" href={attachment.downloadUrl} aria-label={`Download ${attachment.originalFilename}`}>Download</a>
                              <button className="btn btn-sm btn-outline-danger" type="button" aria-label={`Remove ${attachment.originalFilename}`} onClick={() => { setRemoveTarget(attachment); setRemovalReason(""); setRemovalError(""); }}>Remove</button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {authenticatedMode && (
                  <section className="detail-comments" aria-labelledby="public-comments-heading">
                    <div className="detail-comments-heading">
                      <div>
                        <h3 id="public-comments-heading">Public Comments</h3>
                        <p>Visible to the Requester and permitted service-desk roles.</p>
                      </div>
                      <button
                        className="btn btn-outline-success"
                        type="button"
                        disabled={resolutionState === "saving" || Boolean(ticketDetail.problemAppearsResolvedAt) || !resolutionIndicationEligible}
                        onClick={() => void handleProblemAppearsResolved()}
                      >
                        {resolutionState === "saving" ? "Saving..." : ticketDetail.problemAppearsResolvedAt ? "Problem Appears Resolved Recorded" : "Problem Appears Resolved"}
                      </button>
                    </div>
                    {!resolutionIndicationEligible && !ticketDetail.problemAppearsResolvedAt && (
                      <p className="text-muted">Problem Appears Resolved is available only while this Ticket is Open, In Progress, Waiting for Requester, or Reopened.</p>
                    )}
                    {resolutionState === "success" && <div className="alert alert-success" role="status">Resolution indication recorded. Ticket status was not changed.</div>}
                    {resolutionError && <div className="alert alert-danger" role="alert">{resolutionError}</div>}
                    {publicCommentsState === "loading" && <div className="alert alert-info" role="status">Loading Public Comments...</div>}
                    {publicCommentsError && <div className="alert alert-danger" role="alert">{publicCommentsError}</div>}
                    {publicCommentsState !== "loading" && publicComments.length === 0 && (
                      <div className="empty-state" role="status">No Public Comments yet.</div>
                    )}
                    {publicComments.length > 0 && (
                      <ul className="public-comment-list">
                        {publicComments.map((comment) => (
                          <li key={comment.id} className="public-comment-item">
                            <div><strong>{comment.author.name}</strong> <span className="role-badge">{roleLabel(comment.author.role)}</span></div>
                            <p>{comment.content}</p>
                            <small>{comment.createdAt.slice(0, 16).replace("T", " ")} UTC</small>
                          </li>
                        ))}
                      </ul>
                    )}
                    <label className="form-label" htmlFor="public-comment">Public Comment</label>
                    <textarea
                      id="public-comment"
                      className="form-control"
                      rows={3}
                      maxLength={2000}
                      value={publicCommentText}
                      disabled={publicCommentsState === "posting"}
                      onChange={(event) => { setPublicCommentText(event.target.value); setPublicCommentsError(""); }}
                    />
                    <div className="ticket-actions">
                      <span>{publicCommentText.length}/2000</span>
                      <button className="btn btn-success" type="button" disabled={publicCommentsState === "posting" || !publicCommentText.trim()} onClick={() => void handlePostPublicComment()}>
                        {publicCommentsState === "posting" ? "Posting..." : "Post Comment"}
                      </button>
                    </div>
                  </section>
                )}

                {removeTarget && (
                  <div className="removal-confirmation" role="dialog" aria-labelledby="removal-heading" aria-modal="true">
                    <h3 id="removal-heading">Confirm Attachment removal</h3>
                    <p>The file remains as removed metadata and can no longer be downloaded.</p>
                    <label className="form-label" htmlFor="removal-reason">Removal reason</label>
                    <textarea id="removal-reason" className={`form-control ${removalError ? "is-invalid" : ""}`} value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} />
                    {removalError && <div className="invalid-feedback d-block" role="alert">{removalError}</div>}
                    <div className="ticket-actions">
                      <button className="btn btn-outline-secondary" type="button" onClick={() => setRemoveTarget(null)}>Cancel removal</button>
                      <button className="btn btn-danger" type="button" onClick={() => void handleConfirmRemoval()}>Confirm removal</button>
                    </div>
                  </div>
                )}
              </>
            )}
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
                  <option value="">All statuses</option>
                  <option value="NEW">New</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_FOR_REQUESTER">Waiting for Requester</option><option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option><option value="REOPENED">Reopened</option><option value="CANCELLED">Cancelled</option>
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

export function LegacyRequesterApp() {
  return <RequesterWorkflow />;
}
