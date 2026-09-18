# TokTickIT

TokTickIT is a requester-facing IT ticketing application for the CPE334
Software Engineering course. Lab 2 adds requester context, ticket creation and
discovery, requester-owned detail views, and Attachment lifecycle management.

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
- `e2e/lab-02/` contains the required requester-flow Playwright tests.
- `artifacts/lab-02/screenshots/` contains generated responsive visual evidence.

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
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/toktickit_lab2"
export FRONTEND_ORIGIN="http://localhost:5173"
```

Lab 3 browser authentication uses credentialed requests and accepts the
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

For Lab 3, create an empty PostgreSQL development database or point
`DATABASE_URL` at the completed Lab 2 database. Do not commit or share the
connection value. Prepare it from `server/` with the Lab 3 deployment command:

```bash
npm run prisma:deploy:lab3
npm exec -- prisma generate --schema prisma/schema.prisma
npm run prisma:seed
```

`prisma:deploy:lab3` is required for the Lab 2 -> Lab 3 transition because
legacy Requesters receive newly generated per-user scrypt password hashes while
their existing ids, Ticket ownership, and Attachment actor references are
preserved. The command applies the earlier Prisma migrations, performs the
transactional Lab 3 data migration, and then records the committed Lab 3
migration in Prisma migration history. After this succeeds, ordinary future
`prisma migrate deploy` runs remain compatible with `_prisma_migrations`.

Do not run `prisma migrate deploy` directly for the first Lab 3 transition. The
committed Lab 3 migration contains a guard that fails closed and tells the
operator to use `npm run prisma:deploy:lab3` instead.

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

Run the Lab 2 Playwright flow from the repository root:

```bash
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts
```

## Lab 2 Scope

Lab 2 provides Development Requester selection for testing, Create Ticket, My
Tickets, requester-owned Ticket Detail, and Attachment upload, download, and
soft removal. It does not provide authentication, IT Staff or Administrator
workflows, comments, Internal Notes, Actions Taken, or later status workflows.
