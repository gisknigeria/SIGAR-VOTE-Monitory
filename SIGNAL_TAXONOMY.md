# Pulse, Situation, and Sentiment taxonomy

Signals retain the existing `pulse`, `situation`, and `sentiment` views. Each signal also has one domain category:

- `readiness`: training, equipment readiness, or deployment readiness
- `presence`: field presence and check-in observations
- `polling-status`: opening, accreditation, voting, counting, or closure status
- `queues`: observed queues or waiting times
- `materials`: missing or delivered election materials
- `logistics`: transport, power, communications, or supply logistics
- `connectivity`: sourced connectivity observations, never TURN availability
- `safety`: threats, incidents, and safety conditions
- `crm-issue`: imported external CRM case observations
- `rumour`: unverified claims, always forced to unverified status
- `results`: result-submission observations and reconciliation signals
- `intervention-status`: response or intervention progress

Signals retain source provenance, observation time, server receipt time, confidence, and optional freshness expiry. A repeated observation may set `duplicateOf`; it is not silently merged with a separate event. The original source event remains retained.

Verification requires an authenticated Supervisor, Admin, or Super Admin through `POST /api/intelligence/signals/:id/verify`. Sentiment must be supplied as aggregate observations with source and sampling limitations in the source metadata; no individual sentiment profiling is supported.