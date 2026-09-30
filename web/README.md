# ProjectPulse Frontend

This is the ProjectPulse Next.js frontend.

## Local development

```bash
npm install
npm run dev
```

Default URL: http://localhost:3000

## Environment

Set `NEXT_PUBLIC_API_URL` in your environment or `.env.local` to point at the backend API. `NEXT_PUBLIC_*` values are embedded during the Next.js build, so the production value must be present when the web app is built in Coolify.

Example:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Production example:

```bash
NEXT_PUBLIC_API_URL=https://api.pulse.pat1.online
```

The backend app lives in `../api`.
