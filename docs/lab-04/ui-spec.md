# Lab 4 UI Specification

Status: Proposed Sprint 4 UI contract for Issue #63. Lab 4 extends the existing Zen Green application and does not introduce a second visual system.

## 1. Existing Visual Foundation

Reuse the Lab 3 tokens and component conventions unless this document explicitly extends them.

| Token | Value | Use |
|---|---|---|
| Primary green | `#006B3C` | Header, primary actions, strong emphasis |
| Secondary green | `#0B7A46` | Active navigation, focus/hover accents, links |
| Pale green | `#EAF6EF` | Selected/success/subtle emphasis |
| Page background | `#F5F7F6` | Application background |
| Surface | `#FFFFFF` | Cards, forms, tables |
| Border | `#D6E2DB` | Field/surface boundaries |
| Text | `#1F352B` | Main readable text |
| Muted text | `#5D6F65` | Secondary information |
| Read-only | `#F3F2EA` | Server-generated/non-editable values |
| Error | `#9F1D20` | Validation/error text and borders |
| Warning | `#B7791F` | Warning/conflict/private-note emphasis |
| Success | `#0B7A46` | Success indicators with text/icon support |

Bootstrap remains the component foundation. Labels remain above controls, validation stays near the field, buttons contain understandable text, focus remains visible, and status meaning never depends on color alone.

## 2. Responsive Breakpoints

| Viewport | Required behavior |
|---|---|
| Desktop `>= 992px` | Multi-column/card grid where readable; centered content; concise tables allowed |
| Tablet `768-991px` | Reduce columns; move dense rows to stacked/card representation when necessary |
| Mobile `< 768px` | Single-column forms/cards; touch-friendly actions; no page-level horizontal scrolling |
| All | No clipped labels, overlapping validation, hidden required actions, unreadable long text, or inaccessible dialogs |

## 3. Final Application Shell

- Keep TokTickIT brand/header, authenticated User name/role, Logout, and existing role navigation.
- Add a visible **Dashboard** navigation item for Requester, IT Staff, and Administrator.
- Requester navigation: Dashboard, My Tickets, Create Ticket.
- IT Staff navigation: Dashboard, Ticket Queue.
- Administrator navigation: Dashboard, User Management.
- Active page is visually and semantically identified.
- Unauthorized destinations are omitted from normal navigation rather than shown as disabled security controls.
- Direct URLs remain backend-authorized and may show a safe Forbidden state.

## 4. IT Staff Dashboard

### 4.1 Purpose

Provide a concise operational starting point, not a replacement for Ticket Queue or Ticket Detail.

### 4.2 Metric cards

Show approved metrics from the API contract:

1. Unassigned Tickets
2. My Tickets
3. My Open Actions
4. Tickets by IT Priority summary

Status counts may be displayed as a compact secondary summary rather than eight oversized cards.

Every count includes a text label and numeric value. Cards that map to a useful list are keyboard-activatable links/buttons with clear accessible names.

### 4.3 Operational lists

- **Recent/Urgent Tickets:** up to 5 rows/cards with Ticket Number, Summary, IT Priority, Status, Owner, Updated, and Open action.
- **My Recent Actions:** up to 5 rows/cards with Ticket Number, Action Description excerpt, Action status, assignee/performer context, and Updated.
- Selecting an item opens Ticket Detail; metric drill-downs open Ticket Queue with the documented filter/query intent.

### 4.4 States

- Loading: skeleton or concise loading text; existing shell stays stable.
- Empty: metric values remain `0`; list sections show meaningful empty text.
- Forbidden: safe role message, no protected dashboard data.
- Safe API/network failure: concise error + Retry; no stack/database details.

## 5. Requester Dashboard

### 5.1 Metric cards

1. Open Tickets
2. Waiting for You

### 5.2 Recent lists

- **Recently Updated:** up to 5 owned Tickets.
- **Recently Resolved:** up to 5 owned Tickets.

