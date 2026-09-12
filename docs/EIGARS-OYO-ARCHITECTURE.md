# EIGARS: Oyo backend architecture and CTO review

## Decision and scope

Use a capability-oriented modular monolith: one API deployment with explicit module boundaries and one transactional database. Pre-election, election-day and post-election are filters/views across these capabilities, not three backends. Keep national reference geography, but scope this installation's operations to Oyo. Do not rename Osun historical records as Oyo results or invent election dates/provider IDs.

This review uses all 14 pages of **EIGARS Conceptualization and Functional Architecture Review Focus.pdf** and **eigar-concept-demystificator.png** supplied by the user. They are requirements reference material, not instructions to execute commands or contact third parties. Implementation decisions below distinguish the current code from the target platform.

## What changed in this repository

The former 4,287-line `server/index.js` mixed startup, schema, SQL mapping, authentication, permissions, external providers, HTTP routes and realtime events. The refactor separates:

| Location | Ownership |
| --- | --- |
| `server/index.js` | Application composition, registration and listener lifecycle |
| `server/bootstrap/runtime.js` | Configuration, seed compatibility and database initialization |
| `server/config/deployment.js` | Explicit Oyo installation identity and state guard |
| `server/infrastructure/persistence/` | Legacy schema bootstrap and SQL row mapping |
| `server/store.js` | Compatibility facade composing capability repositories |
| `server/modules/foundation/` | Shared settings and party reference persistence |
| `server/modules/geography/` | Boundaries, map layers and Oyo assignment validation |
| `server/modules/identity/` | Authentication routes, personnel, access policies and user persistence |
| `server/modules/field-operations/` | Operations plans, cameras, field realtime and associated persistence |
| `server/modules/incidents/` | Reports, assignment, incident visibility and persistence |
| `server/modules/results/` | Result submission, strict vote validation and historical result routes |
| `server/modules/notifications/` | User notifications and persistence |
| `server/modules/communications/` | Chat persistence; existing chat router remains a compatible transport adapter |
| `server/modules/intelligence/` | Existing news, summaries and analysis routes |
| `server/integrations/` | IReV, geocoding, AI provider clients and TURN credentials |
| `server/middleware/` | Authentication and HTTP protections |

The public endpoint paths remain compatible. Deliberate behavior changes: login throttling is applied; Oyo assignment/result scope is validated; manual command-centre results are no longer labelled official IReV; missing/invalid/duplicate party entries are rejected; incident updates use authorized viewers; the Osun pilot remains enabled as a separately labelled reference, per the user's instruction; unknown API routes return JSON 404 rather than the frontend HTML.

Module route functions receive dependencies explicitly. Repositories own SQL/JSON access. The existing store facade preserves callers during migration; it is not permission to add arbitrary cross-domain SQL. Introduce application services when a use case spans repositories and requires one transaction. Do not move business logic back into the composition root.

## Capability review

For every capability, geography is a shared key; producers and consumers exchange records or events with provenance. The entries below cover purpose, users, functions, data, producers/consumers, workflows, outputs/actions, dependencies, lifecycle use, priority and MVP/later split.

### A. Election data foundation and master data

- **Purpose/objective:** a governed vocabulary and identity system for elections and places, preventing mismatched joins and duplicate polling units.
- **Users/functions:** data stewards and administrators register elections, source datasets, geography identifiers, party/contest references and import versions; validate and quarantine bad rows.
- **Data/producers/consumers:** reference agencies and approved importers produce source releases, elections, constituencies, polling units and registered-voter statistics; every other capability consumes approved records.
- **Workflow/GIS:** acquire -> validate -> map provider identifiers -> review -> publish a version; every record points to its geographic parent and source version.
- **Outputs/actions/reports:** completeness and import-rejection reports; missing/duplicate identifier alerts; assigned data-quality corrections.
- **Dependencies/lifecycle:** identity and audit first. Before election: establish baseline; election day: use the frozen operational release; after: preserve the release used for comparisons.
- **Priority:** P0. MVP: Oyo catalog, source classification, election identity and import checks. Later: managed revision history and national source reconciliation.
- **Current:** national name-based catalog, settings and party storage exist. Canonical source-versioned geography tables and import governance remain to implement.

### B. Geospatial and location intelligence

