import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const temp = join(root, '.docx-qa', 'objectives-build');
rmSync(temp, { recursive: true, force: true });
for (const dir of ['_rels', 'docProps', 'word', 'word/_rels']) mkdirSync(join(temp, dir), { recursive: true });

const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const run = (text, { bold = false, italic = false, color = '', size = 22 } = {}) => `<w:r><w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
const para = (text, style = 'Normal', opts = {}) => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${opts.keep ? '<w:keepNext/>' : ''}${opts.center ? '<w:jc w:val="center"/>' : ''}</w:pPr>${run(text, opts)}</w:p>`;
const bullet = text => `<w:p><w:pPr><w:pStyle w:val="Normal"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${run(text)}</w:p>`;
const numbered = text => `<w:p><w:pPr><w:pStyle w:val="Normal"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>${run(text)}</w:p>`;
const body = [];
const h1 = text => body.push(para(text, 'Heading1', { keep: true }));
const h2 = text => body.push(para(text, 'Heading2', { keep: true }));
const p = text => body.push(para(text));
const b = text => body.push(bullet(text));
const n = text => body.push(numbered(text));
const status = (label, text, color) => body.push(`<w:p><w:pPr><w:pStyle w:val="Status"/><w:shd w:val="clear" w:fill="F4F6F9"/></w:pPr>${run(`${label}: `, { bold: true, color })}${run(text)}</w:p>`);

body.push(para('CURRENT FUNCTIONAL OBJECTIVES', 'Kicker', { center: true, bold: true, color: '8B1E46', size: 22 }));
body.push(para('Election Monitoring Command Center', 'DocumentTitle', { center: true, bold: true, color: '0B2545', size: 54 }));
body.push(para('Implemented capabilities, operating scope and planned extensions', 'Subtitle', { center: true, color: '475569', size: 27 }));
body.push(para('Current-state revision | 2 September 2026', 'Subtitle', { center: true, italic: true, color: '64748B', size: 20 }));
body.push(para('This document describes what the application currently does. Planned functionality is identified separately and is not represented as implemented.', 'Lead', { center: true, bold: true, color: '7A5A00', size: 22 }));
body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');

h1('1. Product objective');
p('The Election Monitoring Command Center provides a secure, role-aware and real-time platform for coordinating field election operations. It connects command administrators, supervisors, response personnel and polling-unit agents through incident reporting, emergency alerts, result capture, live location awareness, private operational messaging, evidence collection, mapping and analytical tools.');
p('The system is designed to help authorized election personnel understand where operational problems are occurring, preserve field evidence, direct response resources and compare submitted field results with prepared or live IReV information where available.');
status('Implemented', 'Core command dashboard, personnel management, incidents, SOS, GPS, private chat, result reporting, GIS tools, camera sharing, notifications, analytics and IReV pilot integration.', '1F3A5F');

h1('2. Users, authentication and access control');
p('The application authenticates users and presents features according to their operational role, rank and geographic assignment.');
b('Secure login and logout using signed JWT sessions and HTTP-only session-cookie support.');
b('Password validation, password reset/update and invalidation of old sessions after password changes.');
b('User activation status and administrative creation, editing and deletion of personnel.');
b('Current roles: Super Admin, Admin, Supervisor, Response Team and Agent.');
b('Geographic and responsibility-based access using command, division, station, state, LGA, ward and polling-unit assignments.');
b('Admin-only and Super-Admin-only middleware for protected operations.');
status('Not claimed', 'Situation Room Manager, LGA Coordinator, Ward Supervisor, Polling Unit Agent and Analyst are not separate current role names. Their responsibilities are represented through the implemented Admin, Supervisor, Response Team and Agent roles.', '9B1C1C');

h1('3. Personnel registration and deployment structure');
p('Administrators can register and manage operational users, assign organizational details and place field users within the election geography.');
b('Create and update field personnel with role, rank, unit, command, division, station and contact/login information.');
b('Assign state, LGA, ward and polling unit according to role and available location data.');
b('Limit the personnel a supervisor can view or manage to the appropriate LGA and ward scope.');
b('Display personnel and operational counts within dashboard views.');
status('Partial', 'The system tracks assignments and live GPS activity, but it does not currently provide a dedicated attendance/check-in workflow with formal arrived/not-arrived timestamps.', '7A5A00');