Each Ticket card/row shows Ticket Number, Summary, Status, relevant timestamp, and Open action. A link to **My Tickets** provides the complete list instead of duplicating filters/pagination on the dashboard.

### 5.3 Ownership presentation

The UI does not expose requesterId selection. All content is assumed to come from authenticated ownership-protected API results. Cross-requester absence is handled as normal safe not-found/forbidden behavior without revealing another User's data.

## 6. Actions Taken on Ticket Detail

### 6.1 Placement

Add an **Actions Taken** section below the main Ticket operational summary and before/near existing communication/attachment areas according to available width. Do not replace the established Ticket Detail information grouping.

### 6.2 List fields

Each Action item shows:

- Action Date/Time (`createdAt`, read-only)
- Status badge
- Action Description
- Result (`Not completed yet` when null)
- Assignee
- Performed by (`Not completed yet` when null)
- Follow-Up Required (`Yes/No` text plus non-color cue)
- Follow-up Note when required/present
- Attachment Notes when present
- Last Updated

Stable Ticket-detail ordering is oldest Action first so the work sequence reads chronologically.

### 6.3 Requester mode

- Requesters see all Action items on their owned Ticket.
- No Create, Edit, Reassign, Start, Complete, or Cancel controls are shown.
- Server-generated identity/status/time fields remain clearly read-only.

### 6.4 IT Staff / Administrator mode

Permitted staff see the list plus role-authorized controls.

#### Create Action form

- Action Description *
- Assignee * (active IT Staff/Administrator choices)
- Follow-Up Required? *
- Follow-up Note * only when Follow-Up Required is Yes
- Attachment Notes (optional)
- Result is not required during initial `PLANNED` creation and may be omitted.
- Action Date/Time is shown as a read-only server value after creation, not as an editable client field.
- `clientRequestId` is generated/managed by the client and never shown as a normal editable field.

Primary action: **Create Action**. During submission, relevant inputs/actions are disabled and a busy state is visible.

#### Edit Action form

Allowed only for `PLANNED` or `IN_PROGRESS` Actions:

- Action Description
- Assignee
- Result (optional until completion)
- Follow-Up Required
- Follow-up Note
- Attachment Notes

The UI carries the current `version` invisibly as the concurrency token. On `STALE_UPDATE`, show a conflict message and a **Reload latest** action; do not silently overwrite the newer record.

#### Action status controls

- `PLANNED`: Start, Cancel.
- `IN_PROGRESS`: Complete, Cancel.
- `COMPLETED`: no status mutation controls.
- `CANCELLED`: no status mutation controls.

Complete requires Result. Complete and Cancel use explicit confirmation because they are terminal Action states. Cancel confirmation explains that cancelled Actions no longer block Ticket resolution.

### 6.5 Validation and feedback

- Required field asterisk plus field-level message.
- Whitespace-only required text is invalid.
- Follow-up Note appears/becomes required immediately when Follow-Up Required = Yes.
- Inactive/invalid assignee response is shown near Assignee and preserves other form values.
- Safe network/API failure preserves recoverable entered values.
- Success updates the list from the server response and clears only the completed form.
- Replay-safe response must not append a duplicate visible Action.

## 7. Ticket Workflow and Resolution Feedback

- Existing Ticket status control shows only transitions allowed from the current status.
- UI filtering is guidance only; backend remains authoritative.
- `Resolved`, `Closed`, `Cancelled`, and `Reopened` keep explicit confirmation behavior from Lab 3.
- If resolution is blocked by non-terminal Actions, show a clear message such as: `Complete or cancel all open Actions Taken before resolving this Ticket.`
- The message may link/scroll to the Actions Taken section.
- On `STALE_UPDATE`, show conflict feedback and offer Reload latest; do not auto-resubmit a stale mutation.
- Successful Ticket status mutation refreshes Ticket summary/status and the Action-related resolution eligibility.
- Requester `Problem Appears Resolved` remains visually described as advisory, not a formal status change.

