import type { HttpMethod } from './types';

/** 'ops' = Lambda/cron/cache-maintenance endpoints, filterable out of an admin UI nav. */
export type BackofficeEndpointKind = 'admin' | 'ops';

export interface BackofficeEndpoint {
  controller: string;
  method: HttpMethod;
  path: string; // surface-relative, may contain :params, e.g. 'system-roles/:id'
  purpose: string;
  kind: BackofficeEndpointKind;
  requiresApiKey: boolean; // false only for the open GET /health
  bound?: boolean; // true once a typed binding exists under endpoints/
}

/**
 * Reconciled against the live OpenAPI spec at
 * `backoffice/api/v1/docs-json` (factupro-backend-development, 2026-07-17).
 * All entries below are CONFIRMED against that spec — no `INFERRED` markers
 * remain. Notable corrections vs the original design draft:
 *   - `invoices/cache/invalidate` does not exist; replaced by two more
 *     specific DELETE endpoints (currency-pair and merchant cache).
 *   - `merchants` delete uses `:id`, not `:nif`.
 *   - `system-roles/:id` and `permissions/:id` updates are `PUT`, not `PATCH`.
 *   - `merchants/resend-invitation-root` and `partner-api-key/:id/deactivate`
 *     matched the design draft exactly.
 */
