import 'server-only';

import { backofficeApiFetch } from '../client';

/**
 * Confirmed against the live OpenAPI schema (`HelthCheckData` — typo is in
 * the backend itself) and a real call to `GET backoffice/api/v1/health`,
 * which returned:
 *   { "status": "ok", "version": "0.0.1", "message": "Alive and kicking backoffice api version: 0.0.1" }
 * All three fields are required in the schema, so no permissive fallback.
 */
export interface BackofficeHealthDto {
  status: string;
  version: string;
  message: string;
}

/** GET backoffice/api/v1/health — open (unauthenticated) liveness probe. */
export async function getBackofficeHealth(options?: {
  signal?: AbortSignal;
}): Promise<BackofficeHealthDto> {
  const envelope = await backofficeApiFetch<BackofficeHealthDto>('health', {
    method: 'GET',
    signal: options?.signal,
  });
  return envelope.data;
}
