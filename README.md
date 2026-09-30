# ProjectPulse

ProjectPulse is a developer and project analytics dashboard for GitHub repositories. It brings together repository activity, pull requests, issues, contributors, and development metrics into a single workspace for engineering teams.

## Current architecture

Next.js frontend
        |
        v
NestJS API
        |
        v
GitHub API + PostgreSQL (planned)

GitHub integration and PostgreSQL are planned for future work and are not implemented yet.

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

## Repository layout

```text
projectpulse/
├── api/        # NestJS API
├── web/        # Next.js frontend
├── README.md
└── .gitignore
```