-- ============================================================
-- Cognix - Supabase Database Schema
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bbiwowuwlrneivycdqkf/sql
-- ============================================================

-- Note: API keys are stored as plaintext, protected by RLS policies.
-- No pgcrypto extension required.


-- ============================================================
-- Helper function: lookup email by username (for username login)
-- ============================================================
create or replace function public.get_email_by_name(p_name text)
returns text
language sql
security definer set search_path = 'public'
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.name = p_name
  limit 1;
$$;

-- ============================================================
-- Site-wide stats (cross-user, for public display)
-- ============================================================
create or replace function public.get_site_stats()
returns jsonb
language sql
security definer set search_path = 'public'
as $$
  select jsonb_build_object(
    'bank_count', (select count(*) from public.banks),
    'total_questions', (select count(*) from public.questions),
    'today_answered', coalesce((select sum(count) from public.learning_logs where date = current_date), 0),
    'user_count', (select count(*) from public.profiles)
  );
$$;

-- 1. Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  bio text default '',
  avatar_url text default '',
  role text not null default 'user' check (role in ('user', 'special', 'admin')),
  status text not null default 'active' check (status in ('active', 'banned')),
  special_applied_at timestamptz,
  ai_api_key text,
  ai_base_url text,
  ai_model text,
  mimo_api_key text,
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

-- Unique nickname constraint
alter table public.profiles add constraint profiles_name_unique unique (name);

-- Helper function: get current user's role (SECURITY DEFINER to bypass RLS)
create or replace function public.get_current_user_role()
returns text
language sql
security definer set search_path = 'public'
stable
as $$
  select role from public.profiles where id = (select auth.uid()) limit 1;
$$;

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

create policy "Admin can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.get_current_user_role() = 'admin');

create policy "Admin can update any profile"
  on public.profiles for update
  to authenticated
  using (public.get_current_user_role() = 'admin');


-- AI API Key functions (plaintext, protected by RLS)

-- Save API key
create or replace function public.save_ai_api_key(p_key text)
returns void
language plpgsql
security definer set search_path = 'public'
as $$
begin
  update public.profiles
  set ai_api_key = case
    when p_key is null or p_key = '' then null
    else p_key
  end
  where id = auth.uid();
end;
$$;

-- Read API key
create or replace function public.get_ai_api_key()
returns text
language plpgsql
security definer set search_path = 'public'
as $$
declare
  v_key text;
begin
  select ai_api_key into v_key from public.profiles where id = auth.uid();
  return coalesce(v_key, '');
end;
$$;

-- Check if AI is configured (no decryption)
create or replace function public.is_ai_configured()
returns boolean
language sql
security definer set search_path = 'public'
stable
as $$
  select ai_api_key is not null and ai_api_key != ''
  from public.profiles where id = auth.uid() limit 1;
$$;

-- MiMo API Key functions (voice ASR/TTS)

create or replace function public.save_mimo_api_key(p_key text)
returns void
language plpgsql
security definer set search_path = 'public'
as $$
begin
  update public.profiles
  set mimo_api_key = case
    when p_key is null or p_key = '' then null
    else p_key
  end
  where id = auth.uid();
end;
$$;

create or replace function public.get_mimo_api_key()
returns text
language plpgsql
security definer set search_path = 'public'
as $$
declare
  v_key text;
begin
  select mimo_api_key into v_key from public.profiles where id = auth.uid();
  return coalesce(v_key, '');
end;
$$;


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
  type text not null check (type in ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER')),
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

create policy "Anyone can read questions in shared banks"
  on public.questions for select
  using (
    exists (select 1 from public.banks where id = questions.bank_id and is_shared = true)
  );


-- 4. Practice Sessions
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_id uuid not null references public.banks(id) on delete cascade,
  mode text not null default 'random' check (mode in ('sequential', 'random', 'mistake', 'challenge')),
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


-- 8. Challenge Records (best streak per user)
create table public.challenge_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  best_streak int not null default 0,
  total_questions int not null default 0,
  updated_at timestamptz default now(),
  unique(user_id)
);

alter table public.challenge_records enable row level security;