- **Purpose/objective:** answer what exists, what is happening, what is needed and who is responsible for a selected Oyo geography.
- **Users/functions:** command centre, coordinators and analysts drill down, roll up, inspect boundaries and join personnel, reports, coverage and evidence.
- **Data/producers/consumers:** approved boundary/catalog imports and field observations feed geography; intelligence, resource, incident and reporting capabilities consume it.
- **Workflow/GIS:** resolve an observation to a validated unit -> aggregate by parent -> expose a dated operational picture. Preserve unknown positions; do not substitute a headquarters coordinate for missing data.
- **Outputs/actions/reports:** coverage maps, location quality reports, unmapped-record alerts and missing-assignment tasks.
- **Dependencies/lifecycle:** master data and access policy. Before: coverage planning; day: geographic monitoring; after: location-based reconciliation and performance.
- **Priority:** P0. MVP: Oyo LGA/ward/PU validation and drill-down. Later: PostGIS indexes, precomputed aggregates, tiles and documented spatial precision.
- **Current:** boundary and layer routes, catalog lookups and assignment validation exist. `GET /api/geography/operational-view` (`server/modules/geography/operational-view.js`) now joins personnel, readiness/CRM/other signals, incidents, results, resource adequacy/requirements, connectivity analysis, evidence summaries, tasks and outcomes (verified incidents, completed tasks, decision outcomes) for one role-scoped, validated Oyo geography, with drill-down/roll-up by administrative level and bounded, paginated reads (`incidentsPage`/`resultRecordsPage` run real SQL `LIMIT`/`OFFSET` against Postgres; the still key-value-backed domains — signals, decisions, resources, connectivity, tasks — are filtered and paginated in application code, not SQL, and remain a scaling limitation confirmed by `scripts/benchmark-geographic-view.mjs`). Personnel and camera coordinates that were never supplied now read back as `null` instead of silently defaulting to the Oyo command-centre point (`7.3775, 3.9470`) — this affected both `server/infrastructure/persistence/mappers.js` and the create/update routes. Camera `state`/`lga`/`ward`/`polling_unit` were also being silently dropped on every Postgres round-trip (missing table columns), which meant `canAccessGeography` denied non-admin viewers all cameras in Postgres mode; this is now persisted. Composite `(lga, ward, polling_unit)` btree indexes were added for `users`, `cameras`, `incidents` and `result_records`; a governed GIS database with true PostGIS/GiST spatial indexing on geometry remains future work, since these columns are still plain `double precision` coordinates, not a geometry type. Separately, `getRegistrationLocationOptions` keys (e.g. `IBADAN NORTH`) used different casing/hyphenation than a natural-language input like "Ibadan North", and the dataset's own casing/hyphenation was inconsistent between entries (`IBADAN NORTH EAST` has no hyphen, `IBADAN SOUTH-EAST` does) — this affected `validateOyoAssignment` and `resolveGeographyScope` identically, since both did an exact-string `.includes()` check. This is now fixed: `shared/nigeriaPollingData.js` exports `resolveCanonicalName(candidates, rawValue)`, a casing/punctuation-tolerant matcher, and both validators resolve through it, storing the dataset's canonical casing rather than whatever casing the caller submitted (`server/modules/geography/validation.test.js`, `server/modules/foundation/geography-query.test.js`). This was not a live bug in the shipped web UI, since its dropdowns already source values from the same canonical list — the risk was for any other caller (a script, a future client, a CSV/CRM import routed through the API) submitting natural-language casing. The unused, separately-hand-maintained `OYO_LGAS` list in `shared/electionData.js` was left as-is (confirmed referenced nowhere else in the codebase) since it plays no role in this validation path.

### C. Field operations and agent management

- **Purpose/objective:** know who is assigned and whether reports and responses reach the correct operational location.
- **Users/functions:** agents, supervisors and command staff manage assignments, plans, field reports, GPS presence and communications.
- **Data/producers/consumers:** personnel registry, assignments, readiness, check-ins and observations originate from field staff and supervisors; incident, resource and situation services consume them.
- **Workflow/GIS:** onboard -> assign geography -> prepare -> check in -> report -> acknowledge tasks -> submit completion evidence.
- **Outputs/actions/reports:** deployment/readiness and missing-report views; absence or overdue-response alerts and supervisor follow-up.
- **Dependencies/lifecycle:** identity, geography, evidence and notification services. Before: readiness/training; day: presence/reporting; after: debrief and performance review.
- **Priority:** P0. MVP: identity, assignment and reliable capture. Later: offline durable queue, attendance verification, device registration and training attestations.
- **Current:** accounts, assignments, operation plans, incident capture and realtime exist. GPS presence is ephemeral and is not an attendance ledger; offline sync remains to implement.