export const BACKOFFICE_ENDPOINTS = [
  {
    controller: 'health',
    method: 'GET',
    path: 'health',
    purpose: 'Liveness probe',
    kind: 'admin',
    requiresApiKey: false,
    bound: true,
  },

  {
    controller: 'system-roles',
    method: 'GET',
    path: 'system-roles',
    purpose: 'List roles',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'system-roles',
    method: 'GET',
    path: 'system-roles/:id',
    purpose: 'Get role by ID',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'system-roles',
    method: 'POST',
    path: 'system-roles',
    purpose: 'Create role',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'system-roles',
    method: 'PUT',
    path: 'system-roles/:id',
    purpose: 'Update role',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'system-roles',
    method: 'DELETE',
    path: 'system-roles/:id',
    purpose: 'Remove role',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'system-roles',
    method: 'PUT',
    path: 'system-roles/add-permission/:id',
    purpose: 'Add permission to role',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'system-roles',
    method: 'PUT',
    path: 'system-roles/remove-permission/:id',
    purpose: 'Remove permission from role',
    kind: 'admin',
    requiresApiKey: true,
  },

  {
    controller: 'permissions',
    method: 'GET',
    path: 'permissions',
    purpose: 'List permissions',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'permissions',
    method: 'GET',
    path: 'permissions/:id',
    purpose: 'Get permission by ID',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'permissions',
    method: 'POST',
    path: 'permissions',
    purpose: 'Create permission',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'permissions',
    method: 'PUT',
    path: 'permissions/:id',
    purpose: 'Update permission',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'permissions',
    method: 'DELETE',
    path: 'permissions/:id',
    purpose: 'Remove permission',
    kind: 'admin',
    requiresApiKey: true,
  },

  {
    controller: 'cron-task-recurring-invoices',
    method: 'GET',
    path: 'cron-task-recurring-invoices/due-today',
    purpose: 'List recurring invoices due today',
    kind: 'ops',
    requiresApiKey: true,
  },
  {
    controller: 'cron-task-recurring-invoices',
    method: 'POST',
    path: 'cron-task-recurring-invoices/:id/process',
    purpose: 'Process one recurring invoice',
    kind: 'ops',
    requiresApiKey: true,
  },
  {
    controller: 'cron-task-recurring-invoices',
    method: 'POST',
    path: 'cron-task-recurring-invoices/run',
    purpose: 'Run recurring-invoice batch',
    kind: 'ops',
    requiresApiKey: true,
  },

  {
    controller: 'invoices-cache',
    method: 'DELETE',
    path: 'invoices/cache/currency/:fromCurrency/:toCurrency',
    purpose: 'Invalidate cached exchange rate for a currency pair',
    kind: 'ops',
    requiresApiKey: true,
  },
  {
    controller: 'invoices-cache',
    method: 'DELETE',
    path: 'invoices/cache/merchant/:merchantId',
    purpose: 'Invalidate all cached data for a merchant (preferences, tags, etc.)',
    kind: 'ops',
    requiresApiKey: true,
  },
  {
    controller: 'invoices-cache',
    method: 'GET',
    path: 'invoices/cache/health',
    purpose: 'Cache system health check',
    kind: 'ops',
    requiresApiKey: true,
  },

  {
    controller: 'users',
    method: 'GET',
    path: 'users/find-user-merchants',
    purpose: 'Find merchants for a user',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'users',
    method: 'GET',
    path: 'users/active-stats',
    purpose: 'Active user stats',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'users',
    method: 'GET',
    path: 'users/:userId/actions',
    purpose: 'User action/audit history',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'users',
    method: 'POST',
    path: 'users/invite-advicer',
    purpose: 'Invite advicer user',
    kind: 'admin',
    requiresApiKey: true,
  },

  {
    controller: 'merchants',
    method: 'GET',
    path: 'merchants/check-nif/:nif',
    purpose: 'Check NIF availability',
    kind: 'admin',
    requiresApiKey: true,
    bound: true,
  },
  {
    controller: 'merchants',
    method: 'POST',
    path: 'merchants',
    purpose: 'Create merchant',
    kind: 'admin',
    requiresApiKey: true,
    bound: true,
  },
  {
    controller: 'merchants',
    method: 'POST',
    path: 'merchants/resend-invitation-root',
    purpose: 'Resend invitation to a user in a merchant',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'merchants',
    method: 'DELETE',
    path: 'merchants/:id',
    purpose: 'Delete a merchant',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'merchants',
    method: 'PATCH',
    path: 'merchants/:nif/kit_digital',
    purpose: 'Update Kit Digital subsidy fields (end date, extension plan, internal ref)',
    kind: 'admin',
    requiresApiKey: true,
    bound: true,
  },
  {
    controller: 'merchants',
    method: 'POST',
    path: 'merchants/:nif/ghl_upload',
    purpose: 'GHL upload',
    kind: 'admin',
    requiresApiKey: true,
  },

  {
    controller: 'partner-api-key',
    method: 'POST',
    path: 'partner-api-key',
    purpose: 'Create partner API key',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'partner-api-key',
    method: 'GET',
    path: 'partner-api-key',
    purpose: 'List partner API keys',
    kind: 'admin',
    requiresApiKey: true,
  },
  {
    controller: 'partner-api-key',
    method: 'PATCH',
    path: 'partner-api-key/:id/deactivate',
    purpose: 'Deactivate a partner API key (logical delete)',
    kind: 'admin',
    requiresApiKey: true,
  },

  {
    controller: 'merchant-pricing',
    method: 'GET',
    path: 'merchant-pricing/by-nif/:nif',
    purpose: 'Resolved account (owner-scoped, D3) + pricing for the matched merchant, by NIF',
    kind: 'admin',
    requiresApiKey: true,
    bound: true,
  },
  {
    controller: 'merchant-pricing',
    method: 'GET',
    path: 'merchant-pricing/by-user-email',
    purpose: 'Resolved account (owner-scoped, D3) + pricing for every merchant the user owns, by email',
    kind: 'admin',
    requiresApiKey: true,
    bound: true,
  },
  {
    controller: 'merchant-pricing',
    method: 'PATCH',
    path: 'merchant-pricing/:merchantId/expiration-date',
    purpose: 'Update plan expiration date (trial / digital_kit only)',
    kind: 'admin',
    requiresApiKey: true,
    bound: true,
  },

  {
    controller: 'account-deletion',
    method: 'GET',
    path: 'account-deletion/:userId/impact',
    purpose:
      'Preview full deletion impact for the entryPoint/nif-derived target set: row counts, VERIFACTU exposure, third-party exposure',
    kind: 'admin',
    requiresApiKey: true,
    bound: true,
  },
  {
    controller: 'account-deletion',
    method: 'DELETE',
    path: 'account-deletion/:userId',
    purpose: 'Irreversibly delete the entryPoint/nif-derived target-merchant set (and the user, if eligible)',
    kind: 'admin',
    requiresApiKey: true,
    bound: true,
  },
] as const satisfies readonly BackofficeEndpoint[];
