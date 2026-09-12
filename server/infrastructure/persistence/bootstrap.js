export async function initPostgres({ pool, seed }) {
  if (!pool) return;
  await pool.query(`
    create table if not exists users (
      id text primary key,
      name text not null,
      email text not null unique,
      password text not null,
      role text not null default 'Agent',
      rank text default '',
      active boolean not null default true,
      unit text default 'Field Unit',
      unit_type text default 'Division',
      command text default '',
      division text default '',
      station text default '',
      state text default '',
      lga text default '',
      ward text default '',
      polling_unit text default '',
      lat double precision,
      lng double precision
    );
    create table if not exists incidents (
      id text primary key,
      title text not null,
      description text default '',
      report_type text default 'IP',
      severity text default 'High',
      status text default 'Open',
      lat double precision not null,
      lng double precision not null,
      assigned_to text default '',
      visible_to jsonb default '[]'::jsonb,
      media jsonb default '[]'::jsonb,
      geometry jsonb,
      style jsonb,
      lga text default '',
      ward text default '',
      polling_unit text default '',
      result_count text default '',
      lifecycle jsonb default '{}'::jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz,
      created_by text default ''
    );
    create table if not exists result_records (
      id text primary key,
      submission_id text not null,
      payload_hash text not null,
      election_id text not null,
      scope_id text not null,
      source_release_id text not null,
      result_id text default '',
      geography jsonb,
      provenance jsonb,
      state text default '',
      lga text default '',
      ward text default '',
      polling_unit text default '',
      result_source text default '',
      submitted_by text default '',
      submitted_by_role text default '',
      result_count text default '',
      evidence jsonb default '[]'::jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create unique index if not exists result_records_submission_id_idx on result_records (submission_id);
    alter table result_records add column if not exists result_id text default '';
    alter table result_records add column if not exists source_release_id text default '';
    alter table result_records add column if not exists capture_time timestamptz;
    alter table result_records add column if not exists server_receipt_at timestamptz;
    alter table result_records add column if not exists record_version text default '1';
    create table if not exists result_reconciliations (
      id text primary key,
      election_id text not null,
      contest_id text not null,
      polling_unit text not null,
      source_version text not null,
      result_record_ids jsonb not null default '[]'::jsonb,
      official_record jsonb,
      discrepancies jsonb not null default '[]'::jsonb,
      status text not null default 'pending-review',
      reviewer_id text default '',
      reviewer_decision jsonb,
      correction_id text default '',
      created_at timestamptz default now(),
      reviewed_at timestamptz
    );
    create table if not exists result_corrections (
      id text primary key,
      reconciliation_id text not null,
      original_record_ids jsonb not null default '[]'::jsonb,
      corrected_result jsonb not null,
      reason text not null,
      corrected_by text not null,
      source_classification text not null default 'field-observed',
      created_at timestamptz default now()
    );
    alter table incidents add column if not exists lifecycle jsonb default '{}'::jsonb;
    alter table incidents add column if not exists submission_id text default '';
    alter table incidents add column if not exists capture_time timestamptz;
    alter table incidents add column if not exists server_receipt_at timestamptz;
    alter table incidents add column if not exists record_version text default '1';
    create unique index if not exists incidents_submission_id_idx on incidents (submission_id) where submission_id <> '';
    create table if not exists cameras (
      id text primary key,
      name text not null,
      type text default 'CCTV',
      url text not null,
      lat double precision,
      lng double precision,
      state text default '',
      lga text default '',
      ward text default '',
      polling_unit text default '',
      status text default 'Online',
      created_at timestamptz default now()
    );
    create table if not exists map_layers (
      id text primary key,
      name text not null,
      type text not null,
      data jsonb,
      url text,
      bounds jsonb,
      opacity double precision default 0.65,
      fill_opacity double precision default 0.18,
      category text default 'Point',
      operational_use text default 'Reference',
      color text default '#facc15',
      fill_color text default '#f59e0b',
      line_weight double precision default 2,
      line_style text default 'solid',
      point_icon text default 'pin',
      point_icon_color text default '#ffffff',
      point_size double precision default 2,
      show_labels boolean default true,
      label_field text default 'name',
      label_color text default '#3f0b1b',
      popup_fields text default '',
      visible boolean default true,
      z_index integer default 0,
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists chat_rooms (
      id text primary key,
      name text not null,
      type text default 'room',
      incident_id text default '',
      created_by text default '',
      created_at timestamptz default now()
    );
    create table if not exists chat_members (
      room_id text not null,
      user_id text not null,
      primary key (room_id, user_id)
    );
    create table if not exists chat_messages (
      id text primary key,
      room_id text not null,
      sender_id text not null,
      body text not null,
      attachments jsonb default '[]'::jsonb,
      created_at timestamptz default now()
    );
    create table if not exists notifications (
      id text primary key,
      user_id text not null,
      incident_id text default '',
      room_id text default '',
      sender_id text default '',
      message text not null,
      incident_type text default '',
      read boolean default false,
      created_at timestamptz default now()
    );
    create table if not exists tasks (
      id text primary key,
      title text not null,
      description text default '',
      status text not null default 'open',
      priority text not null default 'normal',
      accountable_owner_id text not null,
      incident_id text default '',
      decision_id text default '',
      resource_request_id text default '',
      geography jsonb default '{}'::jsonb,
      acknowledged_at timestamptz,
      acknowledged_by text default '',
      acknowledgement_submission_id text default '',
      acknowledgement_capture_time timestamptz,
      acknowledgement_server_receipt_at timestamptz,
      acknowledgement_record_version text default '1',
      acknowledgement_payload_hash text default '',
      deadline_at timestamptz,
      response_evidence jsonb default '[]'::jsonb,
      escalation_level integer default 0,
      created_by text default '',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists escalation_history (
      id text primary key,
      task_id text not null,
      incident_id text default '',
      level integer not null,
      reason text not null,
      actor_id text default 'system',
      created_at timestamptz default now()
    );
    create table if not exists notification_outbox (
      id text primary key,
      dedupe_key text not null unique,
      notification_id text not null,
      user_id text not null,
      payload jsonb not null,
      status text not null default 'pending',
      attempts integer not null default 0,
      available_at timestamptz default now(),
      delivered_at timestamptz,
      last_error text default '',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create index if not exists tasks_deadline_idx on tasks (status, deadline_at);
    alter table tasks add column if not exists acknowledgement_submission_id text default '';
    alter table tasks add column if not exists acknowledgement_capture_time timestamptz;
    alter table tasks add column if not exists acknowledgement_server_receipt_at timestamptz;
    alter table tasks add column if not exists acknowledgement_record_version text default '1';
    alter table tasks add column if not exists acknowledgement_payload_hash text default '';
    create index if not exists notification_outbox_pending_idx on notification_outbox (status, available_at);
    create table if not exists audit_events (
      id text primary key,
      actor_id text default '',
      actor_role text default '',
      action text not null,
      entity_type text default 'record',
      entity_id text default '',
      source text default 'system',
      scope_id text default 'ng-oyo',
      status text default 'logged',
      geography jsonb,
      details jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create table if not exists countries (
      id text primary key,
      name text not null,
      code text default '',
      iso_code text default '',
      scope_id text default 'ng-oyo',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists states (
      id text primary key,
      country_id text default '',
      name text not null,
      code text default '',
      scope_id text default 'ng-oyo',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists constituencies (
      id text primary key,
      state_id text default '',
      name text not null,
      code text default '',
      scope_id text default 'ng-oyo',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists geography_units (
      id text primary key,
      type text not null,
      name text not null,
      parent_id text default '',
      country_id text default '',
      state_id text default '',
      lga_id text default '',
      constituency_id text default '',
      canonical_id text default '',
      source_name text default '',
      source_version text default '',
      geometry jsonb,
      valid_from timestamptz,
      valid_to timestamptz,
      latitude double precision,
      longitude double precision,
      coordinates_source text default '',
      scope_id text default 'ng-oyo',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists elections (
      id text primary key,
      scope_id text default 'ng-oyo',
      name text not null,
      election_type text default 'general',
      status text default 'draft',
      election_date timestamptz,
      source_name text default '',
      source_id text default '',
      source_version text default '',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists election_contests (
      id text primary key,
      election_id text not null,
      office text not null,
      office_code text default '',
      contest_name text default '',
      scope_id text default 'ng-oyo',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists parties (
      id text primary key,
      name text not null,
      abbreviation text default '',
      color text default '',
      scope_id text default 'ng-oyo',
      source_name text default '',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists candidates (
      id text primary key,
      name text not null,
      party_id text default '',
      election_id text default '',
      contest_id text default '',
      scope_id text default 'ng-oyo',
      source_name text default '',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists external_geography_ids (
      id text primary key,
      geography_unit_id text not null,
      source_name text not null,
      source_id text default '',
      external_id text not null,
      source_version text default '',
      scope_id text default 'ng-oyo',
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists app_settings (key text primary key, value jsonb not null default '[]'::jsonb);
  `);
  await pool.query(
    "alter table users add column if not exists rank text default ''",
  );
  await pool.query(
    "alter table users add column if not exists unit_type text default 'Division'",
  );
  await pool.query(
    "alter table users add column if not exists command text default ''",
  );
  await pool.query(
    "alter table users add column if not exists division text default ''",
  );
  await pool.query(
    "alter table users add column if not exists station text default ''",
  );
  await pool.query(
    "alter table users add column if not exists state text default ''",
  );
  await pool.query(
    "alter table users add column if not exists lga text default ''",
  );
  await pool.query(
    "alter table users add column if not exists ward text default ''",
  );
  await pool.query(
    "alter table users add column if not exists polling_unit text default ''",
  );
  // An unset personnel or camera location must read back as unknown, not the Oyo command-centre
  // coordinate. Drop the legacy magic-number defaults; existing explicit values are untouched.
  await pool.query("alter table users alter column lat drop default");
  await pool.query("alter table users alter column lng drop default");
  await pool.query("alter table cameras add column if not exists state text default ''");
  await pool.query("alter table cameras add column if not exists lga text default ''");
  await pool.query("alter table cameras add column if not exists ward text default ''");
  await pool.query("alter table cameras add column if not exists polling_unit text default ''");
  await pool.query("alter table cameras alter column lat drop default");
  await pool.query("alter table cameras alter column lng drop default");
  await pool.query("create index if not exists users_geography_idx on users (lga, ward, polling_unit)");
  await pool.query("create index if not exists cameras_geography_idx on cameras (lga, ward, polling_unit)");
  await pool.query("create index if not exists incidents_geography_idx on incidents (lga, ward, polling_unit)");
  await pool.query("create index if not exists incidents_created_at_idx on incidents (created_at desc)");
  await pool.query("create index if not exists result_records_geography_idx on result_records (lga, ward, polling_unit)");
  await pool.query("create index if not exists result_records_election_idx on result_records (election_id, scope_id)");
  await pool.query("create index if not exists tasks_geography_idx on tasks ((geography->>'lga'), (geography->>'ward'))");
  await pool.query("create index if not exists audit_events_lookup_idx on audit_events (entity_type, entity_id, created_at desc)");
  // Append-only protection: no application code path exposes an update/delete for audit
  // events (see foundation/repository.js), and this trigger backstops that at the database
  // level against a direct connection. This has not been exercised against a live Postgres
  // in this environment -- verify it fires as expected (attempt an UPDATE/DELETE and confirm
  // it is rejected) before relying on it in production.
  await pool.query(`
    create or replace function reject_audit_event_mutation() returns trigger as $$
    begin
      raise exception 'audit_events is append-only; % is not permitted', tg_op;
    end;
    $$ language plpgsql;
  `);
  await pool.query('drop trigger if exists audit_events_append_only on audit_events');
  await pool.query(`
    create trigger audit_events_append_only
    before update or delete on audit_events
    for each row execute function reject_audit_event_mutation();
  `);
  await pool.query(
    "alter table notifications add column if not exists room_id text default ''",
  );
  await pool.query(
    "alter table notifications add column if not exists sender_id text default ''",
  );
  await pool.query(
    "alter table chat_messages add column if not exists attachments jsonb default '[]'::jsonb",
  );
  await pool.query(
    "alter table incidents add column if not exists report_type text default 'IP'",
  );
  await pool.query(
    "alter table incidents add column if not exists visible_to jsonb default '[]'::jsonb",
  );
  await pool.query(
    "alter table incidents add column if not exists media jsonb default '[]'::jsonb",
  );
  await pool.query(
    "alter table incidents add column if not exists geometry jsonb",
  );
  await pool.query(
    "alter table incidents add column if not exists style jsonb",
  );
  await pool.query(
    "alter table incidents add column if not exists lga text default ''",
  );
  await pool.query(
    "alter table incidents add column if not exists ward text default ''",
  );
  await pool.query(
    "alter table incidents add column if not exists polling_unit text default ''",
  );
  await pool.query(
    "alter table incidents add column if not exists result_count text default ''",
  );
  await pool.query("drop index if exists one_polling_result_per_unit");
  await pool.query(
    "alter table map_layers add column if not exists category text default 'Point'",
  );
  await pool.query(
    "alter table map_layers add column if not exists operational_use text default 'Reference'",
  );
  await pool.query(
    "alter table map_layers add column if not exists color text default '#facc15'",
  );
  await pool.query(
    "alter table map_layers add column if not exists fill_color text default '#f59e0b'",
  );
  await pool.query(
    "alter table map_layers add column if not exists fill_opacity double precision default 0.18",
  );
  await pool.query(
    "alter table map_layers add column if not exists line_weight double precision default 2",
  );
  await pool.query(
    "alter table map_layers add column if not exists line_style text default 'solid'",
  );
  await pool.query(
    "alter table map_layers add column if not exists point_icon text default 'pin'",
  );
  await pool.query(
    "alter table map_layers add column if not exists point_icon_color text default '#ffffff'",
  );
  await pool.query(
    "alter table map_layers add column if not exists point_size double precision default 2",
  );
  await pool.query(
    "alter table map_layers alter column point_size set default 2",
  );
  await pool.query(
    "alter table map_layers add column if not exists show_labels boolean default true",
  );
  await pool.query(
    "alter table map_layers add column if not exists label_field text default 'name'",
  );
  await pool.query(
    "alter table map_layers add column if not exists label_color text default '#3f0b1b'",
  );
  await pool.query(
    "alter table map_layers add column if not exists popup_fields text default ''",
  );
  await pool.query(
    "alter table map_layers add column if not exists visible boolean default true",
  );
  await pool.query(
    "alter table map_layers add column if not exists z_index integer default 0",
  );
  await pool.query(
    "alter table map_layers add column if not exists updated_at timestamptz",
  );
  await pool.query(
    "update users set role='Agent', rank='Agent' where role='Officer'",
  );
  const { rows } = await pool.query("select count(*)::int as count from users");
  await pool.query(
    "delete from incidents where id in ('i1','i2','i3') or created_by='seed'",
  );
  for (const user of seed.users) {
    await pool.query(
      "insert into users (id,name,email,password,role,rank,active,unit,unit_type,command,division,station,lga,lat,lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) on conflict (id) do update set name=excluded.name,email=excluded.email,role=excluded.role,rank=excluded.rank,active=excluded.active,unit=excluded.unit,command=excluded.command",
      [
        user.id,
        user.name,
        user.email,
        user.password,
        user.role,
        user.rank,
        user.active,
        user.unit,
        user.unitType || "Division",
        user.command,
        user.division,
        user.station || "",
        user.lga,
        user.lat,
        user.lng,
      ],
    );
  }
}

