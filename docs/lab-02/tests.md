# Lab 2 Test Plan and Results

## 1. Test Strategy

Lab 2 uses Test DD and TDD. This file defines the required evidence before implementation is declared complete. For each feature issue, automated tests must be written and observed failing for the expected missing behavior before implementation makes them pass. Final results remain pending until tests are run on final `main`.

## 2. Planned Tests

| Test ID | Test level | Scenario | Expected result | Planned test-file path | Related AC | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | Generate Ticket Number for a valid create date and sequence | Unique number matches approved format | `server/tests/lab-02/ticket-number.test.ts` | AC-05 | Pass |
| UNIT-02 | Unit | Trim and validate Summary and Description boundaries | Valid boundaries pass; invalid boundaries fail | `server/tests/lab-02/ticket-validation.test.ts` | AC-07, AC-08 | Pass |
| SEED-01 | API/Integration | Run Lab 2 seed repeatedly and inspect seeded reference data | Seed is idempotent; exactly four required Categories exist; at least six Related Systems exist; at least four active Requesters and at least one inactive Requester exist; inactive Requesters are excluded from selector results | `server/tests/lab-02/seed.test.ts` | AC-01 | Pass |
| API-01 | API/Integration | Retrieve active Development Requesters | HTTP 200; inactive requester omitted | `server/tests/lab-02/requesters.api.test.ts` | AC-01 | Pass |
| API-02 | API/Integration | Create valid Ticket | HTTP 201; one requester-owned Ticket saved; number returned | `server/tests/lab-02/create-ticket.api.test.ts` | AC-04, AC-05, AC-06 | Pass |
| API-03 | API/Integration | Reject invalid create request | HTTP 400; safe validation details; no invalid Ticket saved | `server/tests/lab-02/create-ticket.api.test.ts` | AC-07, AC-08 | Pass |
| API-04 | API/Integration | Persist valid create-time Attachments | Attachments are linked to created Ticket | `server/tests/lab-02/create-ticket.api.test.ts` | AC-11 | Pass |
| API-05 | API/Integration | Reject invalid Attachment type, size, and max-five boundary | HTTP 400 or 413; safe error; no invalid active Attachment | `server/tests/lab-02/create-ticket.api.test.ts` | AC-12 | Pass |
| API-06 | API/Integration | Retrieve requester-owned Tickets with search/filter/sort/page | HTTP 200; requester-owned paginated results and metadata; priority ascending is LOW -> MEDIUM -> HIGH -> URGENT and descending is URGENT -> HIGH -> MEDIUM -> LOW | `server/tests/lab-02/my-tickets.api.test.ts` | AC-13, AC-15 | Pass |
| API-07 | API/Integration | Reject cross-requester Ticket access | Safe ownership failure response | `server/tests/lab-02/ticket-detail.api.test.ts` | AC-14 | Pass |
| API-08 | API/Integration | Retrieve owned Ticket Detail | HTTP 200; read-only detail payload | `server/tests/lab-02/ticket-detail.api.test.ts` | AC-18 | Pass |
| API-09 | API/Integration | Upload, download, soft-remove, and block removed Attachment | Active download works; removed metadata remains; removed download blocked | `server/tests/lab-02/attachments.api.test.ts` | AC-19, AC-20, AC-21 | Pass |
| API-10 | API/Integration | Reject cross-requester Attachment access | Safe ownership failure response | `server/tests/lab-02/attachments.api.test.ts` | AC-22 | Pass |
| UI-01 | UI Component | Development Requester selector loads active choices | Dropdown shows active Requesters and not inactive Requesters | `client/tests/lab-02/RequesterSelector.test.tsx` | AC-01, AC-02 | Pass |
| UI-02 | UI Component | Selected Requester appears in app shell | Name and Change Requester action are visible | `client/tests/lab-02/RequesterContext.test.tsx` | AC-03 | Pass |
| UI-03 | UI Component | Create Ticket valid submit flow | Submit busy state then success with Ticket Number | `client/tests/lab-02/CreateTicket.test.tsx` | AC-04, AC-05, AC-09 | Pass |
| UI-04 | UI Component | Create Ticket validation and API failure | Field messages appear; failed API keeps form values | `client/tests/lab-02/CreateTicket.test.tsx` | AC-07, AC-10, AC-12 | Pass |
| UI-05 | UI Component | My Tickets requester switching and controls | Previous requester Tickets disappear; controls update results | `client/tests/lab-02/MyTickets.test.tsx` | AC-13, AC-15, AC-16, AC-17 | Pass |
| UI-06 | UI Component | Ticket Detail read-only view and Attachment states | Detail is read-only; active/removed/unavailable states render | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | AC-18, AC-19, AC-21 | Pass |
| UI-07 | UI Component | Attachment section upload retry, invalid, active, removed, and unavailable states | AttachmentSection renders required states and retry guidance | `client/tests/lab-02/AttachmentSection.test.tsx` | AC-12, AC-19, AC-20, AC-21, AC-22 | Pass |
| UI-08 | UI Component | Requester selection missing, inactive, reload, and switching behavior | Stored invalid requester is cleared; switching reloads requester-owned data | `client/tests/lab-02/RequesterContext.test.tsx` | AC-02, AC-03, AC-13 | Pass |
| UI-09 | UI Component | My Tickets loading, empty, no-results, and failure states | Correct state-specific feedback appears | `client/tests/lab-02/MyTickets.test.tsx` | AC-15, AC-16, AC-17 | Pass |
| STYLE-01 | UI Style | Required labels, asterisks, messages, field states, and button hierarchy | Required UI classes/states are present | `client/tests/lab-02/ui-style.test.tsx` | AC-23, AC-24 | Pass |
| RESP-01 | Responsive | Desktop viewport `>= 992px` | No clipping, overlap, hidden buttons, or horizontal scrolling | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-23 | Pass |
| RESP-02 | Responsive | Tablet viewport `768-991px` | Layout remains usable with readable fields and attachments | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-23 | Pass |
| RESP-03 | Responsive | Mobile viewport `< 768px` | Fields stack; touch controls usable; no horizontal scrolling | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-23 | Pass |
| E2E-01 | E2E | Full requester flow from selector to create, list, detail, attachment removal | Flow succeeds and enforces requester ownership | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-01, AC-04, AC-13, AC-18, AC-21, AC-22 | Pass |
| E2E-02 | E2E | One Attachment upload fails after successful Ticket creation, then is retried | Ticket remains created; failed file displays Retry/Remove; retry succeeds without creating the Ticket again | `e2e/lab-02/requester-ticket-flow.spec.ts` | AC-04, AC-12, AC-19 | Pass |
| DOC-01 | Documentation | Final reviewer and AI-use documents contain only real evidence | No invented PR, review, prompt, or approval evidence | `docs/lab-02/reviewer.md`, `docs/lab-02/ai-use.md` | AC-25 | Pass |

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
| AC-11 | API-04 |
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

