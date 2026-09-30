# ProjectPulse

ProjectPulse is a GitHub repository and engineering analytics dashboard for tracked public repositories. It combines repository health, activity history, contributor signals, and PostgreSQL-backed snapshots into a durable developer overview.

## Current features

- GitHub OAuth sign-in
- public repository tracking
- live GitHub synchronization
- PostgreSQL snapshot persistence
- historical repository analytics
- SVG metric trends
- snapshot-derived activity feed
- Redis / BullMQ background synchronization
- 15-minute scheduler refreshes
- retry/backoff and queue deduplication
- separate API and worker runtime architecture

## Current stack

Frontend:
- Next.js
- TypeScript
- React
- Tailwind CSS

Backend:
- NestJS
- TypeScript
- Prisma
- PostgreSQL

Background processing:
- Redis
- BullMQ

External:
- GitHub REST API
- GitHub OAuth

## Architecture

```text
Browser
   |
   v
Next.js
   |
   v
NestJS API --------> PostgreSQL
   |
   v
Redis / BullMQ
   |
   v
Worker
   |
   v
GitHub API
```

The worker writes fresh snapshot data, while normal dashboard and history reads are served primarily from PostgreSQL-backed snapshots.

## Local development

### Frontend

```bash
cd web
npm install
npm run dev
```

The frontend runs on http://localhost:3000 by default.

### API

```bash
cd api
npm install
npm run start:dev
```

The API runs on http://localhost:3001 by default.

### Worker

```bash
cd api
npm install
npm run start:worker:dev
```

## Intended production deployment URLs

- Frontend: https://pulse.pat1.online
- API health: https://api.pulse.pat1.online/health

These are intended deployment URLs until the production environment is actually verified.

## Repository layout

```text
projectpulse/
├── api/        # NestJS API + worker runtime
├── web/        # Next.js frontend
├── README.md
└── .gitignore
```