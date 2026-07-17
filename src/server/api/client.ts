import 'server-only';

import { BackofficeApiError } from './errors';
import type { BackofficeApiEnvelope, BackofficeFetchOptions } from './types';

/** Surface prefix centralized here — the ONE place to change if the backoffice surface moves. */
const BACKOFFICE_API_PREFIX = 'backoffice/api/v1';

function resolveConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.BACKOFFICE_API_BASE_URL;
  const apiKey = process.env.API_KEY; // NEVER NEXT_PUBLIC_*

  if (!baseUrl) {
    throw new BackofficeApiError('BACKOFFICE_API_BASE_URL is not set', {
      statusCode: 0,
      errorCode: 'CONFIG_MISSING_BASE_URL',
    });
  }
  if (!apiKey) {
    throw new BackofficeApiError('API_KEY is not set', {
      statusCode: 0,
      errorCode: 'CONFIG_MISSING_API_KEY',
    });
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: BackofficeFetchOptions['query'],
): string {
  const clean = path.replace(/^\/+/, '');
  const url = new URL(`${baseUrl}/${BACKOFFICE_API_PREFIX}/${clean}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
    }
  }
  return url.toString();
}

async function parseEnvelope<T>(res: Response): Promise<BackofficeApiEnvelope<T>> {
  if (res.status === 204) {
    return { data: undefined as T, statusCode: 204, errorCode: null, errorMessage: null };
  }

  const text = await res.text();
  const json = text ? (JSON.parse(text) as BackofficeApiEnvelope<T>) : null;

  if (!res.ok) throw BackofficeApiError.fromResponse(res, json);
  if (json && json.errorCode) throw BackofficeApiError.fromEnvelope(res.status, json);

  return json ?? { data: undefined as T, statusCode: res.status, errorCode: null, errorMessage: null };
}

/**
 * Base fetch for the `backoffice/api/v1` surface. Always injects `x-api-key`
 * (harmless on open routes) and defaults to `cache: 'no-store'` since this is
 * admin data that must be fresh. Returns the FULL envelope — bindings unwrap
 * `.data` themselves so `meta` (pagination, etc.) survives for callers that
 * need it.
 *
 * Throws `BackofficeApiError` on missing config, network failure, non-2xx
 * status, or a 2xx envelope carrying a non-null `errorCode` — never a raw
 * fetch `TypeError`.
 */
export async function backofficeApiFetch<T>(
  path: string,
  options?: BackofficeFetchOptions,
): Promise<BackofficeApiEnvelope<T>> {
  const { baseUrl, apiKey } = resolveConfig();
  const method = options?.method ?? 'GET';
  const url = buildUrl(baseUrl, path, options?.query);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    ...options?.headers,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: options?.cache ?? 'no-store',
      next: options?.next,
      signal: options?.signal,
    });
  } catch (err) {
    throw BackofficeApiError.fromNetwork(err);
  }

  return parseEnvelope<T>(res);
}