h1('4. Election geography and GIS');
p('The application represents election geography using the hierarchy State -> LGA -> Ward -> Polling Unit and provides map-based operational awareness.');
b('Shared election datasets provide states, LGAs, wards, polling units, labels and role-assignment options.');
b('Oyo boundary data is fetched and cached for state, LGA and ward display.');
b('The Leaflet map displays incidents, SOS alerts, personnel GPS positions, routes, uploaded map layers and selected boundaries.');
b('Users can search locations, inspect coordinates, measure distance/area and calculate routes.');
b('Administrators can create, style, order, show and hide operational map layers.');
status('Partial', 'Not every polling-unit record is guaranteed to include verified GPS coordinates. The map displays coordinates available from reports, users, boundaries and configured layers.', '7A5A00');

h1('5. Live command dashboard');
p('The dashboard combines current incidents, operational personnel, emergency alerts, submitted results, cameras, notifications, map layers and analytical views.');
b('Role-specific navigation and controls.');
b('Live incident and SOS counts, severities and statuses.');
b('Map and list views with filtering and selected-incident details.');
b('Personnel, GPS and live-camera monitoring for authorized command users.');
b('Result summaries, party-level figures, geographic comparisons and export tools.');
b('Notification center and targeted assignment alerts.');
status('Partial', 'Formal voting-stage tracking—officials arrived, accreditation started, voting started/ended and counting completed—is represented through reports and incidents rather than a dedicated polling-unit workflow state machine.', '7A5A00');

h1('6. Incident reporting and response');
p('Authorized users can create election-related incidents from the field or command dashboard. The server validates coordinates, role permissions, report type, media and visibility before persistence.');
b('Captures title, description, category, severity, status, date/time, reporter, LGA, ward, polling unit and GPS coordinates.');
b('Supports image/video evidence and optional map geometry/style information.');
b('Implemented categories include SOS Emergency, Vote Buying, Thuggery and Violence, Voter Intimidation, Collusion, Compromised Privacy, Over-voting, Late Opening, Material Shortages, Missing Registers, Lack of Crowd Control, BVAS Failure, Network Connectivity and Battery Depletion.');
b('Authorized command users can update incidents, assign field personnel and provide operational instructions.');
b('Assignments add the recipient to incident visibility and create a targeted notification.');
b('Incident updates are delivered in real time only to viewers who pass the server-side access policy.');
status('Implemented', 'Incident creation, evidence, severity/status, geographic context, assignment, notifications and role-based visibility.', '1F3A5F');

h1('7. SOS and emergency operations');
p('Field roles can raise urgent emergency alerts containing their authenticated identity and current operational location.');
b('Captures emergency type/text, user identity, role, GPS coordinates and server timestamp.');
b('Displays the alert immediately to eligible command users and updates the emergency position on the map.');
b('Creates persistent incident records for emergency events where the SOS workflow saves the alert.');
b('Provides sound/visual notification behavior and rate limiting to prevent alert flooding.');
b('Selects visibility based on administrative responsibility and operational/geographic scope.');
status('Not claimed', 'The current SOS payload does not guarantee a separately stored telephone number. It relies on the authenticated user profile and operational assignment.', '9B1C1C');

h1('8. Photo, video and live camera evidence');
b('Incident and result forms accept validated image/video evidence within configured limits.');
b('Field users can start phone-camera sharing for authorized command viewing through WebRTC.');
b('TURN/STUN configuration supports direct or relayed live-video connectivity.');
b('When a live connection fails, active camera recording can be segmented and queued locally, then uploaded when connectivity returns.');
b('Configured CCTV/HLS camera sources can be registered and viewed by authorized administrators.');
status('Partial', 'Offline recovery currently focuses on camera/video clips. General offline queues for every incident, result, photo, GPS update and check-in are not fully implemented.', '7A5A00');

