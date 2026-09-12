# Demographic and registered-voter intelligence

The backend supports sourced aggregate datasets for population, demographic measures, and registered-voter totals. It does not ingest, store, search, or profile individual voters.

Each dataset requires:

- Source ID, name, version, and optional URL
- Metric type: `population`, `registered-voters`, or `demographic`
- Geographic resolution: country, state, LGA, ward, or polling unit
- Publication date
- Methodology
- Aggregate records and optional uncertainty bounds
- Authenticated approval before analysis or publication

`GET /api/demographics/analysis` compares approved population and registered-voter datasets at matching aggregate geography. It returns `estimateStatus: unknown` when either figure is unavailable and never derives a missing figure from another dataset.

The comparison is observational only. A registered-voter-to-population ratio is not a turnout estimate, eligibility conclusion, or individual-level inference. Dataset publication dates, source versions, methodologies, and uncertainty metadata remain attached to the response.