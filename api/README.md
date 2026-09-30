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

Example:

```bash
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

The frontend app lives in `../web`.
