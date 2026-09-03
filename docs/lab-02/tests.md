# Lab 2 Test Plan and Results

## 1. Test Strategy

Lab 2 uses Test DD and TDD. This file defines the required evidence before implementation is declared complete. For each feature issue, automated tests must be written and observed failing for the expected missing behavior before implementation makes them pass. Final results remain pending until tests are run on final `main`.

## 2. Planned Tests

| Test ID | Test level | Scenario | Expected result | Planned test-file path | Related AC | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | Generate Ticket Number for a valid create date and sequence | Unique number matches approved format | `server/tests/lab-02/ticket-number.test.ts` | AC-05 | Pending |
| UNIT-02 | Unit | Trim and validate Summary and Description boundaries | Valid boundaries pass; invalid boundaries fail | `server/tests/lab-02/ticket-validation.test.ts` | AC-07, AC-08 | Pending |
| SEED-01 | API/Integration | Run Lab 2 seed repeatedly and inspect seeded reference data | Seed is idempotent; exactly four required Categories exist; at least six Related Systems exist; at least four active Requesters and at least one inactive Requester exist; inactive Requesters are excluded from selector results | `server/tests/lab-02/seed.test.ts` | AC-01 | Pending |
| API-01 | API/Integration | Retrieve active Development Requesters | HTTP 200; inactive requester omitted | `server/tests/lab-02/requesters.api.test.ts` | AC-01 | Pending |
| API-02 | API/Integration | Create valid Ticket | HTTP 201; one requester-owned Ticket saved; number returned | `server/tests/lab-02/create-ticket.api.test.ts` | AC-04, AC-05, AC-06 | Pending |
| API-03 | API/Integration | Reject invalid create request | HTTP 400; safe validation details; no invalid Ticket saved | `server/tests/lab-02/create-ticket.api.test.ts` | AC-07, AC-08 | Pending |
| API-04 | API/Integration | Persist valid create-time Attachments | Attachments are linked to created Ticket | `server/tests/lab-02/create-ticket.api.test.ts` | AC-11 | Pending |
| API-05 | API/Integration | Reject invalid Attachment type, size, and max-five boundary | HTTP 400 or 413; safe error; no invalid active Attachment | `server/tests/lab-02/create-ticket.api.test.ts` | AC-12 | Pending |
| API-06 | API/Integration | Retrieve requester-owned Tickets with search/filter/sort/page | HTTP 200; requester-owned paginated results and metadata; priority ascending is LOW -> MEDIUM -> HIGH -> URGENT and descending is URGENT -> HIGH -> MEDIUM -> LOW | `server/tests/lab-02/my-tickets.api.test.ts` | AC-13, AC-15 | Pending |
| API-07 | API/Integration | Reject cross-requester Ticket access | Safe ownership failure response | `server/tests/lab-02/ticket-detail.api.test.ts` | AC-14 | Pending |
| API-08 | API/Integration | Retrieve owned Ticket Detail | HTTP 200; read-only detail payload | `server/tests/lab-02/ticket-detail.api.test.ts` | AC-18 | Pending |
| API-09 | API/Integration | Upload, download, soft-remove, and block removed Attachment | Active download works; removed metadata remains; removed download blocked | `server/tests/lab-02/attachments.api.test.ts` | AC-19, AC-20, AC-21 | Pending |
| API-10 | API/Integration | Reject cross-requester Attachment access | Safe ownership failure response | `server/tests/lab-02/attachments.api.test.ts` | AC-22 | Pending |
| UI-01 | UI Component | Development Requester selector loads active choices | Dropdown shows active Requesters and not inactive Requesters | `client/tests/lab-02/RequesterSelector.test.tsx` | AC-01, AC-02 | Pending |
| UI-02 | UI Component | Selected Requester appears in app shell | Name and Change Requester action are visible | `client/tests/lab-02/RequesterContext.test.tsx` | AC-03 | Pending |
| UI-03 | UI Component | Create Ticket valid submit flow | Submit busy state then success with Ticket Number | `client/tests/lab-02/CreateTicket.test.tsx` | AC-04, AC-05, AC-09 | Pending |
| UI-04 | UI Component | Create Ticket validation and API failure | Field messages appear; failed API keeps form values | `client/tests/lab-02/CreateTicket.test.tsx` | AC-07, AC-10, AC-12 | Pending |
| UI-05 | UI Component | My Tickets requester switching and controls | Previous requester Tickets disappear; controls update results | `client/tests/lab-02/MyTickets.test.tsx` | AC-13, AC-15, AC-16, AC-17 | Pending |
| UI-06 | UI Component | Ticket Detail read-only view and Attachment states | Detail is read-only; active/removed/unavailable states render | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | AC-18, AC-19, AC-21 | Pending |
| UI-07 | UI Component | Attachment section upload retry, invalid, active, removed, and unavailable states | AttachmentSection renders required states and retry guidance | `client/tests/lab-02/AttachmentSection.test.tsx` | AC-12, AC-19, AC-20, AC-21, AC-22 | Pending |
| UI-08 | UI Component | Requester selection missing, inactive, reload, and switching behavior | Stored invalid requester is cleared; switching reloads requester-owned data | `client/tests/lab-02/RequesterContext.test.tsx` | AC-02, AC-03, AC-13 | Pending |
| UI-09 | UI Component | My Tickets loading, empty, no-results, and failure states | Correct state-specific feedback appears | `client/tests/lab-02/MyTickets.test.tsx` | AC-15, AC-16, AC-17 | Pending |
| STYLE-01 | UI Style | Required labels, asterisks, messages, field states, and button hierarchy | Required UI classes/states are present | `client/tests/lab-02/ui-style.test.tsx` | AC-23, AC-24 | Pending |
| RESP-01 | Responsive | Desktop viewport `>= 992px` | No clipping, overlap, hidden buttons, or horizontal scrolling | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-23 | Pending |
| RESP-02 | Responsive | Tablet viewport `768-991px` | Layout remains usable with readable fields and attachments | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-23 | Pending |
| RESP-03 | Responsive | Mobile viewport `< 768px` | Fields stack; touch controls usable; no horizontal scrolling | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-23 | Pending |
| E2E-01 | E2E | Full requester flow from selector to create, list, detail, attachment removal | Flow succeeds and enforces requester ownership | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-01, AC-04, AC-13, AC-18, AC-21, AC-22 | Pending |
| E2E-02 | E2E | Partial attachment failure after successful Ticket creation | Ticket remains created; successful uploads remain active; failed upload creates no active Attachment record; failed file displays Retry/Remove; retry does not create the Ticket again | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-04, AC-11, AC-12, AC-19 | Pending |
| DOC-01 | Documentation | Final reviewer and AI-use documents contain only real evidence | No invented PR, review, prompt, or approval evidence | `docs/lab-02/reviewer.md`, `docs/lab-02/ai-use.md` | AC-25 | Pending |

