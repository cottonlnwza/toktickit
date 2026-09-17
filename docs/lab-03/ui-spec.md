# Lab 3 UI Specification

Status: Draft contract for Issue #33. Lab 3 extends the existing Lab 2 Zen Green system; it does not introduce a second visual language.

## 1. Visual Direction and Existing Tokens

Reuse the Lab 2 visual foundation exactly unless this document explicitly extends it.

| Token | Value | Use |
|---|---|---|
| Primary green | `#006B3C` | Header, primary actions, strong emphasis |
| Secondary green | `#0B7A46` | Active navigation, focus/hover accents, links |
| Pale green | `#EAF6EF` | Selected/success/subtle emphasis |
| Page background | `#F5F7F6` | App background |
| Surface | `#FFFFFF` | Cards/forms/lists |
| Border | `#D6E2DB` | Fields/surfaces |
| Text | `#1F352B` | Main readable text |
| Muted text | `#5D6F65` | Secondary text |
| Read-only field | `#F3F2EA` | Non-editable values |
| Error | `#9F1D20` | Error text/borders |
| Warning | `#B7791F` | Warning states/badges |
| Success | `#0B7A46` | Success indicators with text/icon support |

Bootstrap remains the component foundation. Labels, vertical spacing, cards, validation placement, readable body text, visible focus, and non-color-only status indicators continue from Lab 2.

## 2. Responsive Breakpoints

| Viewport | Contract |
|---|---|
| Desktop `>= 992px` | Use tables/multi-column groups where readable; centered content with sensible max width |
| Tablet `768-991px` | Reduce columns; use cards/stacked metadata where a table becomes dense |
| Mobile `< 768px` | Single-column forms/cards; touch-friendly actions; no page-level horizontal scrolling |
| All | No clipped labels, overlapping validation, hidden required action, or unreadable long text |

## 3. Authenticated Application Shell

- Header shows TokTickIT identity.
- Right-side identity area shows current User name and role badge.
- Provide Logout.
- Provide Change Password when permitted/required.
- Requester navigation: My Tickets, Create Ticket.
- IT Staff navigation: Ticket Queue.
- Administrator navigation: User Management.
- Do not show unauthorized destinations merely disabled; omit them from normal navigation.
- Direct URL access is still backend-authorized and may show a Forbidden state.
- Remove Development Requester selector, selected-requester label, `Change Requester`, and Lab 2 development-selection explanation.

## 4. Login Screen

### Structure

- TokTickIT title/brand.
- Email field.
- Password field with normal browser password behavior.
- Sign In primary action.
- Short safe help/error region.

### Modes and feedback

- Initial.
- Client validation failure.
- Signing in: fields/action disabled and busy text/spinner.
- Invalid credentials: generic safe error.
- Inactive account: clear inactive-account message without returning profile details.
- Login throttled: safe retry-later message.
- API/network failure: safe retry message.
- Success: route to Change Password when required; otherwise route to role home.

No social login, password-reset email, self-registration, or Requester selector link is displayed.

## 5. Mandatory Change Password Screen

- Shown before normal app navigation when `mustChangePassword=true`.
- Fields: Current/Initial Password, New Password, Confirm New Password.
- Show concise password rule text: 12-128 characters; confirmation must match; new value must differ from current.
- Show field-level validation and server-safe failure.
- Continue/Save primary action has saving state.
- On success, show confirmation briefly and route to the role home using the rotated authenticated session.
- Logout remains available.
- Normal app navigation remains hidden/blocked until change succeeds.

## 6. Requester Regression Screens

### Create Ticket / My Tickets

- Preserve Lab 2 field grouping, buttons, feedback, responsive behavior, and Attachment rules.
- Replace selected Development Requester with authenticated User identity.
- Do not send/display requesterId as a user-selectable identity input.

### Requester Ticket Detail extensions

- Preserve read-only Ticket information and Attachment section.
- Add a **Public Comments** section with chronological comments, author, role, and timestamp.
- Add plain-text comment composer with character guidance and Submit Comment busy state.
- Add **Problem Appears Resolved** secondary/positive action with explanatory text that this does not formally resolve/close the Ticket.
- After indication, show a read-only confirmation/timestamp and prevent confusing repeated submissions.
- Do not show Internal Notes or IT Staff operational controls.

## 7. IT Staff Ticket Queue

### Desktop field set

Use a readable table with:

1. Ticket Number
2. Summary with Requester name as secondary text
3. Requested Priority
4. IT Priority
5. Status
6. Owner
7. Last Updated
8. Open action

