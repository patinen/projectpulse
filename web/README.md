# ProjectPulse Frontend

The Next.js frontend renders the engineering overview, public repository tracking, repository analytics, and activity history. It handles loading, empty, and error states and calls the NestJS API through `src/lib/api.ts`. The API owns OAuth, sessions, repository access, and persistence. See the [root README](../README.md) for system architecture and full local setup.

## Local development

Start the API and worker as described in [api/README.md](../api/README.md#local-setup). Use the repository's Node 22 version (**>=22.22.3 <23**) to work with both packages. From `web/`:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

In PowerShell, use `Copy-Item .env.example .env.local`. Open `http://localhost:3000` and use **Connect GitHub** to sign in through the API. There is no unauthenticated demo mode yet.

## API configuration

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
```

`src/lib/api.ts` uses `NEXT_PUBLIC_API_URL`, trimmed, with `http://localhost:3001` as the fallback when absent or blank. The sign-in link in `AppShell` also uses this variable with a localhost fallback; configure a nonblank URL without surrounding whitespace or a trailing slash. Authenticated API calls send `credentials: 'include'` for the API's session cookie. Configure the API's `CORS_ORIGIN` to allow the frontend origin, and its `WEB_URL` for the post-login redirect.

Only the public API base URL belongs in frontend configuration. Database/Redis connection strings, OAuth client secrets, session secrets, and token encryption keys stay in the backend environment.

## Routes

| Route | Responsibility |
| --- | --- |
| `/` | Snapshot-backed engineering overview, tracked repository summaries, and recent activity. |
| `/repositories` | Public repository discovery and track/untrack actions. |
| `/repositories/[githubId]` | Repository metrics and SVG trends with 7d / 30d / 90d ranges. |
| `/activity` | Snapshot-derived history with time-range, event-type, and repository filters. |

The shared `AppShell` provides navigation, GitHub sign-in, profile display, and logout. Analytics and activity views read history through the API; the frontend does not synchronize GitHub directly.

## Production build

The live frontend URL is `https://pulse.pat1.online`, as recorded in [issue #7](https://github.com/patinen/projectpulse/issues/7). Coolify uses `/web` as the base directory, installs with `npm ci --include=dev`, builds with `npm run build`, and starts with `npm run start` on port 3000.

Set this value in the **build environment**:

```dotenv
NEXT_PUBLIC_API_URL=https://api.pulse.pat1.online
```

Next.js embeds `NEXT_PUBLIC_*` values in the browser bundle at build time. Changing only the runtime environment after a build is insufficient; rebuild to change the API target.

## Validation

From `web/`:

```bash
npm ci
npm run lint
npm run build
```

There is currently no frontend test script. The build uses `next/font/google` for Geist fonts, so building requires access to the font provider. Backend validation commands are documented in [api/README.md](../api/README.md#validation).
