# External CRM integration

The repository now contains a provider-neutral CRM adapter in `server/integrations/crm-adapter.js`. It is an adapter boundary, not a replacement CRM.

## Provider contract status

No external CRM provider contract is currently present in this repository. The following information is still required before enabling a real provider:

- Provider name and API version
- Base URL and exact case-list/case-detail paths
- Authentication scheme and secret storage requirements
- External case identifier and version/ETag fields
- Incremental synchronization cursor or `updatedSince` semantics
- Pagination and rate-limit response headers
- Webhook URL, signature scheme, replay protection, and event schema
- Approved outbound update endpoints, allowed fields, workflow states, and reviewer permissions
- Provider retention and deletion semantics

The adapter deliberately refuses to run without an explicit contract and injected client. It does not invent provider endpoints or claim a successful CRM integration.

## Internal mapping

Permitted case fields map into internal intelligence references:

- category/type -> signal title/category
- state, LGA, ward, polling unit -> internal geography
- urgency/priority -> source metadata
- disposition/status -> source metadata
- resolution status -> source metadata
- provider case ID and source timestamps -> source metadata and synchronization audit

Caller names, phone numbers, email addresses, and free-form personal data are not copied into the operational intelligence signal. Only a provider caller reference may be retained when supplied and approved.

## Synchronization behavior

- Incremental sync uses the provider-supplied cursor or update timestamp through `listCases({ cursor, updatedSince, limit })`.
- Cases are deduplicated by provider, external case ID, and source version/timestamp.
- Retryable errors are limited to HTTP 408, 425, 429, and 5xx responses with bounded exponential backoff.
- Every import and skipped record creates a durable CRM synchronization audit entry.
- Outbound updates are disabled until the provider contract and approved workflow are supplied; `sendUpdate()` fails closed.

A production deployment must provide the concrete provider client as an adapter implementation and test it against the provider’s documented contract before enabling synchronization.