## 3. Acceptance-Criterion Traceability

| Acceptance Criterion | Planned Tests |
|---|---|
| AC-01 | SEED-01, API-01, UI-01, E2E-01 |
| AC-02 | UI-01 |
| AC-03 | UI-02, UI-08 |
| AC-04 | API-02, UI-03, E2E-01, E2E-02 |
| AC-05 | UNIT-01, API-02, UI-03 |
| AC-06 | API-02 |
| AC-07 | UNIT-02, API-03, UI-04 |
| AC-08 | UNIT-02, API-03 |
| AC-09 | UI-03 |
| AC-10 | UI-04 |
| AC-11 | API-04, E2E-02 |
| AC-12 | API-05, UI-04, UI-07, E2E-02 |
| AC-13 | API-06, UI-05, UI-08, E2E-01 |
| AC-14 | API-07 |
| AC-15 | API-06, UI-05, UI-09 |
| AC-16 | UI-05, UI-09 |
| AC-17 | UI-05, UI-09 |
| AC-18 | API-08, UI-06, E2E-01 |
| AC-19 | API-09, UI-06, UI-07, E2E-02 |
| AC-20 | API-09, UI-07 |
| AC-21 | API-09, UI-06, UI-07, E2E-01 |
| AC-22 | API-10, UI-07, E2E-01 |
| AC-23 | STYLE-01, RESP-01, RESP-02, RESP-03 |
| AC-24 | STYLE-01 |
| AC-25 | DOC-01 |

## 4. Responsive and Visual Checklist

- [ ] Desktop `>= 992px`: content centered with sensible max width.
- [ ] Tablet `768-991px`: two-column layout where practical.
- [ ] Mobile `< 768px`: fields stack vertically and buttons remain touch-friendly.
- [ ] No horizontal page scrolling.
- [ ] No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names.
- [ ] Required markers and validation messages are placed near fields.
- [ ] Editable, read-only, invalid, disabled, focused, busy, success, and failure states are visually distinct.
- [ ] Icons do not replace unclear text; icon-only controls have accessible label and tooltip.
- [ ] Badges are consistent for Requested Priority and Current Status.
- [ ] Empty-list and no-results states are visually distinct.
- [ ] Attachment upload failure shows retry/remove guidance without losing the created Ticket.

## 5. Test Commands

Planned commands, subject to implementation and dependency approval:

```bash
npm test --prefix server
npm test --prefix client
```

Playwright/E2E is required by Lab 2. If Playwright is not already installed when Issue 7 starts, create a separate Dependency Change Proposal before installation.

```bash
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts
```

## 6. Final Results

Final results are pending. Do not mark any Lab 2 test as Passed until the test exists and has been run successfully.

| Command | Result | Notes |
|---|---|---|
| `npm test --prefix server` | Pending | Run after implementation and on final `main` |
| `npm test --prefix client` | Pending | Run after implementation and on final `main` |
| `npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts` | Pending | Required E2E scope |

## 7. Known Limitations or Deferred Tests

- Playwright dependency status must be verified before Issue 7 implementation.
- Final pass/fail status is intentionally pending.
- No test may be reconstructed afterward from whatever implementation happens to exist.
- Required minimum test-file coverage includes `server/tests/lab-02/seed.test.ts`, `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/ticket-detail.api.test.ts`, `server/tests/lab-02/attachments.api.test.ts`, `client/tests/lab-02/CreateTicket.test.tsx`, `client/tests/lab-02/MyTickets.test.tsx`, `client/tests/lab-02/RequesterTicketDetail.test.tsx`, `client/tests/lab-02/AttachmentSection.test.tsx`, and `e2e/lab-02/requester-ticket-flow.spec.ts`.
