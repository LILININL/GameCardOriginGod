-- Alumilive Alpha relational schema (PostgreSQL)
-- Generated: 2026-02-20

create table if not exists players (
  id text primary key,
  display_name varchar(60) not null,
  created_at timestamptz not null default now()
);

create table if not exists decks (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  name varchar(80) not null,
  king_id text not null,
  commander_id text not null,
  aura_mode varchar(10) not null check (aura_mode in ('BURST', 'PULSE')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deck_cards (
  deck_id text not null references decks(id) on delete cascade,
  card_id text not null,
  qty integer not null check (qty > 0),
  primary key (deck_id, card_id)
);

create table if not exists rooms (
  id text primary key,
  host_player_id text not null references players(id) on delete cascade,
  join_code varchar(12) not null unique,
  mode varchar(20) not null default 'PRIVATE',
  status varchar(20) not null default 'WAITING',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  closed_at timestamptz
);

create table if not exists room_players (
  room_id text not null references rooms(id) on delete cascade,
  player_id text not null references players(id) on delete cascade,
  seat_no integer not null check (seat_no in (1, 2)),
  ready boolean not null default false,
  loadout_locked boolean not null default false,
  loadout_json jsonb,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id),
  unique (room_id, seat_no)
);

create table if not exists matches (
  id text primary key,
  room_id text references rooms(id) on delete set null,
  status varchar(20) not null default 'IN_PROGRESS',
  winner_player_id text references players(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists match_players (
  match_id text not null references matches(id) on delete cascade,
  player_id text not null references players(id) on delete cascade,
  deck_id text references decks(id),
  king_id text not null,
  commander_id text not null,
  aura_mode varchar(10) not null check (aura_mode in ('BURST', 'PULSE')),
  is_first boolean not null,
  primary key (match_id, player_id)
);

create table if not exists match_actions (
  id bigserial primary key,
  match_id text not null references matches(id) on delete cascade,
  state_version integer not null,
  actor_player_id text not null references players(id),
  client_action_id text,
  event_name varchar(80) not null,
  action_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (match_id, state_version),
  unique (match_id, actor_player_id, client_action_id)
);

create table if not exists match_snapshots (
  id bigserial primary key,
  match_id text not null references matches(id) on delete cascade,
  state_version integer not null,
  state_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (match_id, state_version)
);

create index if not exists idx_decks_player on decks(player_id);
create index if not exists idx_room_players_room on room_players(room_id);
create index if not exists idx_matches_room on matches(room_id);
create index if not exists idx_match_actions_match on match_actions(match_id, id);
create index if not exists idx_match_snapshots_match on match_snapshots(match_id, state_version desc);