h1('9. Election result capture');
p('Agents and authorized users can submit polling-unit party vote totals with photographic evidence of the signed result sheet.');
b('Requires a valid state, LGA, ward and polling unit within the user’s allowed geography.');
b('Agents are restricted to their assigned polling unit.');
b('Accepts non-negative whole-number votes for configured political parties.');
b('Requires at least one image of the signed result sheet.');
b('Records submitter, role-derived result source, coordinates and submission time.');
b('Stores the submission as a protected Polling Unit Result record for mapping and analysis.');
status('Not claimed', 'The current form does not independently capture every statutory figure listed in the original objectives, such as registered voters, accredited voters, valid votes and rejected votes.', '9B1C1C');

h1('10. Result analysis and aggregation');
b('Parses party vote entries from submitted polling-unit result records.');
b('Calculates party totals and percentages across the records currently available to the authorized user.');
b('Supports filtering and geographic drill-down using polling unit, ward and LGA information.');
b('Compares field/supervisor reports with prepared or live IReV information where matching records are available.');
b('Provides CSV/export and operational analysis tools.');
status('Partial', 'The application provides analytical aggregation over available submissions, but it should not be described as an official collation or declaration system.', '7A5A00');

h1('11. IReV pilot integration');
p('The backend consumes structured JSON endpoints used by the public IReV portal; it does not parse or scrape rendered HTML pages.');
b('Requests election statistics and polling-unit uploads for the configured election ID.');
b('Applies response-size limits, timeouts, sanitization and approved HTTPS image-host checks.');
b('Caches successful responses in memory and persists changed archive snapshots.');
b('Serves a saved or bundled archive when the upstream source is unavailable.');
b('Supports a prepared Osun result/archive pilot and a configurable Oyo election feed.');
b('Provides admin-only OCR of approved Oyo result images using a configured vision provider, with cached extraction results.');
status('Important wording', 'Describe this as a public-feed integration or pilot, not an official INEC partnership, guaranteed API or legally authoritative collation source.', '7A5A00');

h1('12. Communication and notifications');
b('Administrators can create chat rooms and add eligible field personnel.');
b('Users can access room and incident-specific conversations according to membership.');
b('Messages support text plus validated image, video or document attachments.');
b('Socket.IO delivers messages only through authorized chat rooms; payloads are no longer globally broadcast.');
b('Command messages can create targeted notifications for room members.');
b('Mobile chat keeps the room selector, message list and composer inside the visible phone viewport.');
status('Partial', 'Dedicated one-click broadcast channels for every ward, LGA, all supervisors or all agents are not separate current features; administrators use managed rooms and incident chats.', '7A5A00');

h1('13. Alerts and operational awareness');
b('Immediate SOS alerts.');
b('Incident-created and incident-updated realtime events.');
b('Assignment and command-message notifications.');
b('Camera-sharing start/stop awareness and GPS online/offline events.');
b('Criticality and status filtering for operational reports.');
status('Future scope', 'Time-based alerts for missed check-in, officials/materials not arriving, voting not starting, agents becoming inactive and polling units missing result deadlines require a formal schedule/status engine and are not complete.', '9B1C1C');

h1('14. Search, filtering, reports and analytics');
b('Filter incidents by severity and status and control report/SOS visibility on the map.');
b('Search geographic areas and select boundaries, locations and polling units.');
b('Filter and compare result records, parties and geographic areas.');
b('View operational personnel, cameras, map layers and notifications.');
b('Generate local or provider-assisted summaries from sanitized operational context.');
b('Export selected analytical data where the relevant dashboard tool is available.');
status('Partial', 'The analytics are operational decision-support tools, not a complete statutory reporting suite for attendance, activity timelines and formal election certification.', '7A5A00');

