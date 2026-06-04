-- ============================================================
-- Cognix - Supabase Database Schema
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bbiwowuwlrneivycdqkf/sql
-- ============================================================

-- 1. Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  bio text default '',
  avatar_url text default '',
  ai_api_key text,
  ai_base_url text,
  ai_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = 'public'
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);


-- 2. Banks
create table public.banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.banks enable row level security;

create policy "Users can CRUD own banks"
  on public.banks for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- 3. Questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete cascade,
  type text not null check (type in ('SINGLE', 'MULTIPLE', 'TRUE_FALSE')),
  content text not null,
  options jsonb not null default '[]',
  answer text not null,
  explanation text,
  difficulty text default 'EASY' check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
  tags jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_questions_bank_id on public.questions(bank_id);

alter table public.questions enable row level security;

create policy "Users can CRUD questions in own banks"
  on public.questions for all
  to authenticated
  using (
    (select auth.uid()) = (
      select user_id from public.banks where id = questions.bank_id
    )
  )
  with check (
    (select auth.uid()) = (
      select user_id from public.banks where id = questions.bank_id
    )
  );


-- 4. Practice Sessions
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_id uuid not null references public.banks(id) on delete cascade,
  mode text not null default 'random' check (mode in ('sequential', 'random', 'mistake')),
  total_count int not null default 0,
  correct_count int not null default 0,
  time_spent int not null default 0,
  is_completed boolean not null default false,
  created_at timestamptz default now(),
  finished_at timestamptz
);

alter table public.practice_sessions enable row level security;

create policy "Users can CRUD own sessions"
  on public.practice_sessions for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- 5. Practice Details (individual answers)
create table public.practice_details (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_answer text not null,
  is_correct boolean not null default false,
  time_spent int not null default 0,
  order_index int not null default 0,
  created_at timestamptz default now(),
  unique(session_id, question_id)
);

create index idx_practice_details_session on public.practice_details(session_id);

alter table public.practice_details enable row level security;

create policy "Users can CRUD own practice details"
  on public.practice_details for all
  to authenticated
  using (
    (select auth.uid()) = (
      select user_id from public.practice_sessions where id = practice_details.session_id
    )
  )
  with check (
    (select auth.uid()) = (
      select user_id from public.practice_sessions where id = practice_details.session_id
    )
  );


-- 6. Mistakes
create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  wrong_count int not null default 1,
  consecutive_correct int not null default 0,
  is_mastered boolean not null default false,
  last_wrong_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, question_id)
);

alter table public.mistakes enable row level security;

create policy "Users can CRUD own mistakes"
  on public.mistakes for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- 7. Learning Logs
create table public.learning_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  count int not null default 0,
  correct int not null default 0,
  unique(user_id, date)
);

create index idx_learning_logs_user_date on public.learning_logs(user_id, date);

alter table public.learning_logs enable row level security;

create policy "Users can CRUD own learning logs"
  on public.learning_logs for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- 8. Storage bucket for AI imports
insert into storage.buckets (id, name, public, file_size_limit)
values ('ai-imports', 'ai-imports', false, 10485760)
on conflict (id) do nothing;

create policy "Users can upload own imports"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ai-imports' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "Users can read own imports"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'ai-imports' and (select auth.uid())::text = (storage.foldername(name))[1]);

-- 9. Storage bucket for avatars
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)
on conflict (id) do nothing;

create policy "Anyone can read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "Users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (select auth.uid())::text = (storage.foldername(name))[1]);

-- 10. Cleanup unused avatars function (run periodically via cron or manually)
create or replace function public.cleanup_unused_avatars()
returns void
language plpgsql
security definer set search_path = 'public'
as $$
declare
  obj record;
begin
  for obj in
    select name from storage.objects
    where bucket_id = 'avatars'
    and created_at < now() - interval '1 day'
  loop
    -- Check if any profile references this avatar
    if not exists (
      select 1 from profiles where avatar_url like '%' || obj.name || '%'
    ) then
      delete from storage.objects where bucket_id = 'avatars' and name = obj.name;
    end if;
  end loop;
end;
$$;


-- ============================================================
-- Functions for dashboard stats
-- ============================================================
create or replace function public.get_dashboard_stats()
returns jsonb
language sql
security definer set search_path = 'public'
as $$
  with uid as (select auth.uid() as id)
  select jsonb_build_object(
    'today_answered', coalesce((select sum(count) from public.learning_logs where user_id = (select id from uid) and date = current_date), 0),
    'accuracy', coalesce((select round(sum(correct)::decimal / nullif(sum(count), 0)::decimal, 2) from public.learning_logs where user_id = (select id from uid) and date = current_date), 0),
    'streak_days', (
      with dates as (
        select date from public.learning_logs where user_id = (select id from uid) and count > 0 order by date desc
      )
      select count(*) from (
        select date, date - row_number() over (order by date desc)::int as grp from dates
      ) d where grp = (select max(date - row_number() over (order by date desc)::int) from dates)
    ),
    'bank_count', coalesce((select count(*) from public.banks where user_id = (select id from uid)), 0),
    'total_questions', coalesce((select count(*) from public.questions q join public.banks b on q.bank_id = b.id where b.user_id = (select id from uid)), 0),
    'avg_accuracy', coalesce((select round(sum(correct)::decimal / nullif(sum(count), 0)::decimal, 2) from public.learning_logs where user_id = (select id from uid)), 0),
    'max_streak', 0,
    'heatmap', coalesce((
      select jsonb_agg(jsonb_build_object('date', date, 'count', count))
      from public.learning_logs where user_id = (select id from uid) and date >= current_date - interval '6 months'
      order by date
    ), '[]'::jsonb),
    'recent_sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(created_at, 'YYYY-MM-DD'),
        'mode', mode,
        'correct', correct_count,
        'total', total_count,
        'accuracy', round(correct_count::decimal / nullif(total_count, 0)::decimal, 2),
        'duration', concat(floor(time_spent / 60), ':', lpad((time_spent % 60)::text, 2, '0'))
      ))
      from (
        select * from public.practice_sessions where user_id = (select id from uid) and is_completed = true
        order by created_at desc limit 10
      ) s
    ), '[]'::jsonb)
  );
$$;