Category and Related System remain filterable and are visible in Ticket Detail instead of consuming dense table columns.

### Controls

- Search input: Ticket Number, Summary, Requester Name/Email.
- Filters: Status, Requested Priority, IT Priority, Owner, Category, Related System.
- Sort field/order control.
- Clear Filters.
- Page size 10/25/50 and pagination.

### States

- Loading/skeleton or status text.
- Realistic results.
- Empty queue (no Tickets exist).
- No results (Tickets exist but current query matches none) with Clear Filters action.
- Forbidden.
- Safe API/network failure with Retry.

### Tablet/mobile

- At widths where the table becomes dense, render each Ticket as a card/stacked row with Ticket Number, Summary, Requester, priority/status badges, Owner, Updated, and Open action.
- Filters may collapse into a labeled panel/drawer but must remain keyboard reachable.
- Pagination remains visible and usable.

## 8. IT Staff Ticket Detail

### Information grouping

1. Ticket identity: Ticket Number, Created, Last Updated, Status badges.
2. Requester/classification: Requester, Category, Related System.
3. Request content: Summary, Description, Requested Priority (read-only).
4. Operations: Owner, IT Priority, Current Status transition control.
5. Requester resolution indication, when present.
6. Public Comments.
7. Internal Notes.
8. Existing Attachments.

### Operational controls

- Claim Ticket when unassigned.
- Owner select for active IT Staff/Administrator, including Unassigned where permitted.
- IT Priority select.
- Status transition select/action shows only valid next states from the contract.
- Reassign, Resolved, Closed, Cancelled, and Reopened actions use the required confirmation behavior before submission.
- Disable relevant controls while saving and show success/conflict/safe-failure feedback.

### Public vs private communication

- Public Comments use normal/pale-green communication styling and a visible `Public` label.
- Internal Notes use a distinct warm neutral/warning-tinted section and a persistent `Internal - not visible to Requester` label.
- Composer headings, helper text, and submit button labels must make the destination obvious.
- Neither section supports edit/delete in Lab 3.

### Administrator direct-detail behavior

- Administrator does not receive Ticket Queue navigation.
- If an Administrator opens a permitted Staff Ticket Detail URL directly, the screen is an oversight variant: Ticket/Public Comment/Internal Note information is readable, IT Priority is editable as allowed by the authorization matrix, and owner/status/Public Comment/Internal Note creation controls are hidden.
- This limited direct-detail behavior exists only to satisfy the handout's explicit Administrator visibility/IT-Priority authority while keeping normal Administrator and IT Staff responsibilities separate.

## 9. Administrator User Management

### List area

- Columns/cards: Name, Email, Role badge, Status badge, Edit action.
- Search by name/email.
- One optional Role filter is included.
- No required pagination, multi-column sort, or simultaneous advanced filters.

### Create/Edit panel

Create fields:
- Name
- Email
- Role (exactly one)
- Active toggle/select
- Initial Password

Edit fields:
- Name
- Email
- Role
- Active state
- Separate `Set New Initial Password` action/field; do not mix password into ordinary profile edit payload.

### Safety/feedback

- Duplicate email and invalid input display field/safe conflict feedback.
- Self-deactivation and last-active-Administrator attempts show a clear conflict message.
- Deactivation uses explicit confirmation and never presents Delete User.
- Saving disables duplicate submission.
- Non-Administrator direct access shows Forbidden without user-list content.

### Responsive behavior

- Desktop: list plus side panel/modal where practical.
- Tablet/mobile: card/stacked list and full-width create/edit panel; long emails wrap safely.

## 10. Component and Badge Rules

- Editable fields: white surface + neutral border.
- Read-only fields: existing `#F3F2EA` treatment.
- Invalid fields: Error border + adjacent text.
- Disabled: visibly disabled and non-interactive.
- Visible keyboard focus is never removed.
- Buttons keep Lab 2 hierarchy: Primary, Secondary, Tertiary, Destructive, Disabled.
- Ticket Status, Requested Priority, IT Priority, and Role badges always contain text; color is supplemental.
- Public/Internal labels contain text, not color alone.

## 11. Accessibility Rules

- Every input/select/button/link has an accessible name.
- Validation errors are associated with their fields where practical.
- Authentication, queue, ticket operations, comments/notes, and user management are keyboard operable.
- Dialog/confirmation focus is moved/returned appropriately.
- Semantic status/alert roles are used for meaningful feedback.
- Icons do not replace required visible labels for security-sensitive actions.
- Tables provide headers; card representations preserve equivalent information.
- Do not rely on color alone for role, priority, status, success, warning, or error.