- [x] Desktop `>= 992px`: content centered with sensible max width.
- [x] Tablet `768-991px`: My Tickets uses complete cards; other screens retain practical responsive columns.
- [x] Mobile `< 768px`: fields stack vertically and buttons remain touch-friendly.
- [x] No horizontal page scrolling in Playwright viewport checks.
- [x] No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names in inspected screenshots.
- [x] Required markers and validation messages are placed near fields.
- [x] Editable, read-only, invalid, disabled, focused, busy, success, and failure states are visually distinct.
- [x] Icons do not replace unclear text; controls retain accessible names.
- [x] Badges are consistent for Requested Priority and Current Status.
- [x] Empty-list and no-results states are visually distinct.
- [x] Attachment upload failure shows retry/remove guidance without losing the created Ticket.

## 5. Test Commands

Final verification commands:

```bash
npm test --prefix server
npm test --prefix client
```

Playwright/E2E is required by Lab 2 and is configured at the repository root.
Dependency change note: Playwright was added in commit `47cbfae` for Issue #22
E2E coverage. No separate pre-install proposal/approval evidence could be
verified before that commit, so this is recorded as a process deviation /
evidence gap. The Issue #22 permalink records the later approval/evidence
correction: https://github.com/cottonlnwza/toktickit/issues/22#issuecomment-5549715288

Installed scope: root-level `@playwright/test`, Playwright Chromium runtime,
`playwright.config.ts`, `e2e/lab-02/requester-ticket-flow.spec.ts`, and
`.gitignore` entries for generated Playwright output.

```bash
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts
```

## 6. Final Results

These results were recorded on the Issue #22 feature branch on 5 September 2026. Run the same commands again on final `main` before submission.

| Command | Result | Notes |
|---|---|---|
| `npm test --prefix server` | Pass | 10 files, 42 tests passed |
| `npm test --prefix client` | Pass | 8 files, 45 tests passed |
| `npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts` | Pass | 6 tests passed across desktop, tablet, and mobile projects |
| `npm run build --prefix server` | Pass | TypeScript build completed |
| `npm run build --prefix client` | Pass | TypeScript and Vite production build completed |

## 7. Known Limitations or Deferred Tests

- Final test counts and commands must be recorded after the last verification run and rerun on final `main`.
- Peer reviewer identity, final approval, and release-PR evidence remain pending until those events occur.
- No test may be reconstructed afterward from whatever implementation happens to exist.
- Required minimum test-file coverage includes `server/tests/lab-02/seed.test.ts`, `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/ticket-detail.api.test.ts`, `server/tests/lab-02/attachments.api.test.ts`, `client/tests/lab-02/CreateTicket.test.tsx`, `client/tests/lab-02/MyTickets.test.tsx`, `client/tests/lab-02/RequesterTicketDetail.test.tsx`, `client/tests/lab-02/AttachmentSection.test.tsx`, and `e2e/lab-02/requester-ticket-flow.spec.ts`.

### Answer Parts 1-9 Evidence Checklist

- [ ] Answer Part 1: final `main` commit graph, completed Kanban, rendered `reviewer.md`, README, `.gitignore`, and repository tree. Final release evidence is pending.
- [x] Answer Part 2: rendered `specification.md`, numbered FR/BR/AC/DoD, and PR #23 history showing the contract preceded implementation PRs.
- [ ] Answer Part 3: rendered `tests.md` and complete unit/API/UI output. Final `main` rerun evidence is pending.
- [x] Answer Part 4: rendered `ai-use.md` with seven selected prompts and brief reflection.
- [x] Answer Part 5: Development Requester selector evidence is included with Create Ticket evidence.
- [ ] Answer Part 6: Pending complete screenshot evidence for Create Ticket validation, submitting, success, and API failure states; current automated API/UI evidence is listed above.
- [ ] Answer Part 7: Pending complete screenshot evidence for Requester A/B ownership, empty list, and no-results My Tickets states; ownership and query tests are listed above.
- [ ] Answer Part 8: Pending complete screenshot evidence for unauthorized access and invalid attachment states; ownership and lifecycle tests are listed above.
- [ ] Answer Part 9: Pending complete visual evidence package until Answer Parts 6-8 screenshots are complete; responsive desktop/tablet/mobile screenshots exist under `artifacts/lab-02/screenshots/`.
- [ ] Final PDF: compile Answer Part 1 through Answer Part 9 in the required order after the release PR and final `main` verification.