### D. Pulse, situation and sentiment

- **Purpose/objective:** combine recent operational signals into an evidence-aware common picture, without counting the same event repeatedly.
- **Users/functions:** analysts, coordinators and command staff classify signals, assess freshness, correlate duplicates and summarize uncertainty.
- **Data/producers/consumers:** field reports, CRM cases, resource gaps, connectivity observations and media references feed situation views; decisions and reporting consume the aggregates.
- **Workflow/GIS:** ingest -> classify -> geo-reference -> deduplicate -> contextualize -> aggregate with time window and confidence.
- **Outputs/actions/reports:** polling readiness, reporting gaps, emerging operational hotspots and stale-source alerts. Sentiment is aggregated feedback with sampling limitations, never an inferred attribute of individual voters.
- **Dependencies/lifecycle:** master data, integrations, CRM and reporting. Before: readiness/issues; day: live situation; after: issue trends and resolution analysis.
- **Priority:** P1, after reliable capture. MVP: deterministic counts and freshness. Later: validated statistical trend detection and transparent aggregated sentiment methods.
- **Current:** news and analysis endpoints exist. A unified signal taxonomy, deduplication and durable situation projections remain to implement.

### E. Resource requirement, allocation and deployment

- **Purpose/objective:** compare evidenced requirements with available and delivered resources, and close operational shortages.
- **Users/functions:** logistics officers, coordinators and command staff plan requirements, allocate, dispatch, acknowledge receipt, assess adequacy and record returns/utilization.
- **Data/producers/consumers:** logistics inventories, field requests and staffing plans produce quantities, units, availability and movement records; situation/decision/reporting services consume gaps and utilization.
- **Workflow/GIS:** requirement -> approval -> allocation -> dispatch -> arrival confirmation -> adequacy check -> reallocation -> utilization review, keyed to destination geography.
- **Outputs/actions/reports:** shortage/excess reports, overdue-delivery alerts, accountable replenishment and reallocation tasks.
- **Dependencies/lifecycle:** geography, personnel, tasking and audit. Before: forecast requirements; day: delivery and shortage response; after: returns and effectiveness.
- **Priority:** P1. MVP: typed resources, manual approved requirements, dispatch/receipt. Later: defensible estimation and capacity optimization.
- **Current:** operation plans provide limited logistics planning. Inventory, reservations, delivery and adequacy transactions remain to implement.

### F. Incident, alert, escalation and response

- **Purpose/objective:** turn operational exceptions into accountable responses with verified completion.
- **Users/functions:** field staff report; supervisors triage; command assigns; response teams acknowledge, act and supply evidence; authorized reviewers verify.
- **Data/producers/consumers:** incidents, urgency, location, evidence, assignments and timestamps flow from field/CRM; notifications, situation and decision services consume them.
- **Workflow/GIS:** report -> triage -> assign -> acknowledge -> respond -> resolve -> independently verify; escalation uses overdue thresholds and geographic responsibility.
- **Outputs/actions/reports:** incident backlog, response time, unacknowledged assignment and overdue verification reports; notifications route only to authorized participants.
- **Dependencies/lifecycle:** geography, identity, evidence, audit and reliable notifications. Before: readiness incidents; day: safety/process response; after: resolution and lessons.
- **Priority:** P0 for capture/assignment; P1 for audited task state machine and escalation. Verification cannot be inferred from a reporter selecting Resolved.
- **Current:** capture, status, assignment and notifications exist. A persisted transition ledger, deadlines, independent outcome verification and atomic assignment-plus-notification remain to implement.

### G. Results, verification and evidence

