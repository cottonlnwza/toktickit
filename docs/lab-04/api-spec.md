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
| 400 | Invalid body/query/value/transition |
| 401 | Missing/expired/revoked authentication |
| 403 | Authenticated but role-forbidden/password-change-required |
| 404 | Missing resource or protected resource hidden from caller |
| 409 | Stale version, replay conflict, invalid current workflow state, inactive assignee, resolution gate |
| 500 | Safe unexpected server error |

## 3. Action Taken Resource Shape

Canonical response item:

```json
{
  "id": 501,
  "ticketId": 42,
  "clientRequestId": "6e6f5842-4919-4ab8-aee8-8ad0fe5e6a11",
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

`actionDateTime` is the same backend value as `createdAt` and is provided as the stakeholder-facing field name. The client cannot set `performedBy`, `completedAt`, `cancelledAt`, `createdAt`, `updatedAt`, or `version` directly.

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

Items are returned `createdAt asc, id asc`. No pagination is required for the per-Ticket Lab 4 Action list unless later approved; the API must still use a bounded/selective query and must not include unrelated Tickets.

Errors: `400` invalid id; `401` unauthenticated; `403` role-forbidden; safe `404` for missing/ownership-protected Ticket; `500` safe failure.

## 5. Create Action Taken

### POST `/api/staff/tickets/:ticketId/actions`

Allowed roles: `IT_STAFF`, `ADMINISTRATOR`.

Request:

```json
{
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

- `clientRequestId`: required UUID, globally unique.
- `actionDescription`: trim, required 1-2000 chars.
- `assigneeId`: optional only in transport shape; when omitted, backend uses authenticated actor. Final persisted assignee must be active IT Staff/Administrator.
- `result`: optional while PLANNED; if supplied, trim 1-2000 chars.
- `followUpRequired`: required Boolean.
- `followUpNote`: required 1-1000 chars when true; persisted `null` when false.
- `attachmentNotes`: optional, trimmed maximum 1000 chars.
- Initial status is `PLANNED`.
- `createdAt/actionDateTime` and version 0 are backend generated.
- `performedBy` is null until completion.

Success new create: `201` with `{ "action": <resource>, "replayed": false }`.

Exact replay by the same authorized actor/Ticket with the same normalized payload: `200` with original Action and `replayed=true`.

Reusing `clientRequestId` for another Ticket, another protected context, or a different normalized payload: `409 ACTION_REPLAY_CONFLICT` with no protected original data disclosed.

## 6. Edit Action Taken

### PATCH `/api/staff/tickets/:ticketId/actions/:actionId`

Allowed roles: `IT_STAFF`, `ADMINISTRATOR`.

Only `PLANNED` or `IN_PROGRESS` Actions are editable.

Request contains any editable field plus required concurrency token:

```json
{
  "expectedVersion": 1,
  "actionDescription": "Replace and retest the damaged network cable.",
  "assigneeId": 9,
  "result": "Initial retest completed.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "Updated photo is attached."
}
```

Success `200`: updated Action with `version = expectedVersion + 1`.

Errors:

- `400 VALIDATION_ERROR` invalid field/length.
- `409 INACTIVE_ASSIGNEE` assignee no longer eligible.
- `409 ACTION_TERMINAL` completed/cancelled Action cannot be edited.
- `409 STALE_UPDATE` version no longer matches persisted row.
- Safe auth/not-found/failure responses as shared above.

## 7. Action Status Transition

### POST `/api/staff/tickets/:ticketId/actions/:actionId/status`

Request:

```json
{
  "toStatus": "COMPLETED",
  "expectedVersion": 1,
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

- Result is required and validated at 1-2000 trimmed chars. If already stored valid Result exists, request may omit `result` and the backend may use the stored value.
- Backend sets `performedById` from authenticated actor and `completedAt=server now`.
- `cancelledAt` remains null.

Cancellation rules:

- Backend sets `cancelledAt=server now`.
- `performedById` remains null unless it was already set, which normal state rules prevent.

Success `200`: updated Action with incremented version.

Errors include `400 INVALID_ACTION_TRANSITION`, `400/409` completion validation as documented, `409 STALE_UPDATE`, and safe protected errors.

## 8. Final Ticket Status Update

Lab 4 keeps the existing Lab 3 endpoint `PATCH /api/staff/tickets/:ticketId/status` and adds the concurrency/resolution contract below. The implementation must not create a second competing Ticket-status route merely for Lab 4.

Request body extends the existing shape with:

```json
{
  "status": "RESOLVED",
  "expectedVersion": 3
}
```

Rules:

- Existing final Ticket transition matrix from `specification.md` remains authoritative.
- Normal Ticket status transition remains IT Staff-only.
- `expectedVersion` is mandatory for Lab 4 workflow mutation and increments on success.
- Before `RESOLVED`, backend atomically verifies no Action Taken for the Ticket is in `PLANNED` or `IN_PROGRESS`.
- If any non-terminal Action exists: `409 ACTIONS_INCOMPLETE`; Ticket status/version do not change.
- On successful entry to `RESOLVED`, set `resolvedAt=server now`.
- On successful `REOPENED`, clear current-cycle `resolvedAt`; a later resolve writes a new timestamp.
- Requester `Problem Appears Resolved` endpoint remains separate/advisory and does not call this formal transition.

Stale expectedVersion returns `409 STALE_UPDATE` without overwrite.

## 9. Requester Dashboard

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

Calculation rules come from BR-27 through BR-30. Empty recent sections are `[]`; counts return numeric `0`, never omitted/null.

## 10. IT Staff / Administrator Dashboard

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
- `myRecentActions` max 5 and includes only Actions where current User is assignee or performer.
- Administrator uses the same payload contract; `myTickets` and `myOpenActions` are still based on Administrator's own User id where applicable.

## 11. Dashboard Drill-Down Contract

Dashboard URLs/query metadata are navigation hints, not authorization grants. Destination endpoints re-authorize normally.

- Requester Open Tickets -> existing My Tickets using active-status filter intent. If the existing My Tickets API cannot express a multi-status `scope=open` query, the client routes to My Tickets and applies the closest approved existing filter representation without changing server ownership rules.
- Requester Waiting for You -> My Tickets with `WAITING_FOR_REQUESTER`.
- Staff Unassigned -> Ticket Queue `owner=unassigned`.
- Staff My Tickets -> Ticket Queue owner filter representing current authenticated user. If the existing Queue API requires numeric owner id, the dashboard response may provide the current safe user id/query value instead of trusting a client-supplied arbitrary identity.
- Recent Ticket/Action rows -> Ticket Detail URL for the referenced permitted Ticket.

## 12. Safe Empty, Failure, and Conflict Behavior

- Dashboard no-data is a successful `200` with explicit zero counts and empty arrays.
- Invalid dashboard query values, if future approved query options are added, return `400`; current endpoints require no free-form filter query.
- A protected Ticket/Action not visible to the current role returns safe `404` or role `403` consistent with existing Lab 3 rules without leaking protected content.
- `STALE_UPDATE` responses do not automatically include protected full current records. Client reloads through the normal authorized GET path.
- Unexpected errors return safe `500` messages and are logged server-side without returning stack/database internals.

## 13. Regression Compatibility

Lab 4 continues all approved Labs 2-3 APIs unless this contract explicitly extends them. In particular:

- Lab 3 opaque session + CSRF + origin validation remains unchanged.
- Authenticated Requester ownership is still derived from session identity.
- Existing Attachments, Public Comments, Internal Notes, IT Priority, Queue, User Management, and password/session behavior remain protected by their existing contracts.
- Internal Notes never appear in Requester dashboard or Actions Taken payloads.
- Lab 4 does not restore Development Requester selector behavior.

## 14. API-to-Test Traceability

- Actions Taken endpoints -> `server/tests/lab-04/actions-taken.api.test.ts`.
- Ticket resolution/concurrency -> `server/tests/lab-04/ticket-workflow.api.test.ts`.
- Requester dashboard -> `server/tests/lab-04/requester-dashboard.api.test.ts`.
- Staff/Admin dashboard -> `server/tests/lab-04/staff-dashboard.api.test.ts`.
- Migration/backfill -> `server/tests/lab-04/migration.integration.test.ts`.
- Seed -> `server/tests/lab-04/seed.integration.test.ts`.

Actual final results remain in `docs/lab-04/tests.md` and may be marked Pass only after execution.
