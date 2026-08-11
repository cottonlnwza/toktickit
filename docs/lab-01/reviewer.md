# Lab 1 — Peer Review Record

**Author:** Thanakorn Soison — GitHub: @cottonlnwza
**Peer reviewer:** Tanboon Teawsawat — GitHub: @Tanaboonnnnn

## Pull Requests I Authored

| Issue | PR | Branch | Reviewer verdict |
|---|---|---|---|
| Issue #1 Project Foundation | https://github.com/cottonlnwza/toktickit/pull/2 | `feature/1-project-foundation` | APPROVED |
| Issue #2 Health Check | https://github.com/cottonlnwza/toktickit/pull/3 | `feature/2-health-check` | APPROVED |
| Issue #3 Category Database + Seed | https://github.com/cottonlnwza/toktickit/pull/5 | `feature/3-category-seed` | APPROVED |
| Issue #4 Display IT Request Category List | https://github.com/cottonlnwza/toktickit/pull/7 | `feature/4-category-list` | APPROVED |

## Reviewer Feedback I Received

### PR #2 — Issue #1 Project Foundation

The reviewer approved the PR and verified that:

- client build/dev start passed
- server build/dev start passed
- Prisma validate/DB connection passed
- Vitest was configured
- Supertest was configured
- README exists
- `.env` was not committed
- server health test returning 501 was acceptable for Issue 1

### PR #3 — Issue #2 Health Check

The reviewer approved the PR and verified that:

- `GET /api/health` returns HTTP 200 with the correct response
- React calls the real backend health API
- loading, Online, and Offline/error states exist
- the error message is useful when the backend is unavailable
- tests/builds were reported as passing
- category work remained outside Issue 2 scope

### PR #5 — Issue #3 Category Database + Seed

The reviewer approved the PR and verified that:

- the Prisma Category model exists with `id`, unique `name`, and `createdAt`
- the migration creates the Category table
- exactly four required categories are seeded
- `upsert` makes the seed idempotent
- database credentials were not committed

### PR #7 — Issue #4 Display IT Request Category List

The reviewer approved the PR and verified that:

- `GET /api/categories` reads from PostgreSQL through Prisma
- the API returns `id` and `name` in predictable order
- Supertest covers the category API
- React displays categories from the real API, not hard-coded values
- loading and error states exist
- Vitest covers the category list UI

## Final Release PR

| PR | Source | Target | Initial verdict | Final verdict |
|---|---|---|---|---|
| https://github.com/cottonlnwza/toktickit/pull/8 | `lab1-staging` | `main` | CHANGES_REQUESTED | APPROVED |

Reviewer feedback:

The implementation for Issues 1-4 was complete, but the final PR description was missing and needed a summary.

My response:

I added a complete PR description containing:

- Issue 1-4 summaries
- final server/client test and build verification
- Online category list
- Offline error behavior
- integration path `lab1-staging` -> `main`

## Pull Requests I Reviewed For My Partner

| Partner repository | PR | Role | Integration path | Review verdict |
|---|---|---|---|---|
| https://github.com/Tanaboonnnnn/toktickit | https://github.com/Tanaboonnnnn/toktickit/pull/10 | Final Pull Request Review | `lab1-staging` -> `main` | COMMENT |

During my review, I checked that:

- `GET /api/health` returns HTTP 200 with the expected status and service name
- `GET /api/categories` retrieves category data from PostgreSQL through Prisma in predictable order
- the database seed uses `upsert` and can run repeatedly without duplicate categories
- the frontend supports Online and Offline states and displays categories from the backend API
- backend and frontend automated tests are included
- README covers installation, environment configuration, database setup, running the application, and testing

Documentation feedback I raised:

1. Reviewer Student ID was not included in the public `reviewer.md`.
2. One reviewer GitHub username was inconsistent.
3. Partner response field had not been filled in.
4. I asked for confirmation that the final `lab1-staging` -> `main` PR was recorded as submission evidence.

Partner response:

- Student IDs will not be published in the public repository and will instead be included in the course PDF submission.
- The inconsistent GitHub username was corrected.
- Partner clarified that Partner response was not required for the final documentation.
- The final `lab1-staging` -> `main` PR was confirmed as part of the report evidence.
