# `src/server/api/` — Backoffice API Client

Server-only infrastructure for calling factupro-backend's `backoffice/api/v1/` surface.

## Layout

```
src/server/api/
  client.ts             # backofficeApiFetch<T> — config, headers, fetch, envelope parsing. server-only.
  errors.ts             # BackofficeApiError class + factory statics. Isomorphic (no server-only).
  types.ts              # BackofficeApiEnvelope<T>, BackofficeFetchOptions, HttpMethod. Isomorphic.
  endpoints.catalog.ts  # BACKOFFICE_ENDPOINTS — full reference of backend endpoints, bound or not. Isomorphic.
  endpoints/
    health.ts           # getBackofficeHealth() — the reference binding.
```

Only Server Components, Server Actions, and Route Handlers may call into `endpoints/*` (or `client.ts` directly). Every file that touches the fetch pipeline or the `API_KEY` secret starts with `import 'server-only';`, so a `'use client'` component importing any binding fails the build instead of leaking the key into the browser bundle.

## Adding a new binding

1. Create or append to `endpoints/<controller>.ts`, starting with `import 'server-only';`.
2. Hand-write the DTO(s) for the endpoint's response shape.
3. Add a thin function that calls `backofficeApiFetch<T>(path, options)` and unwraps `.data` (or returns the full envelope when you need `.meta`, e.g. pagination).
4. Flip that endpoint's `bound: true` in `BACKOFFICE_ENDPOINTS` (`endpoints.catalog.ts`).
5. Call the new function only from a Server Action, Route Handler, or Server Component.

### Example — binding `GET system-roles`

```ts
// src/server/api/endpoints/system-roles.ts
import 'server-only';
import { backofficeApiFetch } from '../client';

export interface SystemRoleDto {
  id: string;
  name: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

/** GET backoffice/api/v1/system-roles */
export async function listSystemRoles(options?: {
  query?: { limit?: number; offset?: number };
  signal?: AbortSignal;
}): Promise<{ items: SystemRoleDto[]; total?: number }> {
  const env = await backofficeApiFetch<SystemRoleDto[]>('system-roles', {
    method: 'GET',
    query: options?.query,
    signal: options?.signal,
  });
  return { items: env.data, total: env.meta?.total };
}
```

Path params are interpolated by the binding itself (e.g. `` `system-roles/${id}` ``); the catalog stores the `:id` template form for documentation purposes.

## Errors

Every call throws a typed `BackofficeApiError` (never a raw `fetch` `TypeError`) on:
- missing `API_KEY` / `BACKOFFICE_API_BASE_URL` (before any network request)
- network failure (`errorCode: 'NETWORK_ERROR'`)
- non-2xx HTTP status
- a 2xx envelope with a non-null `errorCode`

Callers can branch on `.statusCode` / `.errorCode`. There is no redirect-on-401 — the `x-api-key` is static infra-level, not a user session, so a 401/403 signals misconfiguration and is left for the caller to handle.
