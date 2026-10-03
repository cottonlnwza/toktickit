# Lab 4 REST API Specification

Status: Proposed Sprint 4 API contract for Issue #63. Existing Lab 3 authentication/session/CSRF/origin behavior remains the security foundation.

## 1. Shared API Principles

- Base prefix: `/api`.
- JSON is used for Lab 4 request/response bodies.
- Authenticated identity comes only from the verified server session.
- State-changing requests continue to require the Lab 3 session cookie, current CSRF token, and approved-origin checks.
- Dates/times are returned as ISO-8601 UTC strings.
- Protected errors never disclose another User's protected Ticket/Action/Internal Note existence or security secrets.
- Successful responses use documented direct shapes rather than adding a new global `{data: ...}` wrapper.
- Unknown protected identity fields such as arbitrary `performedById` are rejected/ignored only as explicitly documented below; the client never chooses backend-authenticated performer identity.

## 2. Shared Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "actionDescription": "Action Description is required."
    }
  }
}
```

`fields` is optional.

### Shared status codes

| Status | Use |
|---|---|
| 200 | Successful read/update/replay/status change |
| 201 | Resource created |
| 400 | Malformed/unknown field, invalid enum/value, or missing/invalid required content |
| 401 | Missing/expired/revoked authentication |
| 403 | Authenticated but role-forbidden/password-change-required |
| 404 | Missing resource or protected resource hidden from caller |
| 409 | Validly shaped request conflicts with current domain state: stale revision, replay conflict, inactive assignee, terminal/invalid state transition, assignee mismatch, inactive parent Ticket, or resolution gate |
| 500 | Safe unexpected server error |

## 3. Action Taken Resource Shape

Canonical response item:

```json
{
  "id": 501,
  "ticketId": 42,
  "workflowCycle": 1,
  "clientRequestId": "6e6f5842-4919-4ab8-aee8-8ad0fe5e6a11",
  "createdBy": { "id": 7, "name": "Staff Creator" },
  "actionDateTime": "2026-10-02T12:00:00.000Z",
  "actionDescription": "Replaced the damaged network cable.",
  "result": "Link is stable at 1 Gbps.",
  "status": "COMPLETED",
  "statusLabel": "Completed",
  "assignee": { "id": 8, "name": "Staff One" },
  "performedBy": { "id": 9, "name": "Staff Two" },
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See the cable-port photo in Ticket Attachments.",
  "completedAt": "2026-10-02T12:25:00.000Z",
  "cancelledAt": null,
  "version": 2,
  "createdAt": "2026-10-02T12:00:00.000Z",
  "updatedAt": "2026-10-02T12:25:00.000Z"
}
```

`actionDateTime` is the same immutable backend value as `createdAt`, matching the handout wording “Action create date/time”. The client cannot set workflow cycle, creator, performer, audit times, fingerprints, or versions directly.

## 4. Retrieve Actions Taken

### GET `/api/tickets/:ticketId/actions`

Allowed:

- Requester for an owned Ticket.
- IT Staff for an accessible Ticket.
- Administrator for Lab 4 support/testing access.

Success `200`:

```json
{
  "items": [
    { "id": 501, "ticketId": 42, "status": "PLANNED", "version": 0 }
  ]
}
```

Items are returned `workflowCycle asc, createdAt asc, id asc` and include historical cycles. The current Ticket workflow cycle is identified in the Ticket payload/UI so older Actions remain historical evidence. No pagination is required for the per-Ticket Lab 4 Action list unless later approved; the API must still use a bounded/selective query and must not include unrelated Tickets.

Errors: `400` invalid id; `401` unauthenticated; `403` role-forbidden; safe `404` for missing/ownership-protected Ticket; `500` safe failure.

## 5. Create Action Taken

### POST `/api/staff/tickets/:ticketId/actions`

Allowed roles: `IT_STAFF`, `ADMINISTRATOR`.

Request:

```json
{
  "expectedTicketVersion": 3,
  "clientRequestId": "6e6f5842-4919-4ab8-aee8-8ad0fe5e6a11",
  "actionDescription": "Replace damaged network cable.",
  "assigneeId": 8,
  "result": null,
  "followUpRequired": true,
  "followUpNote": "Verify stability tomorrow morning.",
  "attachmentNotes": "Port photo is attached to the Ticket."
}
```

Rules:

- Parent Ticket must be in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; otherwise `409 PARENT_TICKET_NOT_ACTIVE`.
- `expectedTicketVersion`: required non-negative integer aggregate revision.
- `clientRequestId`: required UUID with **global database uniqueness**.
- Backend sets `workflowCycle` from the current Ticket and `createdById` from the authenticated actor.
- Backend computes and stores immutable `createFingerprint` from normalized original create intent: Ticket id, cycle, creator id, Action Description, initial assignee, initial Result, Follow-Up Required/Note, and Attachment Notes.
- `actionDescription`: trim, required 1-2000 chars.
- `assigneeId`: optional in transport shape; when omitted, backend uses authenticated actor. Persisted assignee must be active IT Staff/Administrator.
- `result`: optional while PLANNED; if supplied, trim 1-2000 chars.
- `followUpRequired`: required Boolean; Note required 1-1000 chars when true and persisted null when false.
- `attachmentNotes`: optional, trimmed maximum 1000 chars.
- Initial status is `PLANNED`; Action version starts 0; Ticket version increments atomically.
- Backend appends one `CREATED` Action event carrying actor and resulting Action/Ticket versions.

Success new create: `201` with `{ "action": <resource>, "ticketVersion": <newVersion>, "replayed": false }`.

Exact replay by the same creator/Ticket/cycle and same stored create fingerprint returns `200` with the original Action and `replayed=true`; it is read-only and does not increment Ticket/Action versions or append another event. Later edits to the Action projection do not change the immutable fingerprint.

Any other reuse of the global UUID returns `409 ACTION_REPLAY_CONFLICT` with no protected original data disclosed.

## 6. Edit Action Taken

### PATCH `/api/staff/tickets/:ticketId/actions/:actionId`

Allowed roles: `IT_STAFF`, `ADMINISTRATOR`.

Only `PLANNED` or `IN_PROGRESS` Actions are editable.

Request contains any editable field plus both required aggregate concurrency tokens:

```json
{
  "expectedTicketVersion": 4,
  "expectedActionVersion": 1,
  "actionDescription": "Replace and retest the damaged network cable.",
  "assigneeId": 9,
  "result": "Initial retest completed.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "Updated photo is attached."
}
```

Success `200`: updated Action with `version = expectedActionVersion + 1`, incremented Ticket aggregate version, and exactly one immutable `EDITED` or `REASSIGNED` event (reassignment takes the specific event type when assignee changes).

Errors:

- `400 VALIDATION_ERROR` invalid field/length.
- `409 INACTIVE_ASSIGNEE` assignee no longer eligible.
- `409 ACTION_TERMINAL` completed/cancelled Action cannot be edited.
- `409 STALE_UPDATE` when either parent Ticket or Action version no longer matches.
- `409 PARENT_TICKET_NOT_ACTIVE` when the current parent status is terminal.
- No partial Action/Ticket/event write is committed on conflict.
- Safe auth/not-found/failure responses as shared above.

## 7. Action Status Transition

### POST `/api/staff/tickets/:ticketId/actions/:actionId/status`

Request:

```json
{
  "toStatus": "COMPLETED",
  "expectedTicketVersion": 5,
  "expectedActionVersion": 1,
  "result": "Link stable after replacement."
}
```

Allowed transitions:

| From | To |
|---|---|
| `PLANNED` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `COMPLETED` | none |
| `CANCELLED` | none |

Completion rules:

- Parent Ticket must still be active and Action cycle must equal current Ticket cycle.
- Authenticated user must equal the current `assigneeId`; otherwise `409 ACTION_ASSIGNEE_MISMATCH`. A different permitted staff member must reassign first.
- Result is required and validated at 1-2000 trimmed chars. Missing/invalid Result is deterministic `400 VALIDATION_ERROR`.
- Backend sets `performedById` from the authenticated assignee and `completedAt=server now`.
- Backend compare-and-increments Ticket and Action versions and appends one `COMPLETED` event atomically.

Start/cancellation rules:

- Start appends one `STARTED` event.
- Any permitted IT Staff/Administrator may cancel an accessible current-cycle non-terminal Action; backend sets `cancelledAt=server now` and appends one `CANCELLED` event with the authenticated actor.

Success `200`: updated Action plus new Ticket aggregate version.

Deterministic errors: `400 VALIDATION_ERROR` for malformed target/content; `409 ACTION_TRANSITION_NOT_ALLOWED` for a valid target not allowed from current Action state; `409 ACTION_TERMINAL`, `409 ACTION_ASSIGNEE_MISMATCH`, `409 PARENT_TICKET_NOT_ACTIVE`, or `409 STALE_UPDATE` for domain conflicts; shared auth/protected errors otherwise.

## 8. Final Ticket Status Update

Lab 4 keeps the existing Lab 3 endpoint `PATCH /api/staff/tickets/:ticketId/status` and adds the concurrency/resolution contract below. The implementation must not create a second competing Ticket-status route merely for Lab 4.

Request body extends the existing shape with:

```json
{
  "status": "RESOLVED",
  "expectedTicketVersion": 6
}
```

Rules:

- Final Ticket transition matrix from `specification.md` remains authoritative.
- Allowed roles are `IT_STAFF` and `ADMINISTRATOR` in Lab 4, consistent with the handout's Administrator “Perform IT Staff behavior” support/testing rule.
- `expectedTicketVersion` is mandatory and compare-and-increments on success.
- Before `RESOLVED`, backend evaluates only Actions whose `workflowCycle` equals the current Ticket cycle. The gate requires **at least one `COMPLETED` Action** and **zero `PLANNED`/`IN_PROGRESS` Actions**. Cancelled-only or zero-Action current cycles fail.
- Gate failure: `409 RESOLUTION_GATE_BLOCKED`; Ticket status/version do not change.
- On successful `RESOLVED`, set `resolvedAt=server now`.
- On successful `REOPENED`, atomically increment `workflowCycle`, clear `resolvedAt`, and keep old-cycle Actions as immutable historical work.
- Requester `Problem Appears Resolved` remains separate/advisory.
- `400 VALIDATION_ERROR` is used for malformed/unknown status value; `409 TICKET_TRANSITION_NOT_ALLOWED` is used when a valid target status is not allowed from current persisted state.

Stale `expectedTicketVersion` returns `409 STALE_UPDATE` without overwrite.

## 9. Action Audit Events

Action mutations append immutable `ActionTakenEvent` rows inside the same transaction as projection/revision changes. Normal Lab 4 APIs do not expose event mutation. Staff/Admin Ticket Detail may retrieve/read audit events if needed for review evidence; Requester Action visibility does not require exposing internal audit metadata beyond the Action records themselves.

Event fields include event type, actor, Ticket/Action ids, workflow cycle, resulting Ticket/Action versions, timestamp, and relevant status/assignee before/after metadata. Content-edit events record changed field names rather than duplicating full mutable text.

## 10. Requester Dashboard

### GET `/api/dashboards/requester`

Allowed role: `REQUESTER` only. Identity is server session identity; no requesterId query/body field is accepted.

Success `200`:

```json
{
  "generatedAt": "2026-10-02T12:00:00.000Z",
  "metrics": {
    "openTickets": 3,
    "waitingForRequester": 1
  },
  "recentlyUpdated": [
    {
      "id": 42,
      "ticketNumber": "TTK-20261001-0001",
      "summary": "VPN connection fails",
      "status": "IN_PROGRESS",
      "updatedAt": "2026-10-02T10:00:00.000Z",
      "drillDown": "/tickets/42"
    }
  ],
  "recentlyResolved": [],
  "drillDown": {
    "openTickets": "/tickets?scope=open",
    "waitingForRequester": "/tickets?currentStatus=WAITING_FOR_REQUESTER"
  }
}
```

Calculation rules come from BR-29 through BR-32. The server captures one `generatedAt` UTC snapshot; 7-day and 30-day lower/upper boundaries are inclusive. Empty recent sections are `[]`; counts return numeric `0`, never omitted/null. Ordering uses timestamp desc then id desc.

## 11. IT Staff / Administrator Dashboard

### GET `/api/dashboards/staff`

Allowed roles: `IT_STAFF`, `ADMINISTRATOR`.

Success `200`:

```json
{
  "generatedAt": "2026-10-02T12:00:00.000Z",
  "metrics": {
    "unassignedTickets": 2,
    "myTickets": 4,
    "myOpenActions": 3,
    "byStatus": {
      "NEW": 1,
      "OPEN": 2,
      "IN_PROGRESS": 3,
      "WAITING_FOR_REQUESTER": 0,
      "RESOLVED": 1,
      "CLOSED": 5,
      "REOPENED": 0,
      "CANCELLED": 0
    },
    "byItPriority": {
      "LOW": 1,
      "MEDIUM": 2,
      "HIGH": 3,
      "URGENT": 1
    }
  },
  "recentUrgentTickets": [],
  "myRecentActions": [],
  "drillDown": {
    "unassignedTickets": "/staff/tickets?owner=unassigned",
    "myTickets": "/staff/tickets?owner=me",
    "myOpenActions": "/dashboard#my-actions"
  }
}
```

Rules:

- Metrics are computed on the backend from authoritative database state.
- `byStatus` includes all eight keys with zero values where needed.
- `byItPriority` uses active-status Tickets and includes all four priorities with zeros.
- `recentUrgentTickets` max 5.
- `myOpenActions` and `myRecentActions` include only Actions whose parent Ticket is active and whose `workflowCycle` equals the parent Ticket current cycle. Historical earlier-cycle/terminal-parent Actions are excluded from current-work dashboard metrics.
- `myRecentActions` max 5 and includes current-cycle active-parent Actions where current User is assignee or performer, ordered `updatedAt desc, id desc`.
- Administrator uses the same payload contract; `myTickets` and `myOpenActions` are based on Administrator's own User id where applicable.

## 12. Dashboard Drill-Down Contract

Dashboard URLs/query metadata are navigation hints, not authorization grants. Destination endpoints re-authorize normally.

- Requester Open Tickets -> existing My Tickets using active-status filter intent. If the existing My Tickets API cannot express a multi-status `scope=open` query, the client routes to My Tickets and applies the closest approved existing filter representation without changing server ownership rules.
- Requester Waiting for You -> My Tickets with `WAITING_FOR_REQUESTER`.
- Staff Unassigned -> Ticket Queue `owner=unassigned`.
- Staff My Tickets -> Ticket Queue owner filter representing current authenticated user. If the existing Queue API requires numeric owner id, the dashboard response may provide the current safe user id/query value instead of trusting a client-supplied arbitrary identity.
- Recent Ticket/Action rows -> Ticket Detail URL for the referenced permitted Ticket.

## 13. Safe Empty, Failure, and Conflict Behavior

- Dashboard no-data is a successful `200` with explicit zero counts and empty arrays.
- Invalid dashboard query values, if future approved query options are added, return `400`; current endpoints require no free-form filter query.
- A protected Ticket/Action not visible to the current role returns safe `404` or role `403` consistent with existing Lab 3 rules without leaking protected content.
- `STALE_UPDATE` responses do not automatically include protected full current records. Client reloads through the normal authorized GET path.
- Unexpected errors return safe `500` messages and are logged server-side without returning stack/database internals.

## 14. Regression Compatibility

Lab 4 continues all approved Labs 2-3 APIs unless this contract explicitly extends them. In particular:

- Lab 3 opaque session + CSRF + origin validation remains unchanged.
- Authenticated Requester ownership is still derived from session identity.
- Existing Attachments, Public Comments, Internal Notes, IT Priority, Queue, User Management, and password/session behavior remain protected by their existing contracts.
- Internal Notes never appear in Requester dashboard or Actions Taken payloads.
- Lab 4 does not restore Development Requester selector behavior.

## 15. API-to-Test Traceability

- Actions Taken endpoints -> `server/tests/lab-04/actions-taken.api.test.ts`.
- Ticket resolution/concurrency -> `server/tests/lab-04/ticket-workflow.api.test.ts`.
- Requester dashboard -> `server/tests/lab-04/requester-dashboard.api.test.ts`.
- Staff/Admin dashboard -> `server/tests/lab-04/staff-dashboard.api.test.ts`.
- Migration/backfill -> `server/tests/lab-04/migration.integration.test.ts`.
- Seed -> `server/tests/lab-04/seed.integration.test.ts`.

Actual final results remain in `docs/lab-04/tests.md` and may be marked Pass only after execution.
