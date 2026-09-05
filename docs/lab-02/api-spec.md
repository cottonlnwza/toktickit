# Lab 2 REST API Contract

## 1. API Principles

- API style is REST.
- Responses must use safe error messages without internal details.
- Requester ownership must be enforced on every requester-owned Ticket and Attachment endpoint.
- Validation must be consistent with `specification.md` and tested in `tests.md`.
- Endpoint paths and payload shapes in this document are approved contract decisions for the draft review.

## 2. Shared Status Codes

| Status | Use |
|---|---|
| 200 | Successful retrieval or successful non-create action |
| 201 | Resource created successfully |
| 400 | Invalid input or invalid query parameter |
| 404 | Missing resource or ownership failure where resource existence should not be confirmed |
| 409 | Conflict such as duplicate or state conflict |
| 413 | File exceeds permitted size |
| 415 | Unsupported file type |
| 500 | Unexpected server error with safe message |

## 3. Reference Data

### GET `/api/categories`

Returns active categories as `{ id, name }[]` in predictable order. This extends the existing Lab 1 behavior without breaking it.

Errors: `500` safe message when reference data cannot load.

### GET `/api/related-systems`

Returns active Related Systems as `{ id, name }[]` in predictable order.

Errors: `500` safe message when reference data cannot load.

### GET `/api/requesters`

Returns active Development Requesters only.

Success response:

```json
[
  { "id": 1, "name": "Example Requester", "email": "requester@example.test" }
]
```

Validation: no request parameters. Errors: `500` safe message. Ownership: not requester-owned, but inactive Requesters are excluded.

## 4. Create Ticket

### POST `/api/tickets`

Creates one Ticket for the selected Development Requester.

Request body:

```json
{
  "requesterId": 1,
  "categoryId": 1,
  "relatedSystemId": 1,
  "summary": "Laptop battery drains quickly",
  "description": "The laptop loses power after one hour.",
  "requestedPriority": "MEDIUM"
}
```

Success response:

```json
{
  "id": 1,
  "ticketNumber": "TTK-20260903-0001",
  "currentStatus": "NEW",
  "currentStatusLabel": "New",
  "requesterId": 1
}
```

Validation failures must identify invalid fields safely. Ticket creation does not receive files. The UI creates the Ticket first, then uploads each Attachment with multipart requests linked to the created Ticket.

Validation:

- `requesterId`, `categoryId`, and `relatedSystemId` are required existing records.
- Requester must be active.
- Summary is trimmed and must be 5-120 characters.
- Description is trimmed and must be 20-2000 characters.
- Requested Priority must be `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.

Errors: `400` validation, `404` inactive/missing selected records where appropriate, `500` safe unexpected error.

## 5. My Tickets

### GET `/api/requesters/:requesterId/tickets`

Returns only Tickets owned by the selected Requester.

Query parameters:

| Parameter | Purpose |
|---|---|
| `search` | Search Ticket Number, Summary, Category, and Related System |
| `categoryId` | Filter by Category |
| `relatedSystemId` | Filter by Related System |
| `requestedPriority` | Filter by Requested Priority |
| `currentStatus` | Filter by Current Status |
| `sortBy` | Sort field; `requestedPriority` uses business urgency order where ascending is `LOW` -> `MEDIUM` -> `HIGH` -> `URGENT` and descending is `URGENT` -> `HIGH` -> `MEDIUM` -> `LOW` |
| `sortDirection` | `asc` or `desc` |
| `page` | One-based page number |
| `pageSize` | One of `5`, `10`, `20` |

Success response:

```json
{
  "items": [
    {
      "id": 1,
      "ticketNumber": "TTK-20260903-0001",
      "summary": "Laptop battery drains quickly",
      "category": { "id": 1, "name": "Hardware" },
      "relatedSystem": { "id": 1, "name": "Corporate Laptop" },
      "requestedPriority": "MEDIUM",
      "currentStatus": "NEW",
      "currentStatusLabel": "New",
      "updatedAt": "2026-09-03T12:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

Validation: invalid query parameters return `400`. Ownership: requester filter is applied before search/filter/sort/page. Errors: safe `404` for missing Requester, `500` for unexpected failure.

## 6. Ticket Detail

### GET `/api/requesters/:requesterId/tickets/:ticketId`

Returns one owned Ticket Detail. Ticket fields are read-only in the requester UI. If the Ticket does not exist or is not owned by the Requester, return safe `404`.

Success response includes Ticket fields, Category, Related System, Requester summary, and Attachment metadata. It does not include edit permissions, comments, IT Staff workflow, or status actions.

Validation: ids must be numeric. Errors: `400` invalid ids, `404` missing or ownership failure, `500` safe unexpected error.

## 7. Attachment Metadata

### GET `/api/requesters/:requesterId/tickets/:ticketId/attachments`

Returns Attachment metadata for an owned Ticket, including removed metadata. Removed Attachments must not include preview/download URLs.

Success item fields: `id`, `originalFilename`, `mimeType`, `sizeBytes`, `uploadedAt`, `removedAt`, `removalReason`, `state`, and active-only `downloadUrl`.

Ownership: requester must own the parent Ticket. Errors: `400` invalid ids, `404` missing/ownership failure, `500` safe unexpected error.

## 8. Upload Attachment

### POST `/api/requesters/:requesterId/tickets/:ticketId/attachments`

Uploads one permitted Attachment to an owned Ticket. The endpoint validates ownership, file type, file size, and active attachment count.

Success response returns Attachment metadata.

Request: multipart form data with one `file` field.

Validation:

- Allowed types: JPG/JPEG, PNG, WEBP, PDF.
- Maximum size: 5 MB.
- Maximum active Attachments per Ticket: five.
- Original filename is stored as metadata only.
- Stored filename is generated by the server from UUID plus validated extension.

Errors: `400` missing file or max count, `413` oversized file, `415` unsupported type, `404` missing/ownership failure, `500` safe unexpected error. If DB persistence fails after file write, remove only the newly written file as compensation.

## 9. Download Attachment

### GET `/api/requesters/:requesterId/tickets/:ticketId/attachments/:attachmentId/download`

Downloads an active Attachment for an owned Ticket. Removed Attachments and cross-requester access return safe failure responses.

Validation: ids must be numeric. Errors: `400` invalid ids, `404` missing/ownership/removed attachment, `500` safe unexpected error. Response must not expose storage paths.

## 10. Soft-Remove Attachment

### DELETE `/api/requesters/:requesterId/tickets/:ticketId/attachments/:attachmentId`

Soft-removes an active Attachment. Request body includes removal reason.

Request body:

```json
{ "reason": "Uploaded the wrong file" }
```

Success response returns removed metadata. The stored file must not be previewed or downloaded after removal.

Validation: reason is required after trimming. Errors: `400` invalid reason, `404` missing/ownership/removed attachment, `409` already removed when distinguished by contract, `500` safe unexpected error.

## 11. Error Shape

Error response shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "summary": "Summary is required."
    }
  }
}
```

Unexpected server errors must use a safe generic message and must not expose stack traces, SQL, filesystem paths, environment values, secrets, or tokens.

## 12. Ownership Rules

- Requester ownership is checked on the backend for Ticket list, detail, Attachment metadata, download, upload, and soft removal.
- Ownership filtering occurs before search, filter, sort, and pagination.
- Ownership failure response is `404` to avoid confirming another Requester's resource exists.
