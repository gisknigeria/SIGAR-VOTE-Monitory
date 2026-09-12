# EIGARS: CTO Resource and Production Readiness Brief

Review date: 10 September 2026

## Executive request

Approve a phased budget and accountable owners for production infrastructure, authoritative data access, external integrations, engineering remediation, independent testing, mobile distribution and ongoing operations. The target is an election intelligence platform serving approximately one million active users; peak concurrent users, simultaneous video publishers/viewers and election-day workload remain to be defined. No server count or capacity guarantee should be approved from account count alone.

The external CRM remains the case-management system. EIGARS needs its documented API integration. Video streaming, server-side recording and transcoding should run in a separate, independently scalable media service.

## Basis and current code findings

Reviewed all 14 pages of the supplied EIGARS Conceptualization and Functional Architecture Review Focus PDF, plus current backend composition, results persistence, reporting, evidence, realtime, deployment configuration, frontend media components, map configuration, PWA service worker and CI configuration. This is a targeted engineering assessment, not a completed penetration test, production infrastructure audit or certification.

- Dedicated result persistence, transaction handling and geography-aware reporting corrections are now present. Earlier findings that these were absent should not be reused as current findings without retesting.
- `server/store.js` now composes a results repository and exposes transaction handling. Production PostgreSQL rollback, concurrent submission and migration behaviour still need independent verification.
- The reviewed PostgreSQL result repository test uses a mock pool. Mock tests do not establish real database correctness or capacity.
- `server/modules/field-operations/realtime.js` still broadcasts GPS using `io.emit`. Geographic authorization and distributed delivery remain important review items.
- `server/modules/foundation/evidence-repository.js` keeps original base64 media in JSON/database settings and uses a test-signature malware check. Production object storage, comprehensive scanning and enforceable retention are still needed.
- `public/service-worker.js` caches application assets and excludes API traffic; this alone does not provide durable offline submission or remote push delivery.
- Frontend camera components use browser `MediaRecorder`. A dedicated server-side recording pipeline must be provisioned and integrated.
- `src/components/dashboard/MapView.jsx` references public OpenStreetMap tiles. Production map delivery and offline-use arrangements must be procured.
- CI already includes dependency auditing, build, backend and smoke commands. Expand existing checks rather than buying duplicate tooling without assessing coverage.
- Deployment documentation describes a relatively simple frontend/backend arrangement. Its configuration is not evidence of million-user readiness.

## Resources to approve

Priority: Launch = required before the affected production feature launches. Phase 2 = can follow core capture if explicitly excluded from the first release. Video, CRM and OCR prerequisites become launch requirements whenever those features are included.

