-- SEARCH HISTORY
create table if not exists public.search_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  address     text,
  lat         double precision not null,
  lng         double precision not null,
  searched_at timestamptz default now()
);
create index if not exists idx_search_history_user_id on public.search_history(user_id, searched_at desc);

-- FAVORITES
create table if not exists public.favorites (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  place_id     text,
  name         text not null,
  address      text,
  lat          double precision,
  lng          double precision,
  rating       double precision,
  price_level  int,
  photo_url    text,
  category     text,
  is_open      boolean,
  favorited_at timestamptz default now(),
  unique(user_id, place_id)
);
create index if not exists idx_favorites_user_id on public.favorites(user_id, favorited_at desc);

-- FAVORITE ALBUMS
create table if not exists public.favorite_albums (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  cover_photo_url text,
  created_at      timestamptz default now()
);

create table if not exists public.favorite_album_items (
  album_id    uuid not null references public.favorite_albums(id) on delete cascade,
  favorite_id uuid not null references public.favorites(id) on delete cascade,
  primary key (album_id, favorite_id)
);
create index if not exists idx_favorite_albums_user_id on public.favorite_albums(user_id);

-- SAVED PLANS
create table if not exists public.saved_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  kind           text not null check (kind in ('manual', 'generated')),
  title          text not null,
  subtitle       text,
  prompt         text,
  days           int,
  activity_count int,
  destination    jsonb,
  plan_data      jsonb not null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_saved_plans_user_id on public.saved_plans(user_id, updated_at desc);

-- RLS
alter table public.search_history       enable row level security;
alter table public.favorites            enable row level security;
alter table public.favorite_albums      enable row level security;
alter table public.favorite_album_items enable row level security;
alter table public.saved_plans          enable row level security;

drop policy if exists "Users manage own search history" on public.search_history;
create policy "Users manage own search history" on public.search_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own albums" on public.favorite_albums;
create policy "Users manage own albums" on public.favorite_albums
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own album items" on public.favorite_album_items;
create policy "Users manage own album items" on public.favorite_album_items
  for all using (
    exists (
      select 1 from public.favorite_albums
      where id = favorite_album_items.album_id and user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own plans" on public.saved_plans;
create policy "Users manage own plans" on public.saved_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
