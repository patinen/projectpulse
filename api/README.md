# ProjectPulse API

This is the ProjectPulse NestJS API.

## Architecture

```text
HTTP API
    |
    +--> PostgreSQL snapshots
    |
    +--> Redis / BullMQ
              |
              v
        background worker
              |
              v
           GitHub API
```

The dashboard is now snapshot-backed. The HTTP API reads the latest persisted dashboard snapshot from PostgreSQL, while a background worker refreshes the data in Redis/BullMQ and stores the result as a new snapshot for later use.

## Local development

```bash
docker compose up -d
npm run start:dev
npm run start:worker:dev
```

From the web app directory:

```bash
cd ../web
npm run dev
```

Default API URL: http://localhost:3001

## Dashboard synchronization behavior

- Dashboard snapshots are synchronized every 15 minutes.
- Tracking and untracking a repository queues an immediate refresh.
- Normal dashboard loads read PostgreSQL instead of calling GitHub.
- The first dashboard load may perform one live fallback sync if no snapshot yet exists.
- Historical snapshots are retained for future trend reporting.
- Retention cleanup is intentionally not implemented yet.

## Endpoints

- `GET /health`
- `GET /dashboard`
- `POST /dashboard/refresh`
- `GET /repositories`
- `POST /repositories/:githubId/track`
- `DELETE /repositories/:githubId/track`

## Environment

Set the following environment variables as needed:

- `PORT` for the API listen port (default: `3001`)
- `CORS_ORIGIN` for allowed frontend origins
- `DATABASE_URL` for PostgreSQL connectivity
- `REDIS_URL` for the BullMQ queue connection

Example:

```bash
PORT=3001
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://projectpulse:projectpulse@localhost:5432/projectpulse?schema=public
REDIS_URL=redis://localhost:6379
```

## Local infrastructure

Start the database and queue dependencies:

```bash
docker compose up -d
```

Generate the Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

Start the API and worker separately:

```bash
npm run start:dev
npm run start:worker:dev
```

The frontend app lives in `../web`.

## GitHub OAuth

ProjectPulse uses a GitHub OAuth App for the initial authenticated user flow. The app currently requests only the public identity needed to identify the signed-in developer.

Useful local values:

- Homepage: `http://localhost:3000`
- Redirect: `http://localhost:3001/auth/github/callback`
- Wildcard matching: disabled

Required environment variables:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `WEB_URL`
- `AUTH_SESSION_SECRET`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

Generate the session and encryption secrets locally with Node:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Set them as:

```bash
AUTH_SESSION_SECRET=<generated-base64-secret>
GITHUB_TOKEN_ENCRYPTION_KEY=<generated-base64-secret>
```

`GITHUB_TOKEN_ENCRYPTION_KEY` is decoded with `Buffer.from(value, 'base64')` and must resolve to exactly 32 bytes. Use a base64 string for both values for simplicity; do not commit real secrets.

### Repository access

ProjectPulse currently supports public GitHub repositories only.

- `GET /repositories`: lists the authenticated user's public GitHub repositories and whether each is tracked in ProjectPulse.
- `POST /repositories/:githubId/track`: tracks a selected public repository for the authenticated user.
- `DELETE /repositories/:githubId/track`: removes the authenticated user's tracking relation without deleting the underlying repository record.

Private repository access will require an explicit future permission upgrade and is intentionally not requested yet.