h1('15. Audit, security and data protection');
b('Logs recent originating IP information for incident, result and SOS submissions for administrative review.');
b('Uses authentication, role/geographic access checks, rate limits, input sanitization, content-size limits and security headers.');
b('Protects notification ownership and room membership at API level.');
b('Requires persistent production storage through PostgreSQL or an explicit persistent DATA_FILE path.');
b('Fails production startup if a configured database is unavailable rather than accepting operational records into temporary storage.');
status('Partial', 'A comprehensive immutable audit trail for every login, user edit, assignment, message and administrative action is not yet implemented.', '7A5A00');

h1('16. Reliability, offline behavior and application delivery');
b('Installable Progressive Web App manifest and service worker.');
b('Cached application assets and revalidation-safe production deployment.');
b('TanStack Query caching, request deduplication and controlled retries for dashboard server data.');
b('Lazy loading for heavy results datasets, modals, HLS playback and analytical features.');
b('WebSocket-first Socket.IO connections with polling fallback.');
b('Persistent archive fallbacks for IReV data and local offline video recovery.');
status('Partial', 'PWA installation and asset caching do not mean that every business transaction works offline. Full offline incident/result synchronization remains future work.', '7A5A00');

h1('17. Current agent-facing actions');
p('The field experience centers on four operational actions:');
n('Report Result - submit party vote totals, location and a signed result-sheet image for the assigned polling unit.');
n('Report Incident - submit an election issue with category, severity, description, coordinates and evidence.');
n('Share Photo/Video or Live Camera - provide visual evidence and optionally share a live field camera feed.');
n('SOS - send an urgent location-linked emergency alert to eligible command users.');

h1('18. Current operational chain');
p('The implemented responsibility chain is:');
body.push(para('Agent / Response Team -> Supervisor -> Admin -> Super Admin / Command Leadership', 'Chain', { center: true, bold: true, color: '0B2545', size: 24 }));
p('Users see data according to their authenticated role, assignment, geographic scope and explicit incident/chat visibility. This supports controlled escalation from polling-unit operations to command leadership without exposing all operational information to every account.');

h1('19. Deployment and persistence objective');
p('The production application is built with Vite and served by the Express server. PostgreSQL is the operational system of record. Socket.IO shares the same authenticated backend, while external services provide optional geocoding, routing, TURN, AI and IReV capabilities.');
b('Required production configuration includes JWT_SECRET, SUPER_ADMIN_PASSWORD, ADMIN_PASSWORD and persistent storage.');
b('CORS_ORIGIN restricts browser origins.');
b('DATABASE_URL should use the provider’s secure SSL configuration.');
b('The current Neon error “data transfer quota exceeded” must be resolved by resetting/upgrading the database plan or replacing DATABASE_URL. It is not a Render application-code error.');

h1('20. Overall current-state objective');
p('The Election Monitoring Command Center currently connects field agents, response personnel, supervisors and command administrators through authenticated reporting, geographic visibility, realtime alerts, evidence, private communication and result-analysis workflows. Its operational goal is to give authorized leadership a timely and defensible view of incidents, emergencies, field locations, submitted results and response assignments while preserving access control and durable records.');
p('The application is an operational monitoring and decision-support platform. It is not presented as an official election collation, certification or result-declaration system.');

h1('Appendix: capabilities not yet presented as complete');
b('Formal agent attendance/check-in and missed-check-in alerts.');
b('A dedicated status workflow for every election-day stage at every polling unit.');
b('Complete offline synchronization for incidents, results, photos and GPS events.');
b('Full statutory result fields and official collation/declaration.');
b('Automated time-based alerts for officials/materials/voting/result deadlines.');
b('Dedicated organization-wide, LGA-wide and ward-wide broadcast controls.');
b('A complete immutable audit ledger for every sensitive action.');
b('External object storage for large media instead of database/base64 payloads.');

// Rebuild the document in the three operational phases requested for review.
// The capability statements below preserve the same current-state boundaries.
body.length = 0;
body.push(para('CURRENT FUNCTIONAL OBJECTIVES', 'Kicker', { center: true, bold: true, color: '8B1E46', size: 22 }));
body.push(para('Election Monitoring Command Center', 'DocumentTitle', { center: true, bold: true, color: '0B2545', size: 54 }));
body.push(para('Pre-Election | Election Day | Post-Election', 'Subtitle', { center: true, color: '475569', size: 27 }));
body.push(para('Current-state revision | 3 September 2026', 'Subtitle', { center: true, italic: true, color: '64748B', size: 20 }));
body.push(para('This document describes what the application currently does and groups each objective by its operational election phase. Planned functionality is clearly identified and is not represented as implemented.', 'Lead', { center: true, bold: true, color: '7A5A00', size: 22 }));
body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');

