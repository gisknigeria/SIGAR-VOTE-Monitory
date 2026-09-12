# SIGAR Vote Flutter Mobile App Plan

## 1. Purpose

Build a secure Flutter mobile companion for SIGAR Vote. The existing web application remains the full command-center interface; the mobile app focuses on field operations, fast reporting, location-aware intelligence, alerts, and supervisor actions.

The mobile app will use the existing SIGAR Vote API. It will not introduce a second business backend or duplicate election data storage.

## 2. Current Web Baseline

The repository is an Election Monitoring Command Center implemented with Vite, React, and an Express server. The web application currently includes:

- JWT login and logout
- Role-aware users, administrators, supervisors, and field agents
- Oyo State map, map layers, search, markers, and location tools
- Incident creation, assignment, status updates, and evidence media
- Field-unit positions and supervisor incident queues
- Notifications and Socket.IO live incident updates
- Chat rooms and incident-related communication
- Camera and live video functionality
- Pre-election analysis and sentiment/situation views
- IReV result extraction, OCR, result reports, and field/IReV comparison
- Parties, polling results, archived reports, and administrative management

The web client calls the API under `/api` and sends `Authorization: Bearer <token>`. The existing API client is in `src/api/client.js`, and the main dashboard startup requests are defined in `src/queries/dashboard.js`.

## 3. Product Boundary

### Web application

The web application remains the primary command center for:

- Large-screen map analysis
- Multi-layer geographic analysis
- Management dashboards
- Complex reports and result comparison
- Resource planning and administration
- Bulk user, party, and configuration management

### Flutter mobile application

The mobile application prioritizes workflows that need speed, GPS, camera, push notifications, and field mobility:

- Secure login and role-based access
- Personal operational dashboard
- Nearby polling-unit and incident information
- Agent site reports and incident reports
- SOS/emergency alerts
- Photo and video evidence capture
- GPS and location metadata
- Assignment notifications and action acknowledgement
- Supervisor review and status updates
- Essential maps and search
- Read-only operational information when temporarily offline

## 4. Election Lifecycle Scope

### Pre-election

- View assigned locations, wards, LGAs, and polling units
- Submit agent site adequacy reports
- Submit campaign activity and field-condition reports
- View location-specific intelligence and supervisor assignments
- Track election-material allocation and arrival status

### Election Day

- Submit incident reports from the field
- Send SOS alerts with current location
- Attach photographs and short video evidence
- View assigned tasks and receive targeted alerts
- Update incident status and acknowledge interventions
- View polling-unit activity, reported incidents, and operational hotspots
- Submit polling-unit results where the existing API permits it

### Post-election

- Submit on-site result reports
- View assigned result discrepancies
- Compare field-submitted information with IReV information
- Review incidents and evidence
- Complete agent, material, and resource evaluation
- View approved reports and result archives

## 5. Recommended Flutter Architecture

```text
lib/
  main.dart
  app/
    app.dart
    router.dart
    theme.dart
  core/
    config/
    errors/
    location/
    network/
    notifications/
    storage/
  features/
    auth/
      data/
      domain/
      presentation/
    dashboard/
    incidents/
    field_reports/
    map/
    assignments/
    results/
    notifications/
    profile/
  shared/
    models/
    widgets/
```

Use a feature-based structure so each operational workflow can evolve without creating one large dashboard module.

## 6. Recommended Packages

- `dio`: HTTP client, interceptors, timeouts, and multipart uploads
- `flutter_riverpod`: application and feature state management
- `go_router`: authenticated and role-aware navigation
- `flutter_secure_storage`: access and refresh token storage
- `shared_preferences`: non-sensitive user preferences
- `json_serializable` and `build_runner`: typed API models
- `geolocator`: GPS location capture
- `image_picker` or `camera`: evidence capture
- `permission_handler`: camera, location, and notification permissions
- `flutter_map` with the configured tile provider, or the map provider already approved for SIGAR Vote
- `socket_io_client`: live incident and notification updates if the API Socket.IO contract is exposed to mobile
- `firebase_messaging`: push notifications, if Firebase is approved for deployment

Packages should be added only after confirming the API and deployment constraints.

## 7. API Contract To Confirm

Before production mobile work, document these contracts from the running API:

- Login, logout, token expiry, and refresh behavior
- User profile and role fields
- Permission rules for Admin, Supervisor, Agent, and other roles
- Incidents: list, create, assign, update, status, visibility, and evidence upload
- Notifications: list, read, and push delivery
- Chat rooms, messages, and attachments
- Cameras and live-stream access
- Map layers, boundaries, polling units, and geographic search
- Field reports and situation reports
- Results and IReV comparison endpoints
- Parties, resources, and material monitoring endpoints
- Pagination, filtering, sorting, and date-range formats
- API error format and rate limits
- Maximum media size and accepted image/video types
- Socket.IO authentication, rooms, and event names

The current web repository is the source of truth for the first contract inventory. Mobile development should not guess endpoint behavior; every endpoint used by Flutter should have a request and response example.

## 8. Delivery Milestones

### Milestone 0: Project and API readiness

Deliverables:

- Confirm the production API base URL
- Confirm test credentials and roles
- Create an endpoint inventory from the running API
- Confirm Android and iOS support targets
- Confirm map tiles, push notifications, and media-storage policies
- Decide whether mobile uses Socket.IO or polling for live updates

Exit condition: a developer can authenticate and call the approved test API outside the browser.

### Milestone 1: Flutter foundation

Deliverables:

- Create Flutter project and environments: development, staging, production
- Configure app theme, routing, logging, and error boundaries
- Implement typed API client and common error handling
- Implement secure token storage
- Add unit-test and widget-test structure

Exit condition: the app launches on Android and iOS, shows a controlled error state, and can switch API environments without code edits.

### Milestone 2: First vertical slice

Build this complete workflow first:

```text
Login -> Authenticated dashboard -> Fetch incidents/profile -> Logout
```

Deliverables:

- Login form with validation
- Token persistence and expiry handling
- Role-aware route guard
- Dashboard summary from the API
- Loading, empty, offline, unauthorized, and server-error states
- Logout and local-session cleanup

Exit condition: a test user can log in, reopen the app, see authorized data, and log out without exposing tokens in logs.

### Milestone 3: Field reporting

Deliverables:

- Incident and agent-site report forms
- GPS capture and polling-unit/location selection
- Severity, report type, description, and timestamp fields
- Photo and short-video attachments
- Upload progress, retry, and draft handling
- Submission confirmation and server-generated incident ID

Exit condition: a field agent can submit a report from a real device with valid location and evidence metadata.

### Milestone 4: Alerts, assignments, and supervisor actions

Deliverables:

- Assignment list
- Incident detail and status updates
- Notification inbox
- Push notification registration
- SOS workflow with confirmation and cancellation rules
- Supervisor acknowledgement and reassignment where permitted

Exit condition: an assigned user receives an alert, opens the related record, and completes the permitted action.

### Milestone 5: Map and operational intelligence

Deliverables:

- State, LGA, ward, and polling-unit search
- Current-location map view
- Incidents and assignments on the map
- Hotspot and proximity views where supported by the API
- Lightweight mobile filters
- Map fallback when tiles or network are unavailable

Exit condition: a user can locate an operational issue and open its details from the map on a normal mobile connection.

### Milestone 6: Results and post-election workflows

Deliverables:

- On-site result submission
- Result archive views
- IReV and field-result comparison
- Discrepancy review
- Evidence and report access
- Agent and resource evaluation forms

Exit condition: authorized users can complete the assigned post-election workflow and see server-approved results.

### Milestone 7: Hardening and release

Deliverables:

- Unit, widget, integration, and API contract tests
- Network interruption and retry tests
- Permission-denial tests for each role
- Secure logging review
- Android release build and signing
- iOS release build and signing
- Crash reporting and operational monitoring
- Privacy, data-protection, and election-security review

Exit condition: the release candidate passes the agreed acceptance checklist on supported devices.

## 9. Mobile Navigation Proposal

The first release should use a small, task-focused navigation surface:

1. Home: assignments, alerts, and operational summary
2. Report: incident, site report, SOS, and result submission actions
3. Map: location, polling units, incidents, and nearby tasks
4. Inbox: notifications, assignments, and supervisor messages
5. Profile: user details, role, permissions, sync status, and logout

Administrative screens should remain on the web unless a specific mobile use case is approved.

## 10. Security Requirements

- Use HTTPS in every non-local environment
- Store tokens only in platform secure storage
- Never hard-code API keys, administrator credentials, or JWT secrets in Flutter
- Do not log tokens, passwords, full evidence URLs, or sensitive personal data
- Enforce permissions on the API; mobile route guards are only a user-experience layer
- Validate file type, size, and metadata before upload
- Require explicit confirmation for SOS and destructive actions
- Apply short-lived access tokens and a tested refresh/re-authentication flow
- Support remote session invalidation if the API provides it
- Review location, camera, media, and notification consent text before release

## 11. Acceptance Checklist

- Login works for each supported role
- Unauthorized users cannot access restricted records
- Reports preserve server timestamps and user identity
- GPS is requested only when needed and handles denial correctly
- Media uploads survive normal mobile network failures
- SOS creates the expected server-side alert exactly once
- Notifications open the correct incident or assignment
- Map and list views agree on record status
- Offline mode never presents unsent data as successfully submitted
- Web users see mobile-created reports without manual synchronization
- All critical actions have an audit trail on the server

## 12. Immediate Next Actions

1. Run the existing web application locally and verify the current login and dashboard.
2. Identify the deployed API base URL and create a staging API environment.
3. Capture request/response examples for login, incidents, users, notifications, map layers, reports, and results.
4. Confirm the roles that will use mobile: Agent, Supervisor, Admin, or another set.
5. Create the Flutter project as a sibling application, for example `sigar-vote-mobile`.
6. Implement Milestone 1 and Milestone 2 before adding maps, video, AI, or result analytics.

## 13. Definition Of Done For The First Release

The first mobile release is complete when an authorized field user can log in, view assigned operational information, submit a GPS-tagged incident with evidence, receive an assignment or alert, update the incident, and see the same record reflected in the web command center.