create policy "Users can CRUD own challenge records"
  on public.challenge_records for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- 9. Chat Sessions & Messages (AI chat history)
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '新对话',
  created_at timestamptz default now()
);

create index idx_chat_sessions_user on public.chat_sessions(user_id, created_at desc);

alter table public.chat_sessions enable row level security;

create policy "Users can CRUD own chat sessions"
  on public.chat_sessions for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  question_id uuid references public.questions(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_chat_messages_session on public.chat_messages(session_id, created_at);

alter table public.chat_messages enable row level security;

create policy "Users can CRUD own chat messages"
  on public.chat_messages for all
  to authenticated
  using (
    (select auth.uid()) = (
      select user_id from public.chat_sessions where id = chat_messages.session_id
    )
  )
  with check (
    (select auth.uid()) = (
      select user_id from public.chat_sessions where id = chat_messages.session_id
    )
  );


-- 10. Share Requests (审批分享申请)
create table public.share_requests (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create index idx_share_requests_user_id on public.share_requests(user_id);
create index idx_share_requests_status on public.share_requests(status);

alter table public.share_requests enable row level security;

create policy "Users can read own share requests"
  on public.share_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own share requests"
  on public.share_requests for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Admin can read all share requests"
  on public.share_requests for select
  to authenticated
  using (public.get_current_user_role() = 'admin');

create policy "Admin can update share requests"
  on public.share_requests for update
  to authenticated
  using (public.get_current_user_role() = 'admin');


-- 10. Storage bucket for AI imports
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

-- 11. Storage bucket for avatars
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

-- 12. Cleanup unused avatars function (run periodically via cron or manually)
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
        select date, date - row_number() over (order by date desc)::int as grp
        from public.learning_logs where user_id = (select id from uid) and count > 0
      ),
      latest_grp as (select grp from dates order by date desc limit 1)
      select count(*) from dates where grp = (select grp from latest_grp)
    ),
    'bank_count', coalesce((select count(*) from public.banks where user_id = (select id from uid)), 0),
    'total_questions', coalesce((select count(*) from public.questions q join public.banks b on q.bank_id = b.id where b.user_id = (select id from uid)), 0),
    'avg_accuracy', coalesce((select round(sum(correct)::decimal / nullif(sum(count), 0)::decimal, 2) from public.learning_logs where user_id = (select id from uid)), 0),
    'max_streak', 0,
    'challenge_record', coalesce((select best_streak from public.challenge_records where user_id = (select id from uid)), 0),
    'heatmap', coalesce((
      select jsonb_agg(jsonb_build_object('date', d, 'count', c))
      from (select date as d, count as c from public.learning_logs where user_id = (select id from uid) and date >= current_date - interval '6 months' order by date) t
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


-- ============================================================
-- AI usage tracking
-- ============================================================
create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  model text not null default '',
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  created_at timestamptz default now()
);

create index idx_ai_usage_user_created on public.ai_usage_logs(user_id, created_at desc);

alter table public.ai_usage_logs enable row level security;

create policy "Users can read own ai usage"
  on public.ai_usage_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own ai usage"
  on public.ai_usage_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);


create or replace function public.get_ai_usage_stats()
returns jsonb
language sql
security definer set search_path = 'public'
as $$
  with uid as (select auth.uid() as id)
  select jsonb_build_object(
    'today_calls', coalesce((select count(*) from ai_usage_logs where user_id = (select id from uid) and created_at::date = current_date), 0),
    'total_calls', coalesce((select count(*) from ai_usage_logs where user_id = (select id from uid)), 0),
    'today_tokens', coalesce((select sum(total_tokens) from ai_usage_logs where user_id = (select id from uid) and created_at::date = current_date), 0),
    'total_tokens', coalesce((select sum(total_tokens) from ai_usage_logs where user_id = (select id from uid)), 0),
    'recent_logs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', action,
        'model', model,
        'prompt_tokens', prompt_tokens,
        'completion_tokens', completion_tokens,
        'total_tokens', total_tokens,
        'created_at', to_char(created_at, 'YYYY-MM-DD HH24:MI')
      ))
      from (
        select * from ai_usage_logs where user_id = (select id from uid)
        order by created_at desc limit 10
      ) r
    ), '[]'::jsonb)
  );
$$;
