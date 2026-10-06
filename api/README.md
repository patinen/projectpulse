# ProjectPulse API

Backend and operator guide for the NestJS HTTP API and separate BullMQ worker. See the [root README](../README.md) for the product overview, architecture diagram, full local setup, and roadmap. Repository access is **public only**, limited to repositories returned by the authenticated user's GitHub listing.

## Local setup

Use Node **>=22.22.3 <23** and npm. From `api/`:

```bash
npm ci
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate
```

Use `Copy-Item .env.example .env` in PowerShell. Fill the OAuth and secret values described below before signing in. The API and worker load `.env.local` before `.env`; keep both files uncommitted.

Start these commands in separate terminals, each from `api/`:

```bash
npm run start:dev
```

```bash
npm run start:worker:dev
```

The API defaults to `http://localhost:3001`. Start the frontend separately using [web/README.md](../web/README.md). Local Compose runs PostgreSQL 16 and Redis 7, publishing ports 5432 and 6379 with a persistent PostgreSQL volume. Its database credentials are development defaults, not production values.

## Synchronization and persistence

- The API's `DashboardSyncScheduler` runs cron `*/15 * * * *`: every 15 minutes it queries distinct users with tracked repositories and enqueues one dashboard sync per user. The worker does not host the scheduler.
- The API produces jobs in the Redis-backed `dashboard-sync` queue. The separate worker consumes them, uses `DashboardAggregationService` to fetch GitHub repository data, and persists the result through `DashboardSnapshotService`.
- `DashboardSnapshot` stores per-user totals, capture time, and recent activity JSON. Related `RepositoryMetricSnapshot` rows store repository observations. Both are written in one Prisma transaction.
- BullMQ uses a per-user deduplication ID (`dashboard-sync-<userId>`) for outstanding work, rather than a permanent custom job ID. Later refreshes can run after a job finishes.
- Jobs have three total attempts and exponential backoff starting at 30 seconds. Completed and failed job retention is capped at 20 and 50 jobs respectively; these queue limits do not delete PostgreSQL snapshots.
- Tracking/untracking attempts to enqueue an immediate refresh. Queue failures are logged without undoing the tracking operation. Scheduler enqueue failures are logged and processing continues for other users.
- A sync skips repositories that return not-found errors. Other aggregation or persistence failures reject the job so BullMQ can retry.
- Dashboard reads return the latest persisted snapshot, including when a later sync fails. If none exists and the user tracks repositories, the HTTP request performs a live fallback aggregation and saves it. With no snapshot and no tracked repositories, it returns an empty dashboard.
- Tracking changes do not immediately rewrite an existing snapshot; dashboard membership catches up after a successful refresh.
- PostgreSQL snapshot retention cleanup and stored daily rollups are not implemented. History is not backfilled.

Most repository-data aggregation happens in the worker, outside request handling. Exceptions are the dashboard fallback, OAuth token exchange/profile lookup, and repository listing/validation during discovery and tracking. Analytics and activity endpoints make no live GitHub requests.

## Endpoints

Dashboard, repository, activity, and `/auth/me` endpoints require the `pp_session` cookie. The frontend sends credentialed requests.

| Method / route | Behavior |
| --- | --- |
| `GET /health` | Public health check; executes PostgreSQL `SELECT 1`, returns 503 if the database is unavailable. Does not check Redis or worker health. |
| `GET /auth/github` | Starts OAuth with a state cookie and redirects to GitHub. |
| `GET /auth/github/callback` | Validates state, exchanges the code, stores encrypted token material, sets the application session, and redirects to `WEB_URL`. |
| `GET /auth/me` | Returns the authenticated user's profile. |
| `POST /auth/logout` | Clears the application session cookie; returns 204. |
| `GET /dashboard` | Latest stored dashboard, with the initial fallback described above. |
| `POST /dashboard/refresh` | Enqueues synchronization; returns 202 with `{ status: 'queued' }`, or 503 if enqueueing fails. It does not return refreshed metrics. |
| `GET /repositories` | Live public GitHub repository listing with stored tracking flags, wrapped as `{ repositories }`. |
| `POST /repositories/:githubId/track` | Validates against the user's public GitHub listing, upserts the repository/tracking relation, and attempts to enqueue refresh. Optional body `githubId` must match the route. |
| `DELETE /repositories/:githubId/track` | Removes the user's tracking relation and attempts to enqueue refresh; returns 204. Does not delete the repository record. |
| `GET /repositories/:githubId/analytics?range=30d` | Stored repository metric history for a repository the user currently tracks. |
| `GET /activity?range=30d&kind=all&repository=owner/repo` | Reconstructed activity from the user's persisted dashboard snapshots. |

### Repository analytics

- Ranges: `7d`, `30d`, `90d`; default `30d`. Unsupported values return 400.
- Requires the user to currently track the repository; otherwise returns 404.
- Current values come from the newest repository snapshot for that user, independently of the selected history range.
- History selects the last observation within each UTC day in the requested rolling time window. This is read-time reduction, not a persisted rollup or daily total.
- Metrics: open issues, open pull requests, and rolling seven-day commits, with current last-activity/capture timestamps and language metadata.
- With no snapshots, `current` is null and `history` is empty. Historical metric coverage begins with captured observations, not the repository's creation date.

