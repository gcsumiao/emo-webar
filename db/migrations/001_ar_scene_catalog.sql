create table if not exists tenants (
  id bigserial primary key,
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id bigserial primary key,
  tenant_id bigint not null references tenants(id) on delete cascade,
  slug text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists scenes (
  id bigserial primary key,
  tenant_id bigint not null references tenants(id) on delete cascade,
  slug text not null,
  label text not null,
  mind_file_url text not null,
  target_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists location_scenes (
  location_id bigint not null references locations(id) on delete cascade,
  scene_id bigint not null references scenes(id) on delete cascade,
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (location_id, scene_id)
);

create table if not exists scene_targets (
  id bigserial primary key,
  scene_id bigint not null references scenes(id) on delete cascade,
  target_index integer not null,
  target_id text not null,
  label text not null,
  render_mode text not null default 'gltf-only',
  glb jsonb not null default '{}'::jsonb,
  sprite jsonb not null default '{}'::jsonb,
  action jsonb not null default '{"type":"none"}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scene_id, target_index)
);

create table if not exists recognition_events (
  id bigserial primary key,
  tenant_id bigint references tenants(id) on delete set null,
  location_id bigint references locations(id) on delete set null,
  scene_id bigint references scenes(id) on delete set null,
  target_index integer,
  confidence double precision,
  source text not null default 'mindar',
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_locations_tenant_slug on locations(tenant_id, slug);
create index if not exists idx_scenes_tenant_slug on scenes(tenant_id, slug);
create index if not exists idx_location_scenes_location_priority on location_scenes(location_id, active, priority);
create index if not exists idx_scene_targets_scene_index on scene_targets(scene_id, active, target_index);
create index if not exists idx_recognition_events_created_at on recognition_events(created_at desc);
