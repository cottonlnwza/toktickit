# Lab 2 UI Specification

## 1. Visual Direction

TokTickIT Lab 2 uses a Zen Green interface that is quiet, professional, readable, and consistent across Create Ticket, My Tickets, Ticket Detail, Attachment, and Development Requester screens.

## 2. Color Tokens

| Token | Value | Intended use |
|---|---|---|
| Primary green | `#006B3C` | App header, primary actions, strong emphasis |
| Secondary green | `#0B7A46` | Active tabs, focus accents, links, hover states |
| Pale green | `#EAF6EF` | Selected, success, subtle section emphasis |
| Page background | `#F5F7F6` | Quiet near-white app background |
| Surface | `#FFFFFF` | Forms, list surfaces, cards |
| Border | `#D6E2DB` | Subtle surface and field borders |
| Text | `#1F352B` | Dark charcoal-green readable text |
| Muted text | `#5D6F65` | Secondary text |
| Read-only field | `#F3F2EA` | Clearly distinct read-only controls |
| Error | `#9F1D20` | Error text and borders |
| Warning | `#B7791F` | Warning callouts and badges only |
| Success | `#0B7A46` | Success confirmation with non-color indicator |

These token decisions are part of the draft UI contract. Rationale: they preserve the Lab Sheet Zen Green theme while adding named semantic uses for implementation and visual checks.

## 3. Typography and Spacing

- Use the existing Bootstrap foundation unless a later approved change introduces additional CSS.
- Labels appear above controls with consistent font weight and spacing.
- Body text must remain readable on mobile and desktop.
- Form groups use consistent vertical spacing.
- Cards and repeated items use restrained borders and shadows.

## 4. Application Shell and Navigation

- Show TokTickIT application identity.
- Provide navigation for My Tickets and Create Ticket.
- Show clear active-page indication.
- Show selected Development Requester identity.
- Provide Change Requester action.
- Use responsive mobile navigation that remains reachable and readable.

## 5. Development Requester Selection Screen

Required elements:

- TokTickIT title.
- Short explanation that the selector is for Lab 2 testing only and is not a login screen.
- Development Requester dropdown loaded from active PostgreSQL Requesters.
- Continue button.
- Loading state.
- Empty state when no active Requesters exist.
- Safe API-failure state.
- Keyboard-accessible form controls.
- Responsive Zen Green styling.
- Store selected Requester id in `toktickit.devRequesterId`.
- Revalidate stored Requester on app load.
- Clear selection and return to selector when the stored Requester is inactive, missing, or fails ownership checks.
- On Change Requester, clear requester-owned in-memory state and reload for the new Requester.

Suggested explanatory text from Lab Sheet may be adapted without copying the entire handout.

## 6. Create Ticket Screen

| Area | Fields / controls | Behavior |
|---|---|---|
| Read-only header | Ticket Number, Ticket Date, Requester | Ticket Number/date are pending before create; Requester comes from selected context |
| Classification | Category, Related System, Requested Priority | Required select controls with database-loaded options where applicable |
| Description | Ticket Summary, Description | Summary is single-line; Description is multiline and larger |
| Attachments | File selector and selected-file list | Validate type, size, and max-five count before upload |
| Actions | Submit, Cancel/Clear secondary action | Submit is primary; secondary action must not look destructive |

States:

- Initial: empty editable fields, selected Requester visible, reference data loaded or loading.
- Loading reference data: controls disabled with status message.
- Validation failure: field-level messages near fields.
- Submitting: Submit button disabled with busy text.
- Ticket create success: generated Ticket Number displayed; attachment upload begins only after Ticket exists.
- Attachment upload failure after create: Ticket remains created; failed Attachment row shows retry/remove guidance.
- API failure before Ticket creation: preserve entered form values and show safe error.

## 7. My Tickets Screen

- Include search, filters, sorting, clear filters, pagination, and Create Ticket action.
- Desktop may use a table.
- Mobile may use cards or responsive-table behavior.
- Show enough information to identify and open a Ticket.
- Fields shown: Ticket Number, Summary, Category, Related System, Requested Priority, Current Status, Last Updated.
- Include loading, empty, no-results, and failure states.

## 8. Requester Ticket Detail Screen

