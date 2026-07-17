# factupro-backoffice

Next.js 16 admin app for factupro. Talks to `factupro-backend`'s `backoffice/api/v1/` surface via a server-only API client (see `src/server/api/README.md`).

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Notes |
|----------|----------|-------|
| `BACKOFFICE_API_BASE_URL` | Yes | Base URL of the `factupro-backend` deployment exposing `backoffice/api/v1`. Varies per environment (dev/staging/prod) — never hardcode `localhost` as a real default. |
| `API_KEY` | Yes (except for `GET /health`, which is unauthenticated) | Static shared secret sent as the `x-api-key` header on every request to the backoffice API surface. **Obtained out-of-band from the backend team** — it is not seeded anywhere in this repo or the backend repo. Never commit a real value, and never prefix it `NEXT_PUBLIC_` (that would leak it into the browser bundle). |

Both variables are read only on the server (see `src/server/api/client.ts`); the client throws a descriptive error before making any network request if either is missing.

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # eslint --fix
npm run check:types  # tsc --noEmit
```
