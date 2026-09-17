# Lab 3 REST API Specification

Status: Draft contract for Issue #33. Implementation must follow this file unless the Engineering Contract is explicitly reviewed and amended first.

## 1. API Principles

- Base prefix: `/api`.
- JSON is used for normal request/response bodies; existing Attachment upload remains multipart/form-data.
- Authenticated identity comes only from the verified server session.
- Clients must not choose their own Requester identity.
- Protected-resource errors must not reveal another User's Ticket, Attachment, or Internal Note existence.
- All returned User objects exclude `passwordHash`, session hashes, CSRF hashes, and other secrets.
- Dates/times are ISO-8601 UTC strings.
- Unknown request fields that would change protected behavior are rejected or ignored only where explicitly documented.

## 2. Authentication and Session Contract

### 2.1 Session mechanism

- Successful login creates a cryptographically random opaque session token.
- Browser receives `tt_session=<token>` as `HttpOnly; SameSite=Lax; Path=/`; add `Secure` outside local HTTP development.
- Credentialed CORS must use an explicit approved frontend origin (for example the configured local Vite origin) with `credentials: true`; wildcard `*` is not permitted with the session cookie. Client authenticated requests use `credentials: "include"`.
- PostgreSQL stores only a SHA-256 token hash, User relation, CSRF token hash, creation time, expiry, and optional revocation time.
- Session absolute lifetime is 8 hours. Expired/revoked sessions are treated as unauthenticated.
- Login response includes a CSRF token for the current session. `GET /api/auth/me` rotates that CSRF token and returns the fresh value so the server can store only its hash. The frontend holds the current token in memory and sends it in `X-CSRF-Token` on state-changing authenticated requests.
- State-changing requests also require an approved-origin `Origin`/`Referer` check where the browser supplies those headers.
- Local development explicitly allows `http://localhost:5173` to call `http://localhost:3000` with credentialed CORS. The server uses an explicit origin allowlist plus `credentials: true`; authenticated frontend fetches use `credentials: "include"`. Wildcard credentialed CORS is not permitted.
- Logout revokes the current session and clears the cookie.
- Password change revokes other sessions for the User and rotates the current session/CSRF token.

### 2.2 Password hashing and validation

- Hash with Node `crypto.scrypt` using a unique random 16-byte salt and versioned format.
- Hash parameters: `N=16384`, `r=8`, `p=1`, derived key length 64 bytes.
- Verify derived hashes using `timingSafeEqual`.
- New password: 12-128 characters, not all whitespace, not equal to current/initial password, confirmation must match. Do not trim the password value.
- Normalize email using `trim().toLowerCase()` before lookup/uniqueness checks.
- Five failed login attempts for normalized email + client address in 15 minutes trigger a temporary 15-minute HTTP 429 throttle. For this local course lab the throttle may be held in process memory and may reset on server restart; no permanent account lock/unlock workflow is introduced.

## 3. Shared Response and Error Shapes

### Success response rule

Successful endpoints return the exact resource/list shape documented below; Lab 3 does **not** add a generic `{ "data": ... }` wrapper. This preserves the direct response style already used by Lab 2.

### Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "email": "Enter a valid email address."
    }
  }
}
```

`fields` is optional. Never return stack traces, database errors, password hashes, session/CSRF tokens, storage paths, or protected-resource details.

### Shared status codes

| Status | Use |
|---|---|
| 200 | Successful read/update/login/change-password |
| 201 | Resource created |
| 204 | Successful logout/delete-like soft action with no body when used |
| 400 | Invalid body/query/transition/value |
| 401 | Missing, expired, revoked, or invalid authenticated session; invalid credentials |
| 403 | Authenticated but role-forbidden; inactive account login; password change required |
| 404 | Missing resource or ownership-protected resource that must not leak existence |
| 409 | Duplicate email, conflicting owner/state change, last-admin/self-deactivation conflict |
| 413 | Existing Attachment size limit exceeded |
| 415 | Existing Attachment type unsupported |
| 429 | Login throttle exceeded |
| 500 | Safe unexpected server error |

## 4. Authentication Endpoints

### POST `/api/auth/login`

Request:

```json
{ "email": "user@example.com", "password": "exact password" }
```

Success `200`:

```json
{
  "user": {
    "id": 1,
    "name": "Alice Requester",
    "email": "alice.requester@example.com",
    "role": "REQUESTER",
    "mustChangePassword": true
  },
  "csrfToken": "opaque-csrf-value"
}
```

Errors: `400` malformed input; `401 INVALID_CREDENTIALS`; `403 ACCOUNT_INACTIVE`; `429 LOGIN_THROTTLED`; `500` safe failure.

### GET `/api/auth/me`

Requires valid session cookie. Re-checks the User's current activation state and role, rotates the session CSRF token, and returns safe User fields plus the fresh CSRF token. `401` for missing/expired/revoked sessions or a User who has since been deactivated.

### POST `/api/auth/change-password`

Allowed to authenticated Users even while `mustChangePassword=true`.

Request:

```json
{
  "currentPassword": "initial/current exact password",
  "newPassword": "new exact password",
  "confirmPassword": "new exact password"
}
```

Success `200`: `mustChangePassword=false`, rotated session and CSRF token. Errors: `400` password rule/confirmation; `401` current password invalid; `500` safe failure.

### POST `/api/auth/logout`

Requires session + CSRF. Revokes current session, clears cookie. Success `204`.

### Password-change gate

If `mustChangePassword=true`, every protected domain endpoint except `/api/auth/me`, `/api/auth/change-password`, and `/api/auth/logout` returns `403 PASSWORD_CHANGE_REQUIRED`.

## 5. Reference Data

- `GET /api/categories`
- `GET /api/related-systems`

Existing Lab 2 behavior remains, but calls are made inside authenticated application flows. Each endpoint returns an array in predictable order:

```json
[
  { "id": 1, "name": "Hardware" }
]
```

`GET /api/requesters` is retired from normal Lab 3 client behavior and must not be used to choose identity.

## 6. Authenticated Requester Ticket APIs

### POST `/api/tickets`

Continues Lab 2 Requester create behavior under authenticated identity and adds the reviewed retry-safe replay key. `requesterId` is always the authenticated Requester User id; any client-supplied requester identity field is rejected. Initial `currentStatus=NEW`, `ownerId=null`, `itPriority=requestedPriority`.

`clientRequestId` is introduced by Lab 3 because the verified Lab 2 repository/database baseline has no such Ticket column. The Lab 3 migration assigns each legacy Ticket a deterministic migration-only UUID (`00000000-0000-5000-8000-` plus its zero-padded 12-digit Ticket id), then enforces the same required global uniqueness used by all new Lab 3 Tickets. Every new authenticated create request must supply a client-generated UUID; Lab 3 does not use `(requesterId, clientRequestId)` composite uniqueness.

Request body:

```json
{
  "clientRequestId": "6e6f5842-4919-4ab8-aee8-8ad0fe5e6a11",
  "categoryId": 1,
  "relatedSystemId": 1,
  "summary": "Laptop battery drains quickly",
  "description": "The laptop loses power after one hour.",
  "requestedPriority": "MEDIUM"
}
```

Success `201`:

```json
{
  "id": 1,
  "ticketNumber": "TTK-20260915-0001",
  "clientRequestId": "6e6f5842-4919-4ab8-aee8-8ad0fe5e6a11",
  "currentStatus": "NEW",
  "currentStatusLabel": "New",
  "requesterId": 1,
  "requestedPriority": "MEDIUM",
  "itPriority": "MEDIUM",
  "owner": null,
  "replayed": false
}
```

Idempotency behavior:

- First valid globally unique `clientRequestId` submission creates exactly one Ticket and returns `201` with `replayed=false`.
- Repeating the same `clientRequestId` by the authenticated Requester who owns the original Ticket with the same normalized create payload returns that original Ticket with `200` and `replayed=true`; it does not allocate a new Ticket Number or row.
- Reusing the same `clientRequestId` with a different normalized payload, or attempting to reuse an id belonging to another Requester, returns `409 IDEMPOTENCY_CONFLICT`, does not modify/create a Ticket, and does not disclose the other Ticket.
- The comparison payload is the validated/normalized Category, Related System, trimmed Summary, trimmed Description, and Requested Priority. Authentication identity is checked against the original Ticket owner before any replay response is returned.
- `clientRequestId` must be a valid UUID; missing/invalid values return `400 VALIDATION_ERROR`.

Summary/description/reference-data/priority validation remains the approved Lab 2 contract. Any supplied `requesterId` is rejected as an invalid protected identity field rather than trusted.

### GET `/api/tickets/mine`

Authenticated replacement for `GET /api/requesters/:requesterId/tickets`. Existing Lab 2 requester list search/filter/sort/pagination behavior is preserved unless a reviewed contract change is documented.

Query parameters remain: `search`, `categoryId`, `relatedSystemId`, `requestedPriority`, `currentStatus`, `sortBy`, `sortDirection`, `page`, `pageSize`. Existing page sizes remain `5|10|20` for the Requester list.

Success `200`:

```json
{
  "items": [
    {
      "id": 1,
      "ticketNumber": "TTK-20260915-0001",
      "summary": "Laptop battery drains quickly",
      "category": { "id": 1, "name": "Hardware" },
      "relatedSystem": { "id": 1, "name": "Corporate Laptop" },
      "requestedPriority": "MEDIUM",
      "currentStatus": "NEW",
      "currentStatusLabel": "New",
      "updatedAt": "2026-09-15T08:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

### GET `/api/tickets/:ticketId`

Requester receives only owned Ticket Detail. Cross-requester/missing Ticket returns safe `404`.

Success `200`:

```json
{
  "id": 1,
  "ticketNumber": "TTK-20260915-0001",
  "summary": "Laptop battery drains quickly",
  "description": "The laptop loses power after one hour.",
  "requester": { "id": 1, "name": "Alice Requester", "email": "alice@example.com" },
  "category": { "id": 1, "name": "Hardware" },
  "relatedSystem": { "id": 1, "name": "Corporate Laptop" },
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "currentStatusLabel": "New",
  "problemAppearsResolvedAt": null,
  "createdAt": "2026-09-15T07:00:00.000Z",
  "updatedAt": "2026-09-15T08:00:00.000Z",
  "attachments": []
}
```

Requester detail intentionally omits primary owner, Internal Notes, and staff-only operational data unless a later approved UI contract explicitly needs a harmless read-only value.

### Attachment endpoints

- `GET /api/tickets/:ticketId/attachments`
- `POST /api/tickets/:ticketId/attachments`
- `GET /api/tickets/:ticketId/attachments/:attachmentId/download`
- `DELETE /api/tickets/:ticketId/attachments/:attachmentId`

Existing Lab 2 type, size, max-five, soft-removal, ownership, and removed-download rules continue. Authenticated Requester identity replaces requesterId path/context.

Attachment list/detail metadata keeps the Lab 2 DTO field names and lowercase `state` values:

```json
{
  "id": 1,
  "originalFilename": "error.png",
  "mimeType": "image/png",
  "sizeBytes": 12345,
  "uploadedAt": "2026-09-15T08:00:00.000Z",
  "removedAt": null,
  "removalReason": null,
  "state": "active",
  "downloadUrl": "/api/tickets/1/attachments/1/download"
}
```

Removed Attachments use `state="removed"` and omit `downloadUrl`. Upload returns one safe Attachment record with `201`, preserving the Lab 2 upload response field names (`id`, `ticketId`, `originalFilename`, `storedFilename`, `mimeType`, `sizeBytes`, `uploadedAt`, `removedAt`, removal-actor field, `removalReason`) while never returning `storagePath`. The removal-actor field is renamed from Lab 2 `removedByRequesterId` to `removedByUserId` because the foreign key now targets `User`; this intentional schema/DTO rename is part of the Lab 2 -> Lab 3 identity migration. Metadata list returns an array with `200`; soft-remove returns the removed metadata item with `200`; download returns the file body/content headers rather than JSON.

### GET `/api/tickets/:ticketId/comments`

Requester: owned Ticket only. IT Staff/Administrator: according to Staff Detail/read authorization. Returns oldest-to-newest Public Comments with safe author identity (`id`, `name`, `role`) and `createdAt`.

Success `200`:

```json
[
  {
    "id": 20,
    "content": "The issue still occurs after restart.",
    "author": { "id": 1, "name": "Alice Requester", "role": "REQUESTER" },
    "createdAt": "2026-09-15T08:05:00.000Z"
  }
]
```

### POST `/api/tickets/:ticketId/comments`

Requester may post only to owned Ticket. IT Staff may post to permitted Ticket. Administrator is read-only for Public Comments in this contract.

Request:

```json
{ "content": "Plain-text comment, 1-2000 characters after trimming." }
```

Author/timestamp are server-assigned. Success `201`.

Success response is the newly created Public Comment using the same item shape as the GET response.

### POST `/api/tickets/:ticketId/problem-appears-resolved`

Requester-owned Ticket only. Records indication timestamp/actor without changing `currentStatus`. Repeated request is idempotent and returns current indication `200`.

Success `200`:

```json
{
  "problemAppearsResolvedAt": "2026-09-15T08:30:00.000Z",
  "currentStatus": "WAITING_FOR_REQUESTER"
}
```

## 7. IT Staff Ticket Queue

### GET `/api/staff/tickets`

Role: IT Staff only.

Query parameters:

| Parameter | Contract |
|---|---|
| `search` | Optional, trimmed, <=100 chars; searches Ticket Number, Summary, Requester Name, Requester Email |
| `status` | Optional required enum value |
| `requestedPriority` | Optional `LOW|MEDIUM|HIGH|URGENT` |
| `itPriority` | Optional `LOW|MEDIUM|HIGH|URGENT` |
| `owner` | Optional `unassigned` or numeric User id |
| `categoryId` | Optional positive integer |
| `relatedSystemId` | Optional positive integer |
| `sortBy` | `updatedAt|createdAt|ticketNumber|requestedPriority|itPriority|status`; default `updatedAt` |
| `sortOrder` | `asc|desc`; default `desc` |
| `page` | Positive integer; default 1 |
| `pageSize` | `10|25|50`; default 10 |

Unknown/invalid query values return `400 INVALID_QUERY` rather than being silently ignored.

Response `200`:

```json
{
  "items": [
    {
      "id": 101,
      "ticketNumber": "TKT-...",
      "summary": "Cannot access VPN",
      "requester": { "id": 1, "name": "Alice", "email": "alice@example.com" },
      "requestedPriority": "HIGH",
      "itPriority": "HIGH",
      "currentStatus": "OPEN",
      "owner": { "id": 10, "name": "Sam Staff" },
      "createdAt": "2026-09-15T00:00:00.000Z",
      "updatedAt": "2026-09-15T01:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

Default tie-break after the selected sort is `id desc` for deterministic paging.

## 8. IT Staff Ticket Detail and Operations

### GET `/api/staff/tickets/:ticketId`

IT Staff: full Staff Detail payload. Administrator: read-only oversight payload may be returned when directly addressed; no Administrator Queue is exposed.

Payload includes Ticket/Requester/classification fields, Requested Priority, IT Priority, status, owner, Requester resolution indication, Attachments, Public Comments, and Internal Notes only when role permits.

Success `200`:

```json
{
  "id": 101,
  "ticketNumber": "TTK-20260915-0001",
  "summary": "Cannot access VPN",
  "description": "VPN login fails after entering credentials.",
  "requester": { "id": 1, "name": "Alice Requester", "email": "alice@example.com" },
  "category": { "id": 4, "name": "Network" },
  "relatedSystem": { "id": 2, "name": "VPN" },
  "requestedPriority": "HIGH",
  "itPriority": "URGENT",
  "currentStatus": "IN_PROGRESS",
  "currentStatusLabel": "In Progress",
  "owner": { "id": 10, "name": "Sam Staff", "role": "IT_STAFF" },
  "problemAppearsResolvedAt": null,
  "createdAt": "2026-09-15T07:00:00.000Z",
  "updatedAt": "2026-09-15T08:00:00.000Z",
  "attachments": [],
  "publicComments": [],
  "internalNotes": []
}
```

For Administrator read access, fields/actions not permitted by the authorization matrix are omitted or marked non-editable by the frontend; the backend still rejects forbidden mutations.

### POST `/api/staff/tickets/:ticketId/claim`

IT Staff only. Sets owner to current IT Staff only when currently unassigned. Conflict if already owned.

Success `200` returns:

```json
{ "owner": { "id": 10, "name": "Sam Staff", "role": "IT_STAFF" } }
```

### PATCH `/api/staff/tickets/:ticketId/owner`

IT Staff only.

```json
{ "ownerId": 12 }
```

`ownerId` may be `null` to unassign. Non-null target must be active IT Staff/Administrator. Reassignment from another owner requires client confirmation but backend authorization/validation is independent.

Success `200` returns `{ "owner": null }` or the safe owner object.

### PATCH `/api/staff/tickets/:ticketId/it-priority`

IT Staff or Administrator.

```json
{ "itPriority": "URGENT" }
```

Requested Priority is never modified by this endpoint.

Success `200`:

```json
{ "itPriority": "URGENT", "requestedPriority": "HIGH" }
```

### PATCH `/api/staff/tickets/:ticketId/status`

IT Staff only.

```json
{ "status": "IN_PROGRESS" }
```

Backend validates the specification transition matrix. `400 INVALID_TRANSITION` for a known but disallowed transition. Requester has no status endpoint.

Success `200`:

```json
{ "currentStatus": "IN_PROGRESS", "currentStatusLabel": "In Progress" }
```

### GET `/api/staff/tickets/:ticketId/internal-notes`

IT Staff or Administrator. Returns oldest-to-newest notes with safe author identity and backend timestamp.

Success `200`:

```json
[
  {
    "id": 5,
    "content": "Waiting for network-team confirmation.",
    "author": { "id": 10, "name": "Sam Staff", "role": "IT_STAFF" },
    "createdAt": "2026-09-15T08:10:00.000Z"
  }
]
```

### POST `/api/staff/tickets/:ticketId/internal-notes`

IT Staff only.

```json
{ "content": "Plain-text internal note, 1-2000 characters after trimming." }
```

Success `201`. Empty/whitespace/over-limit is `400`. Administrator read-only for notes in this contract.

Success response is the newly created note using the same item shape as the GET response.

## 9. Administrator User Management

### GET `/api/admin/users`

Administrator only. No mandatory pagination.

Query:

- `search`: optional trimmed <=100 chars; case-insensitive name/email search.
- `role`: optional `REQUESTER|IT_STAFF|ADMINISTRATOR`.

Returns an array of safe User rows. Never returns password/session fields.

```json
[
  {
    "id": 1,
    "name": "Alice Requester",
    "email": "alice@example.com",
    "role": "REQUESTER",
    "isActive": true,
    "createdAt": "2026-09-15T07:00:00.000Z",
    "updatedAt": "2026-09-15T07:00:00.000Z"
  }
]
```

### POST `/api/admin/users`

Administrator only.

```json
{
  "name": "New User",
  "email": "new.user@example.com",
  "role": "REQUESTER",
  "isActive": true,
  "initialPassword": "Lab3-ChangeMe-2026"
}
```

Success `201`; password is hashed, `mustChangePassword=true`. Duplicate normalized email `409`; invalid role/input `400`.

```json
{
  "id": 15,
  "name": "New User",
  "email": "new.user@example.com",
  "role": "REQUESTER",
  "isActive": true,
  "mustChangePassword": true,
  "createdAt": "2026-09-15T09:00:00.000Z",
  "updatedAt": "2026-09-15T09:00:00.000Z"
}
```

### PATCH `/api/admin/users/:userId`

Allowed body fields only: `name`, `email`, `role`, `isActive`. Reject password fields here.

Safety:

- Administrator cannot deactivate self (`409 SELF_DEACTIVATION_FORBIDDEN`).
- Any deactivation or role change that leaves zero active Administrators is `409 LAST_ACTIVE_ADMIN_REQUIRED`.
- Deactivating a User or changing the User's role revokes that target User's active sessions so stale authorization cannot continue.
- No delete endpoint exists.

Success `200` returns the updated safe User object using the POST response shape (without any password/hash value).

### POST `/api/admin/users/:userId/initial-password`

```json
{ "initialPassword": "Lab3-ChangeMe-2026" }
```

Administrator only. Hashes the password, sets `mustChangePassword=true`, revokes target User sessions. Success `200`.

Success response:

```json
{ "userId": 15, "mustChangePassword": true }
```

## 10. Authorization and Safe Error Matrix

| Condition | Status | Safe behavior |
|---|---:|---|
| No valid session | 401 | No protected payload |
| `mustChangePassword=true` on normal domain endpoint | 403 | `PASSWORD_CHANGE_REQUIRED`, no domain payload |
| Authenticated wrong role | 403 | Generic forbidden; no protected payload |
| Requester addresses another Requester's Ticket/Attachment | 404 | Same safe shape as missing owned resource |
| Requester addresses Internal Notes | 403 | No note count/content/existence information |
| Invalid body/query/transition | 400 | Field/query-safe validation only |
| Duplicate email / state conflict | 409 | Safe conflict code/message |
| Missing generally visible staff/admin resource | 404 | No database details |
| Unexpected error | 500 | Generic message; log details server-side only |

## 11. Retired Lab 2 Identity Contract

- Development Requester selector is removed.
- Client key `toktickit.devRequesterId` is removed/ignored and may be cleaned during migration.
- Normal Lab 3 client code does not call `GET /api/requesters`.
- Requester APIs no longer trust `:requesterId` path parameters or requesterId request fields for identity.
