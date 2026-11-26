create extension if not exists citext;
create table players(
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  username citext unique not null check (username ~ '^[A-Za-z0-9_]{3,32}$'),
  username_changed_at timestamptz,
  created_at timestamptz default now());
create table player_stats(
  player_id uuid primary key references players on delete cascade,
  best_score int not null default 0, total_coins int not null default 0,
  levels_completed int not null default 0, games_played int not null default 0,
  updated_at timestamptz default now());
create table game_sessions(
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players on delete cascade,
  started_at timestamptz not null default now(), finished_at timestamptz, used boolean not null default false);
create table game_scores(
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players on delete cascade,
  session_id uuid unique not null references game_sessions,
  score int not null, coins int not null, levels int not null, duration_s int not null,
  created_at timestamptz default now());
create index on player_stats(best_score desc);
create index on game_scores(player_id, created_at desc);
create index on game_sessions(player_id, started_at desc);

alter table players enable row level security;
alter table player_stats enable row level security;
alter table game_sessions enable row level security;
alter table game_scores enable row level security;
-- No anon/authenticated write policies exist: ALL writes go through the server (service role).
create policy "stats readable" on player_stats for select using (true);

create view leaderboard as
  select p.username, s.best_score, s.total_coins, s.levels_completed, s.games_played, p.id as player_id
  from player_stats s join players p on p.id = s.player_id
  where s.best_score > 0 order by s.best_score desc, s.updated_at asc limit 100;
grant select on leaderboard to anon, authenticated;

create function submit_score(p_player uuid, p_session uuid, p_score int, p_coins int, p_levels int, p_dur int)
returns void language plpgsql security definer set search_path=public as $$
begin
  update game_sessions set used=true, finished_at=now() where id=p_session and player_id=p_player and not used;
  if not found then raise exception 'invalid_session'; end if;
  insert into game_scores(player_id,session_id,score,coins,levels,duration_s) values(p_player,p_session,p_score,p_coins,p_levels,p_dur);
  insert into player_stats(player_id,best_score,total_coins,levels_completed,games_played)
    values(p_player,p_score,p_coins,p_levels,1)
  on conflict(player_id) do update set best_score=greatest(player_stats.best_score,p_score),
    total_coins=player_stats.total_coins+p_coins, levels_completed=player_stats.levels_completed+p_levels,
    games_played=player_stats.games_played+1, updated_at=now();
end $$;

create function change_username(p_player uuid, p_name text)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare t timestamptz;
begin
  update players set username=p_name, username_changed_at=now()
   where id=p_player and (username_changed_at is null or username_changed_at <= now()-interval '7 days')
   returning username_changed_at into t;
  if t is null then raise exception 'too_soon'; end if;
  return t;
end $$;
revoke all on function submit_score, change_username from public, anon, authenticated;
alter publication supabase_realtime add table player_stats;
