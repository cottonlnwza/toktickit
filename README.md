# TokTickIT

TokTickIT is an IT ticketing application for the CPE334 Software Engineering
course. The current Lab 4 increment completes the core service-desk workflow
with Actions Taken, final Ticket lifecycle rules, Requester/IT Staff dashboards,
Administrator support/testing parity, and final responsive/accessibility
hardening while preserving the completed Labs 1-3 behavior.

## Technology Stack

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma ORM
- API style: REST
- Testing: Vitest, Supertest, and Playwright

## Project Structure

- `client/` contains the React frontend application.
- `server/` contains the Express backend API and Prisma setup.
- `docs/lab-01/` contains Lab 1 documentation and evidence notes.
- `docs/lab-02/` contains the Lab 2 engineering contract and evidence records.
- `docs/lab-03/` contains the Sprint 3 engineering contract, API/UI contracts,
  test traceability, peer-review record, AI-use record, and submission-evidence map.
- `docs/lab-04/` contains the Sprint 4 engineering contract, API/UI contracts,
  test traceability, peer-review record, and AI-use record.
- `e2e/lab-02/` contains the Lab 2 requester-flow Playwright regression.
- `e2e/lab-03/` contains Lab 3 authentication, Staff workflow, Administrator,
  responsive/accessibility, and visual-evidence Playwright coverage.
- `e2e/lab-04/` contains Lab 4 Actions Taken, final Ticket workflow, dashboard,
  responsive/accessibility, failure/conflict, and visual-hardening Playwright coverage.
- `artifacts/lab-02/screenshots/` contains Lab 2 responsive visual evidence.
- `artifacts/lab-03/screenshots/` contains the required Lab 3 desktop/tablet/mobile
  visual evidence.
- `artifacts/lab-04/screenshots/` contains the required Lab 4 Staff Dashboard,
  Requester Dashboard, and Actions Taken desktop/tablet/mobile visual evidence.

## Local Setup

Install the root Playwright dependency from a clean clone:

```bash
npm install
npx playwright install chromium
```

Install frontend dependencies:

```bash
cd client
npm install
```

Install backend dependencies:

```bash
cd server
npm install
```

Create local environment files from the examples:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

The real `.env` files are for local development only and must not be committed.
The current server runtime reads `DATABASE_URL` from the shell environment, so
export the same value before running Prisma commands or starting the API:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/toktickit"
export FRONTEND_ORIGIN="http://localhost:5173"
```

Lab 4 browser authentication uses credentialed requests and accepts the
configured `FRONTEND_ORIGIN` rather than wildcard credentialed CORS. The local
default remains `http://localhost:5173`.

## Running The App

Start the backend API:

```bash
cd server
npm run dev
```

Start the frontend app in a separate terminal:

```bash
cd client
npm run dev
```

## Database And Prisma

The Prisma schema is located at `server/prisma/schema.prisma`.

The backend uses the `DATABASE_URL` shell environment variable to connect to
PostgreSQL.

For Lab 4, create an empty PostgreSQL development database or point
`DATABASE_URL` at the completed Lab 3 database. Do not commit or share the
connection value. Prepare it from `server/` with the Lab 4 deployment command:

```bash
npm run prisma:deploy:lab4
npm exec -- prisma generate --schema prisma/schema.prisma
npm run prisma:seed
```

`prisma:deploy:lab4` applies the completed Labs 1-3 migration chain and the Lab 4
Actions Taken/Ticket revision migration while preserving legacy Tickets,
ownership, comments, notes, Attachments, and authentication data. The Lab 4 seed
is idempotent and provides all major Ticket statuses plus zero/one/multiple
Actions Taken and dashboard examples.

Do not use reset commands against an existing database. Start the backend and
frontend as shown above before running Playwright.

## Testing

Run frontend tests:

```bash
cd client
npm test
```

Run backend tests:

```bash
cd server
npm test
```

Run the Lab 2 Playwright regression from the repository root:

```bash
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts
```

Run the required Lab 3 Playwright flows from the repository root. The Lab 3
Playwright configuration starts fresh server/client processes against a guarded
isolated PostgreSQL database whose name must end in `_test`; it refuses the
normal development database.

```bash
npx playwright test \
  e2e/lab-03/authentication.spec.ts \
  e2e/lab-03/staff-ticket-flow.spec.ts \
  e2e/lab-03/user-administration.spec.ts \
  e2e/lab-03/visual-evidence.spec.ts
```

Run the final Lab 4 Playwright suite from the repository root. The shared
Playwright setup uses an isolated `_test` PostgreSQL database, deploys the Lab 4
schema, and seeds Lab 4 fixtures before the viewport project runs:

```bash
npx playwright test e2e/lab-04
```

The Lab 4 suite runs desktop (1440×900), tablet (820×1180), and mobile
(390×844) projects and records the required visual evidence under
`artifacts/lab-04/screenshots/`.

## Lab 4 Documentation

- Engineering contract: `docs/lab-04/specification.md`
- Test plan and traceability: `docs/lab-04/tests.md`
- UI contract and completed visual/accessibility checklist: `docs/lab-04/ui-spec.md`
- API contract: `docs/lab-04/api-spec.md`
- Peer-review record: `docs/lab-04/reviewer.md`
- AI-use record and reflection: `docs/lab-04/ai-use.md`

## Lab 3 Documentation

- Engineering contract: `docs/lab-03/specification.md`
- Test plan and traceability: `docs/lab-03/tests.md`
- UI contract: `docs/lab-03/ui-spec.md`
- API contract: `docs/lab-03/api-spec.md`
- Peer-review record: `docs/lab-03/reviewer.md`
- AI-use record and reflection: `docs/lab-03/ai-use.md`
- Submission evidence map: `docs/lab-03/submission-evidence.md`

## Lab 3 Scope

Lab 3 supports the three roles Requester, IT Staff, and Administrator. It
replaces the Development Requester selector with authenticated identity,
preserves Requester Create Ticket/My Tickets/Ticket Detail/Attachment behavior,
adds the Staff Queue and permitted Ticket operations, and adds minimalist User
Management. Actions Taken, notification services, multi-role users, user
deletion, advanced account administration, and production/cloud deployment
remain outside Lab 3 scope.
