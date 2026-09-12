# Connectivity and MNO intelligence

The backend accepts supplied connectivity datasets or a future provider adapter. It does not fabricate coverage maps and does not treat TURN/STUN availability as mobile-network-operator intelligence.

Connectivity datasets require a source ID, source name/version, methodology, geographic resolution, and aggregate records. Records may describe:

- Provider and available technologies
- Measured or estimated observation type
- Measurement timestamp
- Authorized base-station metadata
- Provider and technology redundancy
- Geographic limitations

Base-station locations are retained only when the supplied record explicitly marks them `authorized: true`. Unsourced or unauthorized locations are not exposed as base stations.

Available endpoints:

- `POST /api/connectivity/datasets` for authenticated admin ingestion
- `POST /api/connectivity/datasets/:id/approve` for authenticated approval
- `GET /api/connectivity/datasets` for approved sourced datasets
- `GET /api/connectivity/analysis` for geographic planning analysis

The analysis distinguishes `measured-observations-available`, `estimated-only`, and `unknown`. When measured coverage is unavailable, it returns offline-planning requirements instead of inferring service availability. It reports redundancy only from supplied provider or technology data.

No provider API contract is present in this repository. A real provider integration still requires documented endpoints, authentication, identifiers, rate limits, publication/version semantics, and webhook behavior before an adapter can be enabled.