- **Purpose/objective:** preserve what was submitted, by whom and from which source, and distinguish observations from official publication.
- **Users/functions:** agents/supervisors capture forms; command reviews; analysts reconcile like-for-like election/contest/PU records.
- **Data/producers/consumers:** signed-form photos, manual counts, portal records, source IDs and timestamps feed results; discrepancies feed incidents and authorized reporting.
- **Workflow/GIS:** capture -> validate -> preserve original -> review transcription -> compare same contest/unit/source version -> flag discrepancy -> record verification decision.
- **Outputs/actions/reports:** evidence coverage, pending review and discrepancy reports; assigned reconciliation tasks. Missing counts remain unknown, and incomplete submissions are never a final declaration.
- **Dependencies/lifecycle:** election identity, geography, evidence storage, identity and audit. Before: historical baselines; day: capture/reconcile; after: preserve, verify and compare.
- **Priority:** move minimum result provenance/evidence integrity to P0 if results are in the release; advanced reconciliation is P1.
- **Current:** manual capture, source labelling, signed-photo requirement, validation and IReV integration exist. Result records still use the legacy incidents table and JSON count field. Dedicated result/evidence tables, immutable object storage, hashes, custody ledger and separate verification approvals remain to implement.

### H. Actionable intelligence and executive decision support

- **Purpose/objective:** expose operational exceptions with evidence, options and a named accountable decision-maker.
- **Users/functions:** executives and command staff inspect priorities, record decisions, assign tasks and review outcomes.
- **Data/producers/consumers:** verified/qualified signals, incidents, resource gaps and result discrepancies feed decision support; field teams and reporting consume approved tasks/outcomes.
- **Workflow/GIS:** data -> signal -> context -> insight -> priority -> alert -> human decision -> assignment -> action -> verification -> outcome, preserving links to source records and geography.
- **Outputs/actions/reports:** exception brief, response options, overdue decisions, assignments and outcome tracking; no autonomous material operational decisions.
- **Dependencies/lifecycle:** foundation plus field/incident/resource/result capabilities. Before: readiness exceptions; day: operational decisions; after: outcome review.
- **Priority:** P1. MVP: transparent deterministic rules and human decisions. Later: statistically validated models with evaluation and change control; LLM summaries remain labelled generated analysis.
- **Current:** local deterministic summaries and optional LLM calls exist. Neither is a decision ledger or an outcome-verification engine. Every generated response (`/api/news/summary`, `/api/analysis/ai`, and the IReV OCR extraction) now carries a governance envelope (`server/modules/foundation/generation-provenance.js`): a required `generationType` (`deterministic-rule` for the local/statistical fallbacks, `generative-ai` for a real Groq/Gemini/OpenAI call), `provider`, `model`, `generatedAt`, `inputRefs`, `uncertainty`, and `reviewStatus` (always `unreviewed` for now -- no reviewer UI consumes it yet). No predictive or machine-learning model is enabled anywhere in this codebase today, only deterministic rules and generative-AI text; that distinction is deliberate, not an oversight, and predictive/ML capability should not be enabled without a separate evaluation pass first. `decisions.approveDecision`/`updateDecision` already require a named human `approvedBy`/`verifiedBy` before a material stage transition -- this was not changed, only confirmed and now also written to the durable audit log below.

### I. Reporting and performance analytics

