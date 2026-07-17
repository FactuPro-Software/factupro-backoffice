export interface BackofficeApiErrorInit {
  statusCode: number;
  errorCode?: string | null;
  errorData?: unknown;
  cause?: unknown;
}

/**
 * Typed error thrown by `backofficeApiFetch` on non-2xx status, non-null
 * `errorCode` in an otherwise-2xx envelope, or a network failure.
 *
 * NOTE: `Object.setPrototypeOf` is required here because this project's
 * tsconfig targets ES2017 — subclassing `Error` without it breaks
 * `instanceof BackofficeApiError` checks at runtime.
 */
export class BackofficeApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string | null;
  readonly errorData: unknown;

  constructor(message: string, init: BackofficeApiErrorInit) {
    super(message);
    this.name = 'BackofficeApiError';
    this.statusCode = init.statusCode;
    this.errorCode = init.errorCode ?? null;
    this.errorData = init.errorData;
    if (init.cause !== undefined) (this as { cause?: unknown }).cause = init.cause;
    Object.setPrototypeOf(this, BackofficeApiError.prototype);
  }

  /** Non-2xx HTTP response. */
  static fromResponse(res: Response, body: unknown): BackofficeApiError {
    const b = (body ?? {}) as {
      errorMessage?: string;
      message?: string;
      errorCode?: string;
      data?: unknown;
    };
    return new BackofficeApiError(
      b.errorMessage || b.message || `HTTP ${res.status}: ${res.statusText}`,
      { statusCode: res.status, errorCode: b.errorCode ?? null, errorData: b.data },
    );
  }

  /** 2xx HTTP response whose envelope carries a non-null `errorCode`. */
  static fromEnvelope(
    status: number,
    body: { errorMessage?: string | null; errorCode?: string | null; data?: unknown },
  ): BackofficeApiError {
    return new BackofficeApiError(body.errorMessage || 'Backoffice API error', {
      statusCode: status,
      errorCode: body.errorCode ?? null,
      errorData: body.data,
    });
  }

  /** `fetch` itself threw (DNS, connection refused, timeout, etc.). */
  static fromNetwork(cause: unknown): BackofficeApiError {
    return new BackofficeApiError('Network request to backoffice API failed', {
      statusCode: 0,
      errorCode: 'NETWORK_ERROR',
      cause,
    });
  }
}