h1('How to read this document');
p('The application supports three operational phases: preparation before voting, live coordination on election day, and analysis after voting. Cross-cutting capabilities are placed under the phase where they are first or most heavily used.');
status('Implemented', 'Available in the current codebase and supported by an active workflow.', '1F3A5F');
status('Partial', 'The core capability exists, but part of the broader objective remains incomplete.', '7A5A00');
status('Future scope / Not claimed', 'Not currently complete and should not be presented as implemented.', '9B1C1C');
h1('Overall product objective');
p('The Election Monitoring Command Center provides a secure, role-aware and real-time platform for coordinating field election operations. It connects command administrators, supervisors, response personnel and polling-unit agents through preparation, incident response, emergency alerts, result capture, location awareness, private messaging, evidence collection, mapping and analysis.');
p('The platform is an operational monitoring and decision-support system. It is not an official election collation, certification or result-declaration system.');

const addObjective = ({ title, intro, items, label, note, color = '7A5A00' }) => {
  h2(title);
  if (intro) p(intro);
  for (const item of items) b(item);
  status(label, note, color);
};

body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
h1('PART I - PRE-ELECTION');
p('This phase prepares the people, permissions, locations, reference data and communication channels required before field operations begin.');
[
  {
    title: '1. Secure access and role preparation',
    items: [
      'Authenticate users through signed JWT sessions with HTTP-only session-cookie support.',
      'Support login, logout, password validation, password updates and invalidation of older sessions after a password change.',
      'Activate or deactivate accounts and allow authorized administrators to create, edit or delete personnel.',
      'Apply permissions for Super Admin, Admin, Supervisor, Response Team and Agent users.',
      'Restrict protected operations through Admin-only and Super-Admin-only middleware.'
    ],
    label: 'Not claimed',
    note: 'Situation Room Manager, LGA Coordinator, Ward Supervisor, Polling Unit Agent and Analyst are not separate current role names. Their responsibilities are represented through the implemented roles.',
    color: '9B1C1C'
  },
  {
    title: '2. Personnel registration and deployment planning',
    items: [
      'Register personnel with role, rank, unit, command, division, station, contact and login information.',
      'Assign personnel to state, LGA, ward and polling unit according to responsibility.',
      'Limit the personnel a supervisor can manage to the appropriate LGA and ward scope.',
      'Show personnel and operational counts within authorized dashboard views.'
    ],
    label: 'Partial',
    note: 'Assignments and live GPS activity exist, but there is no formal attendance or arrived/not-arrived check-in workflow.'
  },
  {
    title: '3. Election geography and reference-data preparation',
    items: [
      'Represent election geography as State -> LGA -> Ward -> Polling Unit.',
      'Provide datasets for states, LGAs, wards, polling units, labels and role-assignment options.',
      'Fetch and cache Oyo state, LGA and ward boundary data.',
      'Validate a field user’s allowed geography before accepting restricted reports or results.',
      'Provide configured political-party data for polling-unit result entry and analysis.'
    ],
    label: 'Partial',
    note: 'Not every polling-unit record is guaranteed to have verified GPS coordinates.'
  },
  {
    title: '4. Map and operational-layer preparation',
    items: [
      'Create, style, order, show and hide operational map layers.',
      'Search locations, inspect coordinates, measure distance or area and calculate routes.',
      'Prepare boundaries and overlays for incident, SOS, personnel and result display.',
      'Register configured CCTV/HLS sources for authorized command users.'
    ],
    label: 'Implemented',
    note: 'The map and layer-management tools provide the geographic foundation used during monitoring.',
    color: '1F3A5F'
  },
  {
    title: '5. Communication and emergency readiness',
    items: [
      'Allow administrators to create chat rooms and add eligible field personnel.',
      'Prepare private room and incident conversations using membership-based access.',
      'Configure Socket.IO, TURN/STUN services, emergency notifications and camera sharing.',
      'Install the Progressive Web App and cache application assets where supported.'
    ],
    label: 'Partial',
    note: 'Dedicated one-click broadcasts for every ward, LGA or role are not separate features. Managed rooms and incident chats are used instead.'
  },
  {
    title: '6. Pre-election analysis and risk preparation',
    items: [
      'Use historical or prepared result data for geographic comparison where available.',
      'Review polling-unit, ward and LGA information before deployment.',
      'Use map layers, assignments and reference data to prepare operational coverage.',
      'Configure an election ID for the public IReV feed when a supported pilot is required.'
    ],
    label: 'Partial',
    note: 'The application supports prepared and historical analysis, but not a complete forecasting or formal risk-scoring engine.'
  }
].forEach(addObjective);