- **Purpose/objective:** measure coverage, timeliness, data quality and response performance against explicit denominators.
- **Users/functions:** leadership, analysts and monitoring/evaluation personnel inspect role-scoped read models and export reproducible reports.
- **Data/producers/consumers:** domain services publish observations/outcomes; report consumers receive aggregates with source version, time window and completeness.
- **Workflow/GIS:** aggregate authorized records -> label denominator and freshness -> present by phase/geography -> preserve report snapshot.
- **Outputs/actions/reports:** coverage, incident backlog, resource utilization, reconciliation and response-time dashboards; data-quality exceptions return to owning modules.
- **Dependencies/lifecycle:** foundation and each measured capability. Before: readiness baseline; day: operational indicators; after: comparative performance and lessons.
- **Priority:** P0 core counts; P1 cross-source comparisons. Later: materialized views, warehouse and scheduled reports.
- **Current:** `GET /api/reports/operational` (`server/modules/reporting/repository.js`) now accepts an explicit `since`/`until` time window, or a `phase` (`pre-election`/`election-day`/`post-election`) resolved against the optional `SIGAR_ELECTION_DATE` deployment config -- a phase request fails closed with 400 when no election date is configured rather than guessing one. The report joins incidents, the dedicated `result_records` store (dual-read alongside the legacy incident-tagged result count, per the staged-migration plan below, so the two can be compared during the transition), resource requirement/deployment records (with a utilization breakdown: adequate/underutilized/overstretched/unreviewed), result reconciliations (pending/reviewed/corrected/discrepancy counts), and tasks (acknowledgement latency, completed vs. open/overdue). Pending reconciliations and unreviewed decisions are reported in their own fields, never merged into a "final" count. `POST/GET /api/reports/operational/snapshots` persist an immutable copy of a generated report (keyed by id, filter, requester, phase) for later, reproducible reference; `GET /api/reports/operational/export` returns the geography rollups as CSV for an authorized download. Known gaps: reconciliation records carry only a flat polling unit (no LGA/ward), so an LGA/ward-only filter without a polling unit returns every matched-election reconciliation rather than a true geographic subset (documented in the report's own `metadata.limitations`); no reference-data release version is joined into the report yet (check `/api/reference-data/active` separately); only CSV export exists, not PDF; and this remains a live, on-demand read composition, not a materialized warehouse.

### J. Contact centre / CRM intelligence

- **Purpose/objective:** treat calls and complaints as structured operational observations linked to action and resolution.
- **Users/functions:** contact-centre agents and supervisors log cases, classify, locate, triage, refer, track disposition and close with evidence.
- **Data/producers/consumers:** authorized CRM integrations and operators produce contact cases and minimized source references; incidents, situation and decisions consume relevant case signals.
- **Workflow/GIS:** receive -> classify/location -> deduplicate against incidents -> refer -> track response -> close; protect caller details separately from shared aggregates.
- **Outputs/actions/reports:** topic volume, response backlog and unresolved-location reports; incident referrals and follow-up tasks.
- **Dependencies/lifecycle:** identity, geography, integration, incident and retention controls. Before: enquiries/readiness; day: complaints/escalations; after: case resolution and lessons.
- **Priority:** P1 after secure capture. MVP: manual structured intake/import. Later: contracted telephony/CRM connectors and auditable synchronization.
- **Current:** chat is a communications tool, not a CRM case management implementation. CRM remains to implement.

### K. Integration and interoperability

- **Purpose/objective:** isolate external failures and normalize data without losing the source representation.
- **Users/functions:** integration operators and data stewards manage adapters, refresh schedules, credentials, mapping and failed records.
- **Data/producers/consumers:** reference providers, GIS, IReV, connectivity and approved CRM sources feed validated records; owning domains consume canonical outputs.
- **Workflow/GIS:** acquire -> preserve source identity/time -> validate -> map provider geography IDs -> quarantine failures -> publish; retry using idempotency keys and bounded backoff.
- **Outputs/actions/reports:** source freshness, import error and reconciliation reports; stale-feed/operator alerts.
- **Dependencies/lifecycle:** foundation, secrets and observability. Before: baseline ingestion; day: refresh/availability; after: reproducible archives.
- **Priority:** P0 for critical reference sources, P1 for new connectors. Later: durable worker queues and dead-letter handling.
- **Current:** provider code is separated and existing timeouts/caches retained. Durable job orchestration and unified import records remain to implement. A shared `server/integrations/retry.js` (`requestWithRetry`) now provides bounded exponential backoff for retryable statuses (408/425/429/5xx), with an injectable clock/sleep so tests never wait on real timers or a live provider; `crm-adapter.js`'s previously duplicated retry logic was refactored onto it (its existing tests pass unchanged), and it is now also applied to `geocoding.js`'s reverse-lookup and `irev.js`'s `fetchIrevJson`, both with an injectable `fetchImpl` for the same reason. A malformed, oversized, or unsuccessful payload is quarantined immediately rather than retried, since retrying would not fix a structurally invalid response. Not covered: generic network-level failures with no HTTP status (matching the CRM adapter's existing, already-tested behavior, not a new gap), the IReV image proxy, and `ai-providers.js`'s Groq/Gemini calls (they have their own model-fallback and key-cooldown logic already, which is a different resilience strategy, not absent one).

### L. Security, governance, audit and administration