## 12. Required Screenshot Structure

Repository-required application screenshots:

```text
artifacts/lab-03/screenshots/
├── authentication/
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
├── requester-create-ticket/
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
├── requester-my-tickets/
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
├── requester-ticket-detail/
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
├── staff-queue/
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
├── staff-ticket-detail/
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
└── user-management/
    ├── desktop.png
    ├── tablet.png
    └── mobile.png
```

Working evidence captured during the lab may additionally be stored under `pic/pic_lab3/` using descriptive filenames. Evidence files are not application source and are committed only if explicitly approved.

Each major UI area must ultimately have the three exact breakpoint files above for Answer Part 9. Those three files prove the base screen/layout at desktop/tablet/mobile; additional state screenshots may be added with descriptive names when Parts 5-8 need validation/failure/success evidence. Requester evidence is explicit rather than implied: every `requester-create-ticket/{desktop,tablet,mobile}.png` must show the authenticated Create Ticket screen including Attachment controls; every `requester-my-tickets/{desktop,tablet,mobile}.png` must show the authenticated list/search/filter/sort/pagination layout; every `requester-ticket-detail/{desktop,tablet,mobile}.png` must show owned Ticket Detail with the Attachment area, Public Comments, and the `Problem Appears Resolved` action/state visible in the captured workflow. Authentication evidence also covers valid/invalid/inactive/first-password-change/logout. Queue covers query/states; Staff Detail covers operations/comments/notes/Attachments; User Management covers allowed create/edit/activation/password operations and safety rules.

Required Part 9 breakpoint evidence matrix:

| Major screen / area | Desktop `>=992px` | Tablet `768-991px` | Mobile `<768px` | Required detail |
|---|---|---|---|---|
| Login / Change Password / authenticated shell | Required | Required | Required | Role navigation, validation/failure, first-password gate, logout/access state. |
| Requester Create Ticket | Required | Required | Required | Authenticated identity, fields, Attachments, validation, submitting/success/failure. |
| Requester My Tickets | Required | Required | Required | Search/filter/sort/pagination and empty/no-results/failure representation. |
| Requester Ticket Detail | Required | Required | Required | Ticket data, Attachment lifecycle presentation, Public Comments, Problem Appears Resolved. |
| IT Staff Ticket Queue | Required | Required | Required | Table/card representation, filters, status/priority/owner badges, empty/no-results/failure. |
| IT Staff Ticket Detail | Required | Required | Required | Claim/owner, IT Priority, status, Comments/Notes, Attachments, validation/failure. |
| Administrator User Management | Required | Required | Required | List/search/filter/create/edit/activation/initial-password and safety feedback. |

## 13. Visual Inspection Checklist

- [ ] Login uses Zen Green and exposes no Requester selector.
- [ ] Mandatory Change Password blocks normal navigation and clearly shows password rules.
- [ ] Authenticated shell shows correct User name/role and role-specific navigation.
- [ ] Requester Create/List/Detail/Attachment screens preserve Lab 2 behavior under authenticated identity.
- [ ] Public Comments and Problem Appears Resolved are clear on Requester Ticket Detail.
- [ ] Queue desktop field set is readable and not a mega-grid.
- [ ] Queue cards preserve essential fields/actions on tablet/mobile.
- [ ] Requested Priority and IT Priority are visually distinct and correctly labeled.
- [ ] Staff Ticket Detail clearly separates read-only Ticket data from operational fields.
- [ ] Public Comments and Internal Notes are unmistakably different.
- [ ] User Management remains minimalist and does not expose excluded features.
- [ ] Role/status/priority badges include readable text.
- [ ] Validation appears adjacent to the affected control.
- [ ] Busy/saving states prevent duplicate submissions.
- [ ] Empty/no-results/forbidden/not-found/conflict/failure states are readable and safe.
- [ ] Keyboard focus remains visible and logical.
- [ ] No clipped labels, overlapping feedback, hidden required actions, unreadable filenames/emails, or page-level horizontal overflow at required breakpoints.

## 14. UI Decisions

- Queue columns intentionally omit Category/Related System because the approved filter/detail views already expose them and the handout warns against a mega-grid.
- Administrator role filter is included because it is explicitly optional and useful without introducing advanced list behavior.
- Administrator does not receive normal Ticket Queue navigation; this preserves conceptual separation of IT Staff and Administrator duties.
- Internal Notes use strong text labeling plus distinct surface treatment so privacy is not communicated by color alone.
- `Problem Appears Resolved` is presented as an indication/action, not a status selector.
