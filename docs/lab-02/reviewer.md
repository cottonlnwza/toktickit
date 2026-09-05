# Lab 2 — Peer Review Record

**Author:** Thanakorn Soison — 67070507205 — GitHub: @cottonlnwza
**Peer reviewer:** GitHub: @thananun-7203

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Issue | Reviewer | Verdict | Merged by | Evidence |
|---|---|---|---|---|---|---|
| [#23](https://github.com/cottonlnwza/toktickit/pull/23) | `feature/lab2-1-engineering-contract` | #16 | @thananun-7203 | Approved; merged | @thananun-7203 | Merged `2026-09-03T13:59:12Z`; merge `d9aad89`; feature `5a0a3e4` |
| [#24](https://github.com/cottonlnwza/toktickit/pull/24) | `feature/lab2-2-database-seed` | #17 | @thananun-7203 | Changes requested; corrected; approved; merged | @thananun-7203 | Merged `2026-09-03T16:39:15Z`; merge `f0e5820`; correction `3de89e9` |
| [#25](https://github.com/cottonlnwza/toktickit/pull/25) | `feature/lab2-3-requester-context` | #18 | @thananun-7203 | Changes requested; corrected; approved; merged | @thananun-7203 | Merged `2026-09-04T04:20:04Z`; merge `5c57c71`; correction `263a118` |
| [#26](https://github.com/cottonlnwza/toktickit/pull/26) | `feature/lab2-4-create-ticket` | #19 | @thananun-7203 | Changes requested twice; corrected; approved; merged | @thananun-7203 | Merged `2026-09-04T09:04:19Z`; merge `83b7520`; corrections `975d4e4`, `6fed5fe` |
| [#27](https://github.com/cottonlnwza/toktickit/pull/27) | `feature/lab2-5-my-tickets` | #20 | @thananun-7203 | Changes requested; corrected; approved; merged | @thananun-7203 | Merged `2026-09-04T12:02:51Z`; merge `8a14d4c`; corrections `7e86710`, `8a8a54f` |
| [#28](https://github.com/cottonlnwza/toktickit/pull/28) | `feature/lab2-6-ticket-detail-attachments` | #21 | @thananun-7203 | Changes requested; corrected; approved; merged | @thananun-7203 | Merged `2026-09-04T14:24:56Z`; merge `168e262`; corrections `66037c0`, `c668eb2` |
| [#29](https://github.com/cottonlnwza/toktickit/pull/29) | `feature/lab2-7-responsive-e2e-doc-audit` | #22 | @chaproi | Changes requested; corrected; approved; merged | @chaproi | Approved `pullrequestreview-5120269140`; final reviewed commit `5132c27`; merged by @chaproi with merge `0769c70`; PR closed and feature branch deleted |
| Pending | `lab2-staging` to `main` | Release PR | Pending | Pending | Pending | Pending |

## Review Comments Received

- PR #23 suggested keeping AI-use evidence factual and clarifying that `RequesterUser` is the Development Requester identity.
- PR #24 requested an import-safe seed entry point and stronger idempotency checks.
- PR #25 requested clearing stale requester storage after a requester-load failure.
- PR #26 requested validation boundaries, restored reference loading, deterministic upload storage, API-contract alignment, and attachment boundary handling.
- PR #27 requested complete responsive ticket cards and ticket-specific Open actions.
- PR #28 requested public Attachment metadata, API-origin download URLs, max-five and ownership checks, and complete removed-Attachment metadata.
- PR #29 requested dependency-approval evidence, current review records, Answer Parts 1-9 evidence mapping, clean-clone E2E setup, accurate E2E-02 claims, and rendered primary-green actions.
- PR #29 later requested correction for deterministic My Tickets client test behavior, truthful dependency-approval wording, incomplete Answer Parts 6-9 screenshot evidence claims, clean-clone `DATABASE_URL` setup, stronger keyboard evidence, and reopened Issue #22 status.

## My Responses To Review Comments

Each recorded blocker was corrected on its original feature branch and verified before that PR was approved and merged by the assigned reviewer.

## Pull Requests I Reviewed For My Partner

| PR | Repository | Lab 2 issue / title | Author | My review action | Evidence |
|---|---|---|---|---|---|
| [#25](https://github.com/thananun-7203/toktickit/pull/25) | `thananun-7203/toktickit` | [Lab 2] Issue_5: Ticket Detail & Attachments | @thananun-7203 | Changes requested; later approved; merged by @cottonlnwza | User-provided GitHub PR page evidence; branch `feature/5-ticket-detail-and-attachments` -> `lab2-staging`; related issue #27; changes requested `pullrequestreview-5109423798`; approval `pullrequestreview-5109714097`; merge `d40ef62`; GitHub page showed yesterday; topics: attachment concurrency fixes, atomic soft removal, removal reason requirement, retained metadata, AI-use documentation/model/prompt table, CI/test evidence |
| [#30](https://github.com/thananun-7203/toktickit/pull/30) | `thananun-7203/toktickit` | [Lab 2] Issue_7: Zen Green UI Alignment | @thananun-7203 | Approved; merged by @cottonlnwza | User-provided GitHub PR page evidence; branch `feature/7-zen-green-ui-alignment` -> `lab2-staging`; related issue #27; approval `pullrequestreview-5113383184`; merge `3daa3b8`; GitHub page showed 16 hours ago; topics: Zen Green color tokens, requester UI redesign, responsive desktop/tablet/mobile behavior, no horizontal overflow, navbar/menu behavior, UI tests and Playwright evidence |
| Other Lab 2 PRs | `thananun-7203/toktickit` | Pending verification | Pending verification | Pending verification | No additional public record could be verified |

## Notes

- Record only real PR links, comments, approvals, and merge evidence.
- Peer reviewer must approve and merge PRs.
- The author and AI assistant must not merge PRs.
- PR #29 was approved by @chaproi and merged into `lab2-staging`; Issue #22 is complete.
- The `lab2-staging` to `main` release PR does not exist yet and remains pending.