## 8. Badges and State Labels

### Action status

- `PLANNED` -> `Planned`
- `IN_PROGRESS` -> `In Progress`
- `COMPLETED` -> `Completed`
- `CANCELLED` -> `Cancelled`

Every badge includes readable text. Existing Ticket Status, Requested Priority, IT Priority, and role badge conventions continue unchanged.

## 9. Public vs Private Content Continuity

- Public Comments remain visibly labeled public/shared.
- Internal Notes retain the persistent `Internal - not visible to Requester` warning treatment.
- Actions Taken are not treated as Internal Notes. Requesters can read Actions Taken on owned Tickets as required by Lab 4.
- No Lab 4 control causes Internal Note content to appear in Requester dashboard/Ticket Action payloads.

## 10. Processing, Empty, Error, and Conflict States

Major Lab 4 screens/components define meaningful handling for:

- initial/loading
- saving/submitting
- success
- field validation failure
- empty list / zero metric
- no-results where filtering applies
- forbidden
- not-found
- stale/conflict
- safe API/network failure

Errors include text and do not rely on red color alone. Retry/reload actions remain keyboard reachable.

## 11. Accessibility Rules

- Native labels or `aria-label`/`aria-labelledby` for every interactive control.
- Icon-only controls require accessible label and tooltip; prefer visible text for important actions.
- Visible focus ring remains for keyboard users.
- Modal/dialog focus is trapped and returned to the invoking control when closed.
- Validation messages are programmatically associated with fields where practical.
- Dynamic save/status feedback uses an appropriate live region without repeatedly announcing nonessential layout text.
- Tables use headers; card alternatives retain visible field labels.
- Dashboard cards used as links have meaningful destinations in their accessible names.

## 12. Responsive Layout Rules

### Desktop

- Dashboard metric cards may use a 3-4 column grid depending on available width.
- Recent lists may use compact tables where readability is preserved.
- Actions Taken may use structured cards or a readable table + expanded details; long text must not force page overflow.

### Tablet

- Metric cards reduce columns.
- Recent lists and Actions Taken prefer stacked rows/cards when columns become dense.
- Edit/Create Action form uses at most two columns where practical; long text spans full width.

### Mobile

- Metric cards stack or use a compact two-column grid only when labels remain readable.
- Ticket/Action items use cards with labeled values.
- Forms are one column.
- Terminal/status actions remain touch-friendly and wrap rather than overflow.

## 13. Visual and Accessibility Checklist

Final evidence must verify and record:

- [ ] Dashboard navigation and active-page indication are consistent for each role.
- [ ] Staff Dashboard metrics/current-user Actions/recent-urgent Tickets are readable.
- [ ] Requester Dashboard shows only owned information and does not duplicate My Tickets controls.
- [ ] Actions Taken create/list/edit/status states are visually distinct and understandable.
- [ ] Read-only server-generated Action fields are visually distinct from editable fields.
- [ ] Follow-up conditional validation is placed at the field.
- [ ] Ticket resolution-gate/conflict feedback is clear and non-color-only.
- [ ] Public Comments, Internal Notes, and Actions Taken remain visually distinguishable.
- [ ] Keyboard focus is visible on all required actions.
- [ ] Desktop `>=992px` has no material clipping/overlap/overflow.
- [ ] Tablet `768-991px` has no material clipping/overlap/overflow.
- [ ] Mobile `<768px` has no page-level horizontal scrolling or hidden required action.
- [ ] Long descriptions/results/notes wrap safely.
- [ ] Loading, empty, forbidden, conflict, and safe-failure states are captured where required.

## 14. Required Screenshot Paths

Minimum repository evidence structure from the handout:

```text
artifacts/lab-04/screenshots/
├── staff-dashboard/
├── requester-dashboard/
└── actions-taken/
```

Issue 7 may add descriptive files beneath these directories for desktop/tablet/mobile and required state evidence. Paths must reflect actual screenshots only; this contract does not fabricate them.