body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
h1('PART II - ELECTION DAY');
p('This phase gives command users a live field view and gives agents the tools to report incidents, emergencies, evidence and polling-unit results.');
[
  {
    title: '7. Live command dashboard',
    items: [
      'Combine incidents, SOS alerts, personnel, GPS positions, results, cameras, notifications, map layers and analytics.',
      'Provide role-specific navigation, controls and visibility.',
      'Show live counts, severities, statuses and selected-incident details.',
      'Provide map and list views with filters and geographic context.',
      'Use TanStack Query for caching, request deduplication and controlled retries.',
      'Lazy-load heavy result datasets, modals, HLS playback and analytical features.'
    ],
    label: 'Partial',
    note: 'Formal voting-stage tracking is represented through reports and incidents rather than a dedicated polling-unit state machine.'
  },
  {
    title: '8. Field deployment and live location awareness',
    items: [
      'Receive authenticated GPS updates from eligible field users.',
      'Display personnel positions and online/offline awareness to authorized command users.',
      'Show routes, incidents, SOS alerts, polling-unit context and boundaries on the Leaflet map.',
      'Apply geographic and responsibility-based visibility to operational data.'
    ],
    label: 'Partial',
    note: 'GPS awareness exists, but a complete attendance timeline and missed-check-in alert engine are future scope.'
  },
  {
    title: '9. Incident reporting and response',
    items: [
      'Create incidents with description, category, severity, status, time, reporter, geography and coordinates.',
      'Attach validated image or video evidence and optional map geometry or styling.',
      'Cover vote buying, violence, intimidation, collusion, over-voting, late opening, material, BVAS, network and battery issues.',
      'Allow authorized command users to update incidents, assign personnel and issue instructions.',
      'Add assigned users to visibility and generate targeted notifications.',
      'Send realtime events only to users who pass the server-side access policy.'
    ],
    label: 'Implemented',
    note: 'Incident creation, evidence, severity, status, assignment, notifications and role-aware visibility are active workflows.',
    color: '1F3A5F'
  },
  {
    title: '10. SOS and emergency operations',
    items: [
      'Allow field roles to raise urgent alerts containing authenticated identity and coordinates.',
      'Display eligible alerts immediately to command users and update their map positions.',
      'Persist an incident record when the SOS workflow saves the emergency.',
      'Use sound or visual notifications and rate limiting to reduce alert flooding.',
      'Determine visibility from responsibility and geographic scope.'
    ],
    label: 'Not claimed',
    note: 'The SOS payload does not guarantee a separately stored telephone number. It relies on the authenticated profile and assignment.',
    color: '9B1C1C'
  },
  {
    title: '11. Photo, video and live-camera evidence',
    items: [
      'Accept validated image or video evidence in incident and result workflows.',
      'Allow field users to share phone cameras through WebRTC for authorized command viewing.',
      'Use TURN/STUN configuration for direct or relayed video connectivity.',
      'Queue segmented recordings locally after connection failure and upload them when connectivity returns.',
      'Allow authorized administrators to view registered CCTV/HLS sources.'
    ],
    label: 'Partial',
    note: 'Offline recovery focuses on camera clips. General offline queues for every incident, result, photo, GPS update and check-in are not complete.'
  },
  {
    title: '12. Polling-unit result capture',
    items: [
      'Allow agents and authorized users to submit political-party vote totals.',
      'Require valid state, LGA, ward and polling-unit values within the user’s allowed geography.',
      'Restrict an Agent account to its assigned polling unit.',
      'Accept only non-negative whole-number vote values.',
      'Require at least one signed result-sheet image.',
      'Record submitter, role-derived source, coordinates and submission time.',
      'Store the submission as a protected Polling Unit Result record.'
    ],
    label: 'Not claimed',
    note: 'The form does not independently capture every statutory figure, including registered, accredited, valid and rejected vote totals.',
    color: '9B1C1C'
  },
  {
    title: '13. Private communication and notifications',
    items: [
      'Provide room and incident conversations according to membership.',
      'Support text and validated image, video or document attachments.',
      'Deliver Socket.IO messages only through authorized chat rooms.',
      'Create targeted notifications for assignments and command messages.',
      'Keep the room selector, message list and composer visible on mobile.'
    ],
    label: 'Implemented',
    note: 'Authorized realtime messaging, notifications and the mobile chat layout support election-day coordination.',
    color: '1F3A5F'
  },
  {
    title: '14. Election-day reliability and field actions',
    intro: 'The field experience centers on Report Result, Report Incident, Share Photo/Video or Live Camera, and SOS.',
    items: [
      'Use WebSocket-first Socket.IO connections with polling fallback.',
      'Use server persistence and PWA asset caching to improve continuity.',
      'Fail production startup when configured durable storage is unavailable.'
    ],
    label: 'Partial',
    note: 'PWA asset caching does not mean every transaction works offline. Full offline incident and result synchronization remains future work.'
  }
].forEach(addObjective);