- Ticket fields are read-only.
- Ticket information is visually separate from Attachment actions.
- Provide navigation back to My Tickets.
- Provide Attachment section for active, uploading, invalid, removed, and unavailable states.
- Do not include Public Comments, Internal Notes, Actions Taken, or status workflow features.

## 9. Component States

- Editable controls use white background and neutral border.
- Read-only controls use soft gray-green or warm ivory shading.
- Invalid controls use dark red border and message immediately below the field.
- Disabled controls are visually distinct and cannot be activated.
- Focus indicators remain visible for keyboard users.
- Required fields show a red asterisk; the asterisk does not replace validation text.
- Buttons include visible text. Icons may support text, but unclear icon-only controls require accessible label and tooltip.

## 9.1 Button Hierarchy

| Button type | Use | Required behavior |
|---|---|---|
| Primary | Continue, Submit Ticket, Upload/Retry Attachment | Primary green, busy state when processing |
| Secondary | Change Requester, Back to My Tickets, Clear Filters | Neutral or outline style, lower emphasis than primary |
| Tertiary | Cancel optional local action | Text or subtle button where safe |
| Destructive | Remove Attachment confirmation | Red/danger styling and confirmation required |
| Disabled | Invalid or processing state | Visually distinct and not clickable |

## 10. Attachment Presentation

- Show original filename, type, size, upload timestamp, and state.
- Valid selected Attachments are distinguishable from invalid selections.
- Invalid Attachment errors appear near the Attachment control.
- Removed Attachments remain visible as metadata and cannot expose preview/download actions.
- Long filenames must wrap or truncate safely without making the row/card unusable.
- Upload failure rows show a safe message and provide retry/remove choices.
- Removed rows show removal reason and removed timestamp.

## 11. Responsive Rules

| Viewport | Required behavior |
|---|---|
| Desktop `>= 992px` | Multi-column layout as specified; content centered with sensible maximum width |
| Tablet `768-991px` | Two-column layout where practical; Summary and Description keep enough width |
| Mobile `< 768px` | Fields stack vertically; buttons remain touch-friendly; no horizontal page scrolling |
| All sizes | No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names |

## 12. Accessibility Rules

- Inputs, selects, buttons, links, and attachment controls must have accessible names.
- Error messages must be associated with fields where practical.
- Keyboard users must be able to reach and operate primary workflows.
- Visible focus must not be removed.
- Status and error messages should use semantic roles where appropriate.
- Do not rely on color alone for success, warning, error, status, or priority.

## 13. Badge Rules

- Requested Priority badges use text plus color.
- Current Status badge for Lab 2 displays `New`.
- IT Priority may appear only if required for read-only/reference display; no IT Staff workflow may be added.
- Badge styles must remain readable against surface backgrounds.

## 14. Visual Inspection Checklist and Screenshot Paths

| Area | Screenshot path | Checks |
|---|---|---|
| Create Ticket | `artifacts/lab-02/screenshots/create-ticket/` | Initial, validation, invalid attachment, submitting, success, API failure |
| My Tickets | `artifacts/lab-02/screenshots/my-tickets/` | Requester A/B, search, filters, sort, pagination, empty, no-results |
| Ticket Detail | `artifacts/lab-02/screenshots/ticket-detail/` | Read-only detail, add/download/remove Attachment, unauthorized access |
| Responsive | `artifacts/lab-02/screenshots/responsive/` | Desktop, tablet, mobile, no clipping/overlap/horizontal overflow |

## 15. UI Decisions

- Field grouping follows Section 6. Rationale: keeps generated/read-only data separate from user input.
- My Tickets fields are Ticket Number, Summary, Category, Related System, Requested Priority, Current Status, and Last Updated. Rationale: enough context to identify and open a ticket.
- CSS implementation starts from Bootstrap plus scoped Lab 2 CSS if needed. Rationale: preserves Lab 1 stack while allowing Zen Green tokens.
- Priority badge ordering is LOW, MEDIUM, HIGH, URGENT. Rationale: matches data contract and sorting.
- Attachment long filenames wrap within mobile cards and truncate with accessible full-name text on dense desktop rows. Rationale: prevents overflow while preserving inspectability.
- USER CONFIRMATION REQUIRED: final visual polish must be checked against screenshots before final submission.
