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

The backend uses the `DATABASE_URL` value from `server/.env` to connect to
PostgreSQL.

For Lab 2, create an empty PostgreSQL development database such as
`toktickit_lab2`, then manually set `DATABASE_URL` in `server/.env` to that
database without committing or sharing the value. Prepare it from `server/`:

```bash
npm exec -- prisma migrate deploy
npm exec -- prisma generate --schema prisma/schema.prisma
npm run prisma:seed
```

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
