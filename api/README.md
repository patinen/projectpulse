# ProjectPulse API

This is the ProjectPulse NestJS API.

## Local development

```bash
npm install
npm run start:dev
```

Default URL: http://localhost:3001

## Endpoints

- `GET /health`

## Environment

Set the following environment variables as needed:

- `PORT` for the API listen port (default: `3001`)
- `CORS_ORIGIN` for allowed frontend origins
- `DATABASE_URL` for PostgreSQL connectivity

Example:

```bash
PORT=3001
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://projectpulse:projectpulse@localhost:5432/projectpulse?schema=public
```

## Local PostgreSQL

Local development:

```bash
npm run db:migrate
```

Production or staging deployment:

```bash
npm run db:deploy
```

1. Start PostgreSQL from the API folder:

```bash
docker compose up -d
```

2. Create `api/.env` from `.env.example`.

3. Run the local Prisma migration:

```bash
npm run db:migrate
```

4. Start the API:

```bash
npm run start:dev
```

To stop the local database:

```bash
docker compose down
```

The frontend app lives in `../web`.

## GitHub OAuth

ProjectPulse uses a GitHub OAuth App for the initial authenticated user flow. The app currently requests only the public identity needed to identify the signed-in developer.

GitHub OAuth App local configuration:

- Homepage URL: http://localhost:3000
- Redirect URI: http://localhost:3001/auth/github/callback
- Wildcard matching: disabled

Required environment variables:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `WEB_URL`
- `AUTH_SESSION_SECRET`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

Generate strong values with Node crypto:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Notes:

- GitHub access tokens are encrypted at rest using AES-256-GCM before persistence.
- ProjectPulse sessions use an HttpOnly cookie for the signed session.
- No repository permissions are requested yet; the OAuth app intentionally uses the default public-access profile only.