body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
h1('PART III - POST-ELECTION');
p('This phase protects submitted records, aggregates available figures, compares field evidence with prepared or public information, and supports review.');
[
  {
    title: '15. Result aggregation and operational analysis',
    items: [
      'Parse party-vote entries from submitted polling-unit result records.',
      'Calculate party totals and percentages across records visible to the user.',
      'Filter and drill down by polling unit, ward and LGA.',
      'Compare field reports with prepared or live IReV information when matches exist.',
      'Provide CSV export and dashboard analysis tools where available.'
    ],
    label: 'Partial',
    note: 'The calculations are decision-support analytics over available submissions, not official collation or declaration.'
  },
  {
    title: '16. IReV public-feed pilot and reconciliation',
    items: [
      'Consume structured JSON endpoints used by the public IReV portal rather than scraping rendered HTML.',
      'Request election statistics and polling-unit uploads for a configured election ID.',
      'Apply timeouts, response-size limits, sanitization and approved HTTPS image-host checks.',
      'Cache successful responses and persist changed archive snapshots.',
      'Use saved or bundled archive data when the upstream source is unavailable.',
      'Support a prepared Osun pilot and a configurable Oyo election feed.',
      'Provide admin-only OCR for approved Oyo result images with cached extraction results.'
    ],
    label: 'Important wording',
    note: 'Describe this as a public-feed integration or pilot, not an official INEC partnership, guaranteed API or legally authoritative source.'
  },
  {
    title: '17. Reporting, evidence review and audit support',
    items: [
      'Search and filter incidents, results, severities, statuses, parties and geographic areas.',
      'Review evidence, result-sheet images, assignments, notifications and operational history.',
      'Generate local or provider-assisted summaries from sanitized operational context.',
      'Record recent originating IP information for incident, result and SOS submissions.',
      'Protect notification ownership, room membership and role/geographic access at API level.'
    ],
    label: 'Partial',
    note: 'A comprehensive immutable audit ledger for every login, edit, assignment, message and administrative action is not yet implemented.'
  },
  {
    title: '18. Data persistence, security and deployment',
    items: [
      'Use PostgreSQL as the production system of record, or an explicitly configured persistent DATA_FILE path.',
      'Use authentication, rate limits, input sanitization, content-size limits and security headers.',
      'Build the frontend with Vite and serve it through the Express backend.',
      'Run Socket.IO on the authenticated backend with optional geocoding, routing, TURN, AI and IReV services.',
      'Restrict browser origins with CORS_ORIGIN and require production secrets.'
    ],
    label: 'Deployment note',
    note: 'A Neon data-transfer-quota failure is a database-provider issue. Resolve it by resetting or upgrading Neon, or changing DATABASE_URL to a working PostgreSQL database. It is not caused by Render application code.'
  },
  {
    title: '19. Post-election limitations and future extensions',
    items: [
      'Full statutory result fields and official collation or declaration.',
      'A complete immutable audit ledger for every sensitive action.',
      'External object storage for large media instead of database or base64 payloads.',
      'Formal certified reports for attendance, activity timelines and election results.',
      'Full offline synchronization for incidents, results, photos and GPS events.'
    ],
    label: 'Future scope',
    note: 'These items are valid extensions, but they should remain separate from the capabilities currently implemented.',
    color: '9B1C1C'
  }
].forEach(addObjective);