- **Purpose/objective:** enforce accountable access and preserve trustworthy operational records.
- **Users/functions:** administrators, security operators and authorized auditors manage identities, geographic responsibility, credentials, access review and retention.
- **Data/producers/consumers:** all domain actions produce audit events; security/review roles consume restricted audit and access records.
- **Workflow/GIS:** authorize role plus operational scope -> validate action -> persist domain change and audit event together -> deliver minimum necessary notifications -> retain according to approved policy.
- **Outputs/actions/reports:** access/credential change history, denied requests, audit gaps and retention reports; access revocation and incident-response tasks.
- **Dependencies/lifecycle:** foundational across all phases. Before: provisioning/review; day: least-privilege operation; after: archive, review and retention execution.
- **Priority:** P0. MVP: authenticated scoped operations, secure deployment, durable audit for material changes and evidence protection. Later: external identity provider, MFA, centralized secrets and organization-wide security monitoring.
- **Current:** JWT/password fingerprint checks, roles and rate limiting exist. The in-memory IP log is not a durable audit trail and remains diagnostic-only; it was not removed. `server/modules/foundation/repository.js`'s `createAuditEntry`/`appendAuditEntry`/`auditEvents` already existed and were wired into result submission; they are now also wired into identity (create/update/delete/role change/admin password reset), reference-data approval, incident create/delete, decision approve/update, and evidence access/grant/legal-hold/delete/retention-sweep -- via a shared `recordAudit` helper (`server/modules/foundation/audit-helper.js`), queryable at `GET /api/audit` (paginated, filterable by actor/entity/action/time window, Admin/Super Admin only). No update/delete method is exposed for audit events at the application layer; an additive Postgres trigger (`audit_events_append_only`) now also rejects UPDATE/DELETE at the database level, but this has not been exercised against a live Postgres in this environment -- verify it before relying on it. Resource-intelligence routes in `server/routes/area-operations.js` (requirement, availability, dispatch, arrival, reallocation, return, utilization review) are now also audited. Evidence retention is now a real, invokable action (`sweepExpiredEvidence`, `POST /api/evidence/retention/sweep`, Super Admin only) rather than only a policy number; there is still no automatic scheduler in this codebase, so an operator or external cron must trigger it. The `resolveSecurityPolicy` retention/access-review policy computed at boot was previously discarded entirely (computed, asserted in a unit test, never returned from `createRuntime` or exposed anywhere) -- it is now returned and exposed read-only at `GET /api/security/policy`. Access-review cadence enforcement is now real: `identity.recordAccessReview`/`accessReviewStatus` (`server/modules/identity/repository.js`) track when each Admin/Super Admin/Supervisor account was last reviewed and report it overdue past `accessReview.cadenceDays` (default 90) or if never reviewed; `POST /api/users/:id/access-review` records one (audited) and `GET /api/security/access-review` lists status for every admin-capable account. This is visibility and record-keeping, not a hard block -- it does not yet prevent an overdue account from acting. Audit-log pruning was deliberately **not** implemented: `auditLogsDays` (default 2555) is retention/archival guidance, and building an application-level bulk-delete for `audit_events` would directly contradict the append-only guarantee just established above (both the "no update/delete method" contract and the database trigger) -- long-term audit-log lifecycle should be an archival (cold-storage) process outside this application, not a delete path inside it. While auditing these routes, a pre-existing, unrelated bug was found and fixed: `emitAuthorized` was passed into `registerUserRoutes`/`registerIncidentRoutes` by `index.js` but never destructured in either function's signature, so user create/update/delete/role-change and incident delete threw `ReferenceError` after the underlying write had already succeeded -- now fixed and covered by `scripts/backend-smoke.mjs`.

## Geography and source semantics

