# Backup and recovery

This documents the intended procedure and the objects that must be backed up together. It has **not been exercised against a live database or object store in this environment** (this development environment has no reachable managed Postgres or object storage) -- treat every step below as reviewed-but-unrun until it has been performed once against a real staging deployment and the restored data verified.

## What must be backed up together

A restore that recovers the database but not evidence (or vice versa) breaks referential integrity: incidents and result records reference evidence IDs, and reconciliation records reference result-record IDs. Back up as one coordinated operation, not independently scheduled jobs:

1. **PostgreSQL database** -- all tables created in `server/infrastructure/persistence/bootstrap.js`, including `audit_events`, `result_records`, `result_reconciliations`, `tasks`, `notification_outbox`, and the reference-data/geography tables.
2. **Evidence object storage** -- `private-evidence/` in local/JSON-store mode (`EVIDENCE_STORAGE_DIR`), or the configured private object store in Postgres mode. Referenced by `incidents.media[].id` and `result_records.evidence[].id`.
3. **JSON data file** (`DATA_FILE`, only relevant when `DATABASE_URL` is unset) -- the entire application state lives in this one file; back it up like a database, not like a log file.
4. **Media-service state** (`MEDIA_STATE_FILE`) and its upload directory (`MEDIA_UPLOAD_DIR`) -- recording lifecycle metadata and in-progress/finalized recordings, owned by the separate `media-server` process, not the election API.

## Procedure (PostgreSQL mode)

```bash
# 1. Database: a consistent logical dump, taken before the evidence snapshot below
pg_dump --format=custom --file=oyo-election-$(date +%Y%m%dT%H%M%S).dump "$DATABASE_URL"

# 2. Evidence and media state: snapshot the same moment, not before/after the DB dump
tar -czf evidence-$(date +%Y%m%dT%H%M%S).tar.gz "$EVIDENCE_STORAGE_DIR"
tar -czf media-$(date +%Y%m%dT%H%M%S).tar.gz "$MEDIA_STATE_FILE" "$MEDIA_UPLOAD_DIR"
```

Store all three archives in a separate failure domain from the running database/servers (a different region or provider than the primary), encrypted at rest, with access restricted to the same operators who can approve an evidence legal hold.

## Procedure (JSON-store / single-process mode)

```bash
cp "$DATA_FILE" "data-$(date +%Y%m%dT%H%M%S).json"
tar -czf evidence-$(date +%Y%m%dT%H%M%S).tar.gz "$EVIDENCE_STORAGE_DIR"
```

JSON-store mode is documented in the README as local/single-process compatibility only; it has no concurrent-write safety and is not a recommended production backup target.

## Restore

```bash
# PostgreSQL
pg_restore --clean --if-exists --dbname="$DATABASE_URL" oyo-election-<timestamp>.dump
tar -xzf evidence-<timestamp>.tar.gz -C "$EVIDENCE_STORAGE_DIR"
tar -xzf media-<timestamp>.tar.gz -C /

# JSON-store
cp data-<timestamp>.json "$DATA_FILE"
tar -xzf evidence-<timestamp>.tar.gz -C "$EVIDENCE_STORAGE_DIR"
```

After any restore, verify before returning the system to service:

- `npm run test:smoke` passes against the restored instance.
- `GET /api/ready` reports `database: "ok"`.
- A sample of `result_records.evidence[].id` and `incidents.media[].id` values resolve via `GET /api/evidence/:id` (an evidence reference with no matching object means the database and evidence archive were taken at different, inconsistent moments).
- `GET /api/audit` shows continuous coverage up to the backup time with no unexplained gap.

## What this does not cover

- **RPO/RTO targets** are not defined here; they are an operational decision (see the [CTO Resource and Readiness Brief](../outputs/CTO-Resource-and-Readiness-Brief.md), item 25) that must be agreed with operations before this procedure is scheduled.
- **Automated scheduling** of the commands above does not exist in this codebase; this is a manual/cron-triggered procedure until a backup service is provisioned.
- **A restore drill has not been performed.** This procedure is standard `pg_dump`/`pg_restore` and file-archive practice, reviewed for correctness against this schema, but "reviewed" is not "tested" -- run it once against a disposable staging copy before relying on it during an actual incident.
