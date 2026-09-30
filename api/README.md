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