Use `Nigeria -> Oyo -> LGA -> electoral registration area/ward -> polling unit` as the canonical electoral traversal. Keep administrative wards and registration areas separately typed if a supplied source genuinely distinguishes them, with explicit mappings. Do not manufacture a mandatory extra child level or equate provider codes by their numeric appearance. The [INEC polling-unit locator](https://cvr.inecnigeria.org/pu_locator/index) selects local government then registration area; the [nationwide polling-unit dataset](https://www.inecnigeria.org/wp-content/uploads/2023-Polling-Unit-list-Nationwide.pdf) publishes delimitation identifiers. Validate imported IDs against an approved release before production use.

The checked-in catalog currently contains names rather than complete canonical source IDs. Add a `geography_unit` table (type, canonical ID, parent ID, source/version, geometry and valid dates), `external_geography_id` mappings, and explicit constituency memberships. Constituencies cross the administrative presentation model and should not be forced into the parent chain. Store coordinates with accuracy/source and unknowns as null.

Every operational record ultimately needs `scopeId`, `electionId`, geography reference, producer, source classification, observed timestamp, received timestamp, validation state, source version and lineage references. Classification must be one of **authoritative/master**, **external reference**, **field observed**, **estimated/derived**, **model generated**. An administrator's role cannot convert a manual entry into official published data.

Election identity must include office/contest and source mapping; the current Oyo IReV adapter remains a specifically named 2027 governorship adapter. It must be explicitly configured and validated when a suitable source exists. Do not claim it is a generic multi-election service yet.

## Taxonomy: one picture, different meanings

| Concept | Meaning | Examples |
| --- | --- | --- |
| Pulse | Recent measured activity and freshness | check-ins, submissions/minute, reporting silence |
| Situation | Contextual operational state at a place/time | polling not open, material shortage, connectivity unavailable |
| Sentiment | Qualified aggregate perceptions from a known sample | aggregated contact-centre feedback; show sample size and limitations |
| Incident | An exception requiring managed resolution | SOS, intimidation report, BVAS failure |
| Action/response | Accountable work linked to an exception/decision | dispatch device, assign supervisor, confirm delivery |

Shared signals can contribute to more than one view using the same source ID. Count a CRM call and a field report about one incident as two observations of one event when corroborated, not automatically as two incidents. Categories should include readiness, presence, polling status, queues, materials, logistics, connectivity, safety, complaints, rumours, media references, results, escalation and intervention status. A rumour remains unverified until reviewed.

## Data and workflow implementation sequence

1. **P0 foundation:** approve Oyo reference releases and canonical identifiers; establish election/contest registry; validate mappings and existing records. Snapshot and back up the existing database before any data migration.
2. **P0 trust:** versioned migrations, geographic authorization, evidence provenance, durable append-only audit, separate database service credentials and tested restoration. New material writes must commit their audit record in the same transaction.
3. **P0 capture:** agent assignments, structured observations, incident triage and authorized dashboards; offline submission IDs with uniqueness constraints, payload hashes and replay/conflict rules. Include basic result provenance here if result capture ships.
4. **P1 response:** typed tasks, accountable owners, acknowledgment, deadlines, escalation, response evidence and independent verification. Persist notifications in a transactional outbox; publish/retry after commit.
5. **P1 operations:** resource requirements/inventory/dispatch, CRM cases, aggregated demographics and connectivity snapshots. Each has source and freshness metadata; do not invent coverage or population data.
6. **P1 intelligence:** deterministic thresholds, explainable priorities, cross-source situation views and qualified historical comparison. Add statistical/predictive models only after baselines, validation datasets and monitoring exist.

Use staged, additive schema migration: create new tables, backfill in batches with reconciliation counts, dual-read or adapt legacy responses, verify, switch writes, then retire legacy columns only in a later reviewed release. Do not drop result data to obtain a cleaner schema. PostgreSQL transactions and concurrency controls are needed for atomic workflow writes; see [PostgreSQL concurrency control](https://www.postgresql.org/docs/16/mvcc.html).

## Operational requirements and release gates

- **Offline and concurrency:** distinguish device time from server receipt; accept replay only when the same submission ID has the same payload; return conflict otherwise. Use expected record versions for competing updates. Current CRUD routes do not yet implement this contract.
- **Evidence:** original files in private object storage, server-side cryptographic hashes, MIME/size validation, malware scanning, short-lived authorized access and a custody ledger. Store OCR as a derived interpretation linked to the original. Hashes alone do not prove who captured an image.
- **Availability and recovery:** use PostgreSQL for the operational deployment; retain JSON only for local/single-process compatibility. Back up database and evidence together; exercise restore and define RPO/RTO with operations. [`docs/BACKUP_AND_RECOVERY.md`](BACKUP_AND_RECOVERY.md) now documents the coordinated database/evidence/media-state procedure with concrete commands and post-restore verification checks, but **it has not been exercised against a live database or object store in this environment** -- run it once against a disposable staging copy before relying on it. No disaster-recovery guarantee is established by this refactor.
- **Performance:** paginate large collections, index geographic/election/time access paths, use spatial indexes and bounded queries; move OCR and heavy processing to workers. `scripts/load-probe.mjs` provides a directional, actually-run-in-this-session load probe against the JSON-store dev server (see its own output for numbers) -- it is explicitly not a production capacity test (one machine, no Postgres, no realistic volume, HTTP only, no realtime/media load). Express also cautions that CPU-heavy work blocks request handling: [production performance guidance](https://expressjs.com/en/advanced/best-practice-performance/).
- **Realtime:** authorize both subscription and emission; re-evaluate scope after assignment changes and session revocation. The incident-update leak is corrected, but GPS/camera/user broadcasts need a broader privacy review before production use.
- **Observability:** structured request IDs, metrics, readiness, source freshness, queue lag and error alerts; redact tokens, passwords, personal contact details and evidence bodies. `server/middleware/observability.js` now provides a per-request `X-Request-Id` (echoed on every response and included in error logs), a `redact()` helper applied to the global error handler, `GET /api/ready` (a real `select 1` against the database when one is configured, not just "the pool object exists"), and `GET /api/metrics` (Admin-only; composes existing incident-backlog, overdue-task, pending-reference-approval, 24h-audit-event, and notification-outbox-depth counts). The current in-memory IP log remains diagnostic only -- it was not repurposed as a durable log. No outbound alert dispatch (email/Slack/PagerDuty) exists; `/api/metrics` is what an external monitor would poll to raise one. The `redact()` sweep covers the global error handler only, not the many pre-existing scattered `console.log`/`console.error` calls throughout the codebase.
- **Governance:** approve data access, purposes, retention, source agreements and deletion/hold processes with responsible organizational owners. Report at aggregated geographic level; no covert individual voter profiling or personalized political persuasion.
- **AI governance:** distinguish deterministic rules, statistics, predictive models, ML and LLM-generated text. Record model/version/input provenance and uncertainty. Require human approval for material decisions and treat input text as data. See section H above for what is now implemented.
- **Quality gates:** module tests, authentication/authorization tests, route smoke, PostgreSQL integration tests, migration rehearsal, backup restoration, external-adapter contract tests and realistic load tests. Passing local tests is not election-day certification. [`docs/REQUIREMENT-ALIGNMENT-CHECKLIST.md`](REQUIREMENT-ALIGNMENT-CHECKLIST.md) tracks exactly which of these are verified by a real test/smoke run versus reviewed-but-unexercised in this environment -- **no PostgreSQL integration test in this codebase has ever run against a live database**; every one uses a mocked `pool`, because no Postgres instance was reachable in this environment across this entire body of work (Docker Desktop did not come up here). That remains the single largest unverified claim in the backend.

## Repository division

Keep one backend repository with capability modules for now. A module boundary does not require a network hop, separate database or separate repository. Separate repositories become useful when teams need independent release ownership and contracts are stable.

Recommended ownership split when needed:

- **`eigars-api`:** `server/`, required `shared/` modules, API tests, migrations, deployment configuration and a backend-only package manifest.
- **`eigars-web`:** React/Vite source, browser assets and frontend build configuration. Configure the API and realtime base URLs explicitly.
- **`eigars-contracts` (later):** versioned OpenAPI schemas, event envelopes and generated clients. Do not make it a shared bag of server-side business logic.
- **`eigars-data-pipelines` (later):** independently operated ingestion/OCR jobs once workloads justify worker deployments. Publish canonical data through controlled interfaces.

Within the backend, keep foundation, geography, identity, field operations, incidents, results, notifications and communications in the same deployment until operational measurements justify extracting a service. First likely worker boundary: ingestion/OCR. Avoid a separate microservice for each election phase or CRUD table.

The `export:backend` script produces an allowlisted standalone backend directory containing server code, shared code and a backend manifest. It excludes environment secrets and local runtime data. Set `API_ONLY=true` to run without frontend assets. Install dependencies and commit the generated lockfile in the destination repository, configure its secrets and CORS, test both HTTP and Socket.IO clients, and migrate infrastructure separately. No remote repository is created and no deployment is performed by this refactor.
