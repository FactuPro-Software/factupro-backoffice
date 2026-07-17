export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface BackofficeApiEnvelope<T> {
  data: T;
  statusCode: number;
  errorCode: string | null;
  errorMessage: string | null;
  meta?: { total?: number; limit?: number; offset?: number; [k: string]: unknown };
}

export interface BackofficeFetchOptions {
  method?: HttpMethod;
  body?: unknown; // JSON.stringify'd when present
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>; // merged over defaults
  cache?: RequestCache; // default 'no-store'
  next?: { revalidate?: number | false; tags?: string[] };
  signal?: AbortSignal;
}