### Activity history

- Ranges: `7d`, `30d`, `90d`; default `30d`.
- Kinds: `all`, `commit`, `issue`, `pr`; default `all`. Unsupported ranges/kinds return 400.
- Optional `repository` is a trimmed, exact full-name match.
- Reads snapshots captured in the selected window, then filters their events by occurrence time. Stable event IDs deduplicate entries, with newer snapshots winning.
- Repository filter options come from all reconstructed events in the time range, **before** kind/repository filtering, and include current tracking metadata when available.
- Events are returned newest first, capped at 100. `meta.eventCount` counts all matching events before that cap; `meta.latestSnapshotAt` identifies the latest snapshot in the window.
- Each dashboard snapshot stores only the ten newest aggregated activity entries across repositories. The feed can retain observed events across snapshots, but is not a complete GitHub event log. Issue entries come from open issues observed during synchronization; PR activity represents merged pull requests.

## Environment and authentication

Use [`.env.example`](.env.example) as the configuration template. Never commit real secrets.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` for secure OAuth/session cookies. |
| `PORT` | API listen port; default `3001`. |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins; default `http://localhost:3000`. Credentialed CORS is enabled. |
| `DATABASE_URL` | Server-side PostgreSQL connection used by Prisma, API, and worker. |
| `REDIS_URL` | Server-side BullMQ connection; defaults to local Redis. |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID used by the API. |
| `GITHUB_CLIENT_SECRET` | OAuth token-exchange secret used by the API. |
| `GITHUB_CALLBACK_URL` | OAuth callback; default `http://localhost:3001/auth/github/callback`. |
| `WEB_URL` | Post-login redirect; default `http://localhost:3000`. |
| `AUTH_SESSION_SECRET` | Signs/verifies the seven-day application JWT session. |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | Base64 key decoding to exactly 32 bytes for AES-256-GCM encryption of stored GitHub tokens. |

For local OAuth, register homepage `http://localhost:3000` and callback `http://localhost:3001/auth/github/callback`. Run the following twice and assign separate generated values to `AUTH_SESSION_SECRET` and `GITHUB_TOKEN_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

The authorization URL sets no explicit `scope` parameter; private repository access is not requested. Public visibility is enforced in repository listing and tracking validation. OAuth state is checked against an HTTP-only cookie. The application session uses the HTTP-only `pp_session` cookie with `SameSite=Lax`, secure in production, and a seven-day lifetime. Stored GitHub token ciphertext includes its encryption version, IV, authentication tag, and ciphertext; the plaintext token is decrypted server-side for GitHub requests.

The worker needs `DATABASE_URL`, `REDIS_URL`, and `GITHUB_TOKEN_ENCRYPTION_KEY`. It also imports the shared auth module through `GitHubModule`; retain `AUTH_SESSION_SECRET` in its environment as documented by the template. It does not execute OAuth token exchange and does not need `GITHUB_CLIENT_SECRET`. Neither database nor Redis credentials belong in `NEXT_PUBLIC_*` variables.

## Production runtime

The live Coolify deployment is recorded in [issue #7](https://github.com/patinen/projectpulse/issues/7), with automatic deployment recorded in [issue #1](https://github.com/patinen/projectpulse/issues/1). The settings below describe the repository's runtime setup; they do not assert a new end-to-end production validation.

API and worker require Node **>=22.22.3 <23**, as declared in `package.json`. `nixpacks.toml` pins the Nixpkgs archive used to resolve a compatible Node environment; the previous default resolved Node 22.11.0, as documented in the deployment history.

| Coolify setting | API | Worker |
| --- | --- | --- |
| Base directory | `/api` | `/api` |
| Install | `npm ci --include=dev` | `npm ci --include=dev` |
| Build, in order | `npm run db:generate`, `npm run build` | `npm run db:generate`, `npm run build` |
| Start | `npm run start:prod:migrate` | `npm run start:worker` |
| Port | `3001` | No HTTP port |
| Public domain | `https://api.pulse.pat1.online` | None |
| Health check | `GET /health` | No HTTP health endpoint |

`start:prod:migrate` runs `prisma migrate deploy` before the API starts. The worker starts `node dist/worker.js` and does not run migrations; apply the schema through the API deployment before relying on worker persistence.

Use dedicated private ProjectPulse PostgreSQL and Redis resources shared by API and worker, rather than reusing the Directus database. The public frontend runs separately from `/web` on port 3000. See [web/README.md](../web/README.md) for its build-time API URL requirement.

Production API configuration uses `CORS_ORIGIN` and `WEB_URL` set to `https://pulse.pat1.online`, and `GITHUB_CALLBACK_URL=https://api.pulse.pat1.online/auth/github/callback`. Supply real credentials only through the deployment environment.

## Validation

From `api/`:

```bash
npm ci
npm run db:generate
npm run lint
npm run test
npm run build
```

`npm run test:watch` and `npm run test:cov` provide watch/coverage modes. `npm run test:e2e` runs the isolated Supertest health-route test with a mocked `AppService`; it does not need live PostgreSQL, Redis, or OAuth credentials and does not verify their integration. For architectural follow-ups, see the [root roadmap](../README.md#current-limitations--roadmap).
