# Lab 2 — AI Use and Reflection

**LLM/agent used:** Codex and ChatGPT

## Selected Key Prompts (6-10)

| # | Prompt summary | What I did with the result | Evidence |
|---|---|---|---|
| 1 | Draft and cross-check the Lab 2 engineering contract, API, UI, data, AC, and test traceability | Reviewed the draft with the Project Manager and corrected missing contracts before implementation | `docs/lab-02/`; PR #23 |
| 2 | Implement database models and idempotent seed using TDD | Rejected a reset request, isolated Lab 2 in a new development database, inspected additive SQL, and strengthened relationship/constraint tests | `server/tests/lab-02/seed.test.ts`; PR #24 |
| 3 | Implement Development Requester context and selector states | Added active-only loading, storage revalidation, switching, safe failures, and the reviewer-requested stale-storage fix | `client/tests/lab-02/RequesterContext.test.tsx`; PR #25 |
| 4 | Implement Create Ticket and two-step Attachment upload | Added validation, server-generated Ticket data, physical upload storage, compensation behavior, and review boundary corrections | `server/tests/lab-02/create-ticket.api.test.ts`; PR #26 |
| 5 | Implement requester-owned My Tickets search, filters, sort, and pagination | Kept ownership filtering first and corrected responsive Open controls to target a specific Ticket | `server/tests/lab-02/my-tickets.api.test.ts`; PR #27 |
| 6 | Implement requester-owned Ticket Detail and Attachment lifecycle | Added public metadata, upload/download, soft removal, ownership protection, and complete removed metadata after review | `server/tests/lab-02/attachments.api.test.ts`; PR #28 |
| 7 | Add Playwright E2E, responsive screenshots, and final UI audit | Added three viewport projects, captured evidence, found the tablet Open-action defect, and corrected it only after approval | `e2e/lab-02/requester-ticket-flow.spec.ts`; `artifacts/lab-02/screenshots/` |

## Student Decisions And Corrections

- Treated the Development Requester selector as a testing context, never authentication.
- Rejected a Prisma reset and used the separately approved `toktickit_lab2` development database.
- Kept Ticket creation and Attachment upload as a two-step workflow.
- Applied requester ownership before list search, filters, sorting, and pagination.
- Used soft removal so Attachment metadata remains while download becomes unavailable.
- Stopped at the tablet defect, obtained approval, then changed My Tickets to cards below `992px`.

## My Reflection

The agent helped translate the Lab Sheet into traceable tests and kept repeated review corrections focused. I retained responsibility for approval gates and safety decisions, especially rejecting a database reset, isolating the Lab 2 database, and requiring evidence before each merge. The most useful lesson was that passing component tests did not replace viewport inspection: the tablet screenshot exposed a hidden Open action that automated workflow checks initially missed.