| # | Resource / work package | Required provision and acceptance evidence | Priority / suggested owner |
|---|---|---|---|
| 1 | Capacity and architecture planning | Define concurrent users, peak requests, GPS frequency, upload sizes, video publishers/viewers, retention and operating regions. Produce workload model, architecture, quotas, scaling strategy and measured capacity report. | Launch; CTO/platform lead |
| 2 | Organization-owned accounts | Company-controlled domain, DNS, cloud billing, source-control organization, vendor accounts, MFA, recovery contacts and delegated access. Avoid personal ownership and shared passwords. | Launch; CTO/IT |
| 3 | Frontend delivery | Production static hosting, CDN, HTTPS, DNS, cache strategy, DDoS/WAF protection and staging previews. Validate low-bandwidth and regional performance. | Launch; platform/frontend |
| 4 | Backend compute | Load-balanced API replicas, multiple availability zones, autoscaling, container registry, separate workers and private networking. Validate graceful shutdown, rollback and capacity headroom. | Launch; platform |
| 5 | Database service | Managed PostgreSQL with PostGIS support, connection pooling, high availability, point-in-time recovery, migrations and indexed access paths. Add replicas when justified by measurements. Test restoration and failover. | Launch; database/platform |
| 6 | Shared cache and realtime infrastructure | Managed Redis/Valkey or equivalent, cross-instance Socket.IO delivery, shared rate limiting and scoped subscriptions. Test reconnect storms, session revocation and fan-out volume. | Launch; backend/platform |
| 7 | Durable queues and workers | Queue service, retry policies, dead-letter handling and transactional outbox for notifications, integrations, OCR, reports and escalation. Demonstrate restart-safe processing. | Launch; backend/platform |
| 8 | Separate media service | WebRTC media infrastructure for interactive feeds; ingest, recording workers, transcoding and CDN playback for recordings/broadcasts. Independent deployment, scaling, monitoring and failure isolation from the election API. | Launch for video; media/platform |
| 9 | TURN/STUN | Authenticated, monitored TURN capacity with short-lived credentials, suitable network transports and tested fallback; STUN configuration. TURN assists connectivity and does not replace recording, media routing or CDN infrastructure. Avoid double-procuring it if the media provider includes it. | Launch for live video; media/platform |
| 10 | Private object/evidence storage | Direct resumable uploads, signed authorized access, encryption/key management, file validation, malware quarantine, hashes, versioning, custody records and retention/hold enforcement. Keep original evidence separate from derived media. | Launch; backend/security |
| 11 | Critical election data access | Agreements for polling units, official identifiers, boundaries, constituencies, elections/contests, parties/candidates, registered-voter statistics and historical/current results. Require provenance, licensing, refresh frequency and named data owners. | Launch baseline; GIS/data lead |
| 12 | Production maps and geocoding | Licensed map tiles, reverse geocoding, boundary delivery, request quotas and offline rights where required. Test coverage and performance for operational locations. | Launch; GIS/frontend |
| 13 | Population and connectivity datasets | Sourced population/demographic releases and MNO coverage/reference data, with geographic resolution, publication dates and uncertainty. Do not assume access is free or available through an API. | Phase 2; GIS/data lead |
| 14 | External CRM integration | Provider sandbox, API specification, credentials, webhooks, case identifiers, field mappings, quotas, historical synchronization and support SLA. Agree which system owns each field and whether updates are inbound only or bidirectional. | Launch for CRM; integration lead |
| 15 | Authorized IReV/source access | Documented permitted access method, source identifiers, sample forms, refresh limits and failure behaviour. A working scraper or endpoint is not a durable service agreement. | Launch for official-source integration; data/integration |
| 16 | OCR service and review operation | OCR/vision API with production quotas or self-hosted workers; labelled representative result forms; field-level accuracy tests; confidence/rejection rules; human review queue and reviewers. Preserve original forms and never silently invent unreadable counts. | Launch for OCR; AI/data/QA |
| 17 | Analytical model services | Separate deterministic analytics from optional generated summaries. Procure model API access, quotas, cost caps, data-use terms and evaluation tools. Record model/version/source provenance and require human approval for material decisions. GPU infrastructure only if self-hosting is chosen. | Phase 2 or launch if included; AI/backend |
| 18 | Notifications | Email, SMS where needed, push configuration for web/Android/iOS, approved sender identities and delivery tracking. Provide fallbacks and operational acknowledgement for critical alerts. | Launch; backend/operations |
| 19 | Identity and privileged access | MFA for privileged users, secure recovery, session/device revocation, least privilege, access reviews and secrets management. Decide whether existing authentication is sufficient after review or an external identity service is warranted. | Launch; security/backend |
| 20 | Privacy and governance | Privacy/security specialist to assess applicable Nigerian requirements and operating jurisdictions, impact assessment, location/video policy, retention, deletion/holds, processor contracts and cross-border hosting choices. Preserve aggregated operational use; exclude covert voter profiling. | Launch; privacy/legal/security |
| 21 | Independent engineering review | Fund frontend/backend/mobile/media review covering data integrity, authorization, transactions, workflow verification, source provenance and integration contracts. Track remediation with owners and verification evidence. | Launch; engineering lead |
| 22 | Test environments and QA | Production-like staging, real PostgreSQL integration tests, anonymized fixtures, CRM sandbox, browser/device matrix and automated end-to-end tests. Test offline replay, duplicate uploads, authorization and media lifecycle. | Launch; QA/platform |
| 23 | Load, resilience and security testing | Budget for load generators and independent penetration testing. Exercise election-day bursts, reconnect storms, network loss, provider outages, queue recovery and database failover. Agree acceptance thresholds before testing. | Launch; QA/security/platform |
| 24 | Observability and incident response | Central redacted logs, metrics/traces, synthetic journeys, alerts, service dashboards, on-call rota, runbooks, status communications and incident drills. Include source freshness, queue delay, OCR errors and failed recordings. | Launch; SRE/operations |
| 25 | Backup and disaster recovery | Coordinated database/evidence backups, separate failure-domain copies, documented recovery point/time objectives and restoration exercises. Reconcile restored metadata with stored media. | Launch; platform/database |
| 26 | Release and supply-chain controls | CI/CD, infrastructure-as-code, reviewed changes, reproducible lockfile installs, dependency/container/secret scanning, signed artifacts where appropriate and rollback procedures. Review permissive dependency ranges and keep upgrades controlled. | Launch; engineering/platform |
| 27 | Mobile distribution | Google Play Console organization account for Android and a separate Apple Developer Program organization membership for iOS. Budget for verification, app signing, release assets, privacy disclosures, review and maintenance. | Launch for native apps; mobile/product |
| 28 | Mobile build and device resources | macOS/Xcode build access or hosted macOS CI, Android/iOS test devices, low-end Android coverage, signing-key management, beta distribution and crash reporting. Current PWA assets do not establish store-ready native releases. | Launch for native apps; mobile/QA |
| 29 | Accessibility, usability and localization | Review keyboard/screen-reader access, contrast, forms, map alternatives, clear errors, low-bandwidth behaviour, time zones and required languages. Target WCAG 2.2 AA for applicable web journeys. | Launch core; product/frontend/QA |
| 30 | Operational personnel and field equipment | Named backend, frontend/mobile, media, GIS/data, QA, platform and security responsibilities; support desk; training; OCR reviewers; data stewards. Field phones, data plans, power banks and command-centre backup internet/power. | Launch; CTO/operations |
| 31 | Vendor support and budget control | Production quotas, escalation contacts, outage communications, usage dashboards, billing alerts, peak-event capacity confirmation and data export/exit arrangements. Separate compute, database, maps, SMS, OCR, video storage and delivery budgets. | Launch; CTO/procurement |