h1('Operational responsibility chain');
body.push(para('Agent / Response Team -> Supervisor -> Admin -> Super Admin / Command Leadership', 'Chain', { center: true, bold: true, color: '0B2545', size: 24 }));
p('Before the election, the chain supports preparation and assignment. On election day, it supports controlled reporting, escalation and response. After the election, it supports evidence review, analysis and accountable access to records.');
h1('Current-state summary');
p('Pre-election, the platform prepares users, roles, assignments, geography, maps and communication channels. On election day, it provides realtime command visibility, incidents, SOS, GPS, evidence, private chat and result submission. Post-election, it aggregates available submissions, supports IReV comparison, preserves records and provides analytical and export tools.');
p('Present the system as a secure election-monitoring and decision-support platform, not as an official electoral authority or final result-declaration system.');

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="1F2937"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="2E74B5"/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2E74B5"/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="DocumentTitle"><w:name w:val="Document Title"/><w:pPr><w:spacing w:before="1500" w:after="160"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:b/><w:color w:val="0B2545"/><w:sz w:val="54"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:color w:val="475569"/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Kicker"><w:name w:val="Kicker"/><w:pPr><w:spacing w:before="700" w:after="200"/></w:pPr><w:rPr><w:b/><w:color w:val="8B1E46"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Lead"><w:name w:val="Lead"/><w:pPr><w:spacing w:before="500" w:after="200" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:color w:val="7A5A00"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Status"><w:name w:val="Status"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="160" w:line="300" w:lineRule="auto"/><w:ind w:left="180" w:right="180"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Chain"><w:name w:val="Chain"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="200"/></w:pPr><w:rPr><w:b/><w:color w:val="0B2545"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`;
const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p>${run('Election Monitoring Command Center | Current Functional Objectives', { bold: true, color: '64748B', size: 18 })}</w:p></w:hdr>`;
const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr><w:t>Page </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Election Monitoring Command Center - Current Functional Objectives</dc:title><dc:subject>Implemented application scope</dc:subject><dc:creator>Engineering Team</dc:creator><cp:lastModifiedBy>Engineering Team</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-09-02T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-09-02T00:00:00Z</dcterms:modified></cp:coreProperties>`;
const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application><AppVersion>16.0000</AppVersion></Properties>`;
const files = { '[Content_Types].xml': contentTypes, '_rels/.rels': rootRels, 'docProps/core.xml': core, 'docProps/app.xml': app, 'word/document.xml': documentXml, 'word/styles.xml': stylesXml, 'word/numbering.xml': numberingXml, 'word/header1.xml': headerXml, 'word/footer1.xml': footerXml, 'word/_rels/document.xml.rels': docRels };
for (const [name, value] of Object.entries(files)) writeFileSync(join(temp, name), value, 'utf8');
console.log(temp);
