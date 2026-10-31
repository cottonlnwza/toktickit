# Lab 4 — AI Use and Reflection

**LLM/agent used:** ChatGPT (OpenAI), with a connected local coding bridge for repository inspection and permitted code changes.

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Asked ChatGPT to read the Lab 4 handout carefully and explain the Sprint 4 scope, requirements, and workflow before any implementation. | Used the handout analysis to define the Lab 4 contract and to avoid adding unapproved features or changing completed Lab 3 history. |
| 2 | Asked AI to continue only with the first Lab 4 Issue, keeping feature work on its own branch and stopping at peer review. | Established `lab4-staging`, decomposed the approved work into Issues, and submitted the engineering-contract PR #71 for review. |
| 3 | Asked AI to implement the Actions Taken database, migration, API and seed foundation only after rereading its requirements. | Used tests-first implementation and verified idempotent seeds, stale-write protection, role authorization, historical data preservation and audit events in Issue #64 / PR #72. |
| 4 | Asked AI to address the actual requested changes on PR #72 rather than accepting an incomplete implementation. | Added and checked targeted regression coverage for cross-Ticket UUID reuse, concurrent replay and locked workflow-cycle correctness before requesting re-review. |
| 5 | Asked AI to continue with Actions Taken Ticket Detail UI, including Requester read-only access and the allowed Staff/Admin actions. | Reviewed the create/edit/reassign/status UI, conditional validation, feedback, and tests for Issue #65 / PR #73. |
| 6 | Asked AI to implement the final Ticket lifecycle and resolution gate from the approved contract. | Verified the permitted status matrix, current-cycle completion evidence, reopening, optimistic concurrency and Administrator parity for Issue #66 / PR #74. |
| 7 | Asked AI to implement role-specific dashboards and to correct the peer review's real drill-down blockers. | Checked authoritative Requester/Staff metrics, ownership isolation, filtered destinations, current-user Actions and corrected navigation for Issue #67 / PR #75. |
| 8 | Asked AI to resume the approved hardening Issues rather than rewriting completed feature branches. | Added aggregate Ticket-version guards and terminal/historical Action read-only behavior through separate reviewed PRs #78 and #79. |
| 9 | Asked AI to complete final E2E/regression and address the specific requested changes on PR #80. | Verified cross-Requester isolation, stale Ticket feedback/no overwrite, existing Labs 1–3 regression, and desktop/tablet/mobile tests with the isolated Lab 4 test database. |
| 10 | Asked AI to complete responsive/accessibility/visual hardening, then check review evidence from real GitHub history and use Lab 1 documents as the documentation template. | Inspected actual screenshots, added field-linked validation and focus checks, recorded PR #81, and included only verified Lab 4 reciprocal-review events in `reviewer.md`. |

## Reflection

Following the Lab 1 prompting pattern—read the instructions first, work on **one Issue only**, inspect before editing, run tests, and stop for an independent review—helped me maintain the Lab 4 scope. The most useful AI assistance was translating business rules into executable tests and making it easier to compare the code against the approved contract.

I did not treat AI output or green tests as automatic approval. PR #72 and PR #80 required corrections after a peer identified specific concurrency or E2E evidence gaps. Those corrections were made on the existing feature PRs and verified before asking for re-review. Likewise, the reciprocal-review record was checked against actual GitHub submissions; I did not turn a `CHANGES_REQUESTED` review into an `APPROVED` review merely because a PR later merged.

I learned to distinguish an AI-generated suggestion, a locally executed test, a submitted peer review, and a verified merge. Only confirmed results are recorded. Final `lab4-staging → main` review, final-`main` test evidence and PDF submission are not claimed as complete before they occur.