## Suggested quality benchmarks

There is no single certificate called “global standard” for this application. Agree measurable engineering and operational requirements instead.

- Use OWASP ASVS as the application security verification baseline; have the security reviewer select the applicable assurance level and controls. Source: https://owasp.org/www-project-application-security-verification-standard/
- Target WCAG 2.2 AA for applicable web accessibility requirements and test real user journeys. Source: https://www.w3.org/TR/WCAG22/
- Ask privacy counsel to assess Nigeria Data Protection Act obligations and any additional jurisdictions. This brief does not assert compliance. Source: https://ndpc.gov.ng/download/nigeria-data-protection-act-2023
- Consider ISO 27001 certification or an independent assurance engagement if procurement/customer contracts require it; certification is a separate organizational project, not a hosting feature.
- Define availability, latency, accepted-submission durability, notification delay, OCR accuracy and recovery objectives. Validate them through measured tests and drills.

## Mobile-account correction

A Google account does not publish iOS applications. Android distribution needs Google Play Console enrollment; iOS distribution needs Apple Developer Program enrollment and App Store Connect access. Prefer organizational ownership. Organizational verification commonly requires legal entity details and D-U-N-S information, subject to the platform's exceptions.

Google: https://support.google.com/googleplay/android-developer/answer/13628312

Apple: https://developer.apple.com/help/account/membership/program-enrollment

## CTO decisions required before final procurement

1. Define whether one million means registered, daily active or concurrent users; specify event-day peaks.
2. State simultaneous live publishers/viewers, recording duration, bitrate and retention.
3. Confirm launch capabilities and operating geography; distinguish phase-two analytics from essential capture.
4. Choose managed versus self-hosted media and AI after cost/operations comparison.
5. Approve hosting regions, data access arrangements, security requirements and service recovery objectives.
6. Assign owners and budgets for implementation, independent verification and post-launch operations.
7. Require a launch evidence pack: resolved critical findings, real integration tests, capacity results, recovery drill, provider quotas, mobile release readiness and operational sign-off.

## Funding sequence

First fund baseline data agreements, architecture/capacity work and code remediation. Next provision staging, production foundations, media and integration sandboxes. Then fund independent testing, field pilot and operational training. Increase production capacity and secure provider quotas against measured event-day demand. Do not treat AI subscriptions, app-store accounts or larger servers as substitutes for these launch gates.
