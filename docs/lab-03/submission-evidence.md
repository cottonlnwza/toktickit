# Lab 3 Submission Evidence Map

This file is a release-preparation map for the single Lab 3 PDF. The final PDF must use the headings `Answer Part 1` through `Answer Part 9` in this exact order. Only evidence that exists in the repository or GitHub history is listed here.

Current release gate: Issues #33-#41 are closed and `Done`; their reviewed changes are integrated into `lab3-staging` through merge commit `2a43450`. Issue #42, its feature/documentation review, the final `lab3-staging -> main` release PR, final `main` verification, and the final all-`Done` Project screenshot remain pending until those events actually occur.

## Answer Part 1

Git Use with Engineering Workflow evidence:

- GitHub Project #3, `TokTickIT Individual Sprints`, with Issues #33-#41 already `Done`; Issue #42 remains `Started` during this pre-release branch.
- Feature/follow-up PR history integrated into `lab3-staging`: PRs #43, #44, #45, #46, #47, #48, #49, #50, #51, #52, #53, and #54.
- `docs/lab-03/reviewer.md` contains the verified reviewer identities, review IDs/links, corrections, approvals, and merges for completed Issues.
- `README.md` contains the current Lab 3 project structure, local setup, migration, test, and documentation references.
- `.gitignore` excludes dependencies, local environment/secrets, build/test output, local Prisma DB files, logs/OS files, and starter handout/archive files.
- Repository evidence folders: `docs/lab-03/`, `server/tests/lab-03/`, `client/tests/lab-03/`, `e2e/lab-03/`, and `artifacts/lab-03/screenshots/`.
- Final evidence still required after peer release integration: Issue #42 `Done`, final Project board with all Sprint 3 Issues `Done`, reviewed `lab3-staging -> main` PR, and final `main` commit/test evidence.

## Answer Part 2

Spec DD evidence:

- `docs/lab-03/specification.md`
- `docs/lab-03/ui-spec.md`
- `docs/lab-03/api-spec.md`
- Engineering-contract review history in PR #43 plus correction PR #44, recorded in `docs/lab-03/reviewer.md`.
- The specification contains numbered FR, BR, AC, migration/data/API/UI decisions, assumptions, and Product Definition of Done.

## Answer Part 3

Test DD and traceability evidence:

- `docs/lab-03/tests.md`
- Unit/API/integration/security/migration/regression tests under `server/tests/lab-03/`.
- UI/component/style tests under `client/tests/lab-03/`.
- E2E/responsive/accessibility evidence under `e2e/lab-03/`.
- `tests.md` maps Test IDs to requirement/AC coverage, exact test paths, and actual recorded results.
- Issue #42 reruns the complete required server/client/E2E/build verification before release; final `main` verification must replace any pre-release-only result before submission.

## Answer Part 4

AI Use with Reflection evidence:

- `docs/lab-03/ai-use.md`
- LLM used: ChatGPT (OpenAI), acting as specification/planning and authorized coding/repository assistant.
- Nine selected key prompts are retained.
- `My Reflection` records how the handout/contract/repository/reviewer evidence remained authoritative and how AI-assisted checks exposed real contract, concurrency, authorization, and evidence gaps.

## Answer Part 5

Working Login and Password Change UI evidence:

- Base responsive Login/validation screenshots:
  - `artifacts/lab-03/screenshots/authentication/desktop.png`
  - `artifacts/lab-03/screenshots/authentication/tablet.png`
  - `artifacts/lab-03/screenshots/authentication/mobile.png`
- Supporting Change Password screenshots generated and verified by the visual-evidence flow:
  - `artifacts/lab-03/screenshots/authentication/change-password-desktop.png`
  - `artifacts/lab-03/screenshots/authentication/change-password-tablet.png`
  - `artifacts/lab-03/screenshots/authentication/change-password-mobile.png`
- `e2e/lab-03/authentication.spec.ts` demonstrates invalid/inactive login behavior, first-password change, authenticated shell, protected access, logout, post-logout blocking, keyboard reachability, and accessible names.
- Requester Create Ticket screenshots in Part 9 also show the authenticated User identity/role shell after login.

## Answer Part 6

Working IT Staff Ticket Queue UI evidence:

- `artifacts/lab-03/screenshots/staff-queue/desktop.png`
- `artifacts/lab-03/screenshots/staff-queue/tablet.png`
- `artifacts/lab-03/screenshots/staff-queue/mobile.png`
- `e2e/lab-03/staff-ticket-flow.spec.ts` and `server/tests/lab-03/staff-queue.api.test.ts` cover queue search, filters, sorting, pagination, ownership presentation, safe states, open-detail action, responsive layout, and authorization.

## Answer Part 7

Working IT Staff Ticket Detail UI evidence:

- `artifacts/lab-03/screenshots/staff-ticket-detail/desktop.png`
- `artifacts/lab-03/screenshots/staff-ticket-detail/tablet.png`
- `artifacts/lab-03/screenshots/staff-ticket-detail/mobile.png`
- `e2e/lab-03/staff-ticket-flow.spec.ts` covers claim, IT Priority, permitted status transition, Public Comment, Internal Note, Attachment continuity, and Requester visibility separation.
- `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `comments-notes.api.test.ts`, and `authorization.api.test.ts` provide direct backend authorization/safety evidence, including owner-eligibility concurrency regressions.

## Answer Part 8

Working Administrator User Management UI evidence:

- `artifacts/lab-03/screenshots/user-management/desktop.png`
- `artifacts/lab-03/screenshots/user-management/tablet.png`
- `artifacts/lab-03/screenshots/user-management/mobile.png`
- `e2e/lab-03/user-administration.spec.ts` demonstrates list/search/role filter/create/edit/deactivate/reactivate/new initial password, self-deactivation safety, non-Administrator denial, and accessible controls.
- `server/tests/lab-03/users-admin.api.test.ts` covers duplicate email, invalid input/role, last-active-Administrator protection, session revocation, BR-18 owner safety, no-delete behavior, and concurrent Administrator demotion safety.

## Answer Part 9

Zen Green UI and Responsive Evidence:

- Required base matrix is complete: seven major screen areas x desktop/tablet/mobile = 21 base screenshots under `artifacts/lab-03/screenshots/`.
- Three supporting Change Password captures are also present, for 24 Lab 3 screenshot files total.
- Areas: `authentication/`, `requester-create-ticket/`, `requester-my-tickets/`, `requester-ticket-detail/`, `staff-queue/`, `staff-ticket-detail/`, and `user-management/`.
- `e2e/lab-03/visual-evidence.spec.ts` checks page-level horizontal overflow immediately before capture and validates the required role-specific content/actions.
- `client/tests/lab-03/ui-style.test.tsx` covers Zen Green/auth, textual role/status indicators, read-only/editable distinction, keyboard focus behavior, and excluded destructive User deletion.
- `docs/lab-03/ui-spec.md` contains the completed visual inspection checklist and breakpoint/evidence rules.

Before the PDF is finalized, replace the pending release-gate statements in this map with the real Issue #42 review/merge, final `lab3-staging -> main` PR, final Project `Done` state, and final `main` verification. Do not substitute planned evidence for events that have not occurred.
