-- ============================================================
-- Cognix — Combined Migration for Existing Installations
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bbiwowuwlrneivycdqkf/sql
-- ============================================================

-- ============================================================
-- 1. Unique Nickname + Username Login
-- ============================================================

-- 1a. Handle existing duplicate names
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT id, name, row_number() OVER (PARTITION BY name ORDER BY created_at) AS rn
    FROM public.profiles
    WHERE name IS NOT NULL AND name != ''
  LOOP
    IF dup.rn > 1 THEN
      UPDATE public.profiles
      SET name = dup.name || '_' || substring(md5(random()::text), 1, 6)
      WHERE id = dup.id;
    END IF;
  END LOOP;
END $$;

-- 1b. Add unique constraint
ALTER TABLE public.profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_name_unique UNIQUE (name);

-- 1c. Lookup email by username (for username-based login)
CREATE OR REPLACE FUNCTION public.get_email_by_name(p_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT u.email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE p.name = p_name
  LIMIT 1;
$$;


-- ============================================================
-- 2. Site-wide Stats
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_site_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT jsonb_build_object(
    'bank_count',      (SELECT count(*) FROM public.banks),
    'total_questions', (SELECT count(*) FROM public.questions),
    'today_answered',  coalesce((SELECT sum(count) FROM public.learning_logs WHERE date = current_date), 0),
    'user_count',      (SELECT count(*) FROM public.profiles)
  );
$$;


-- ============================================================
-- 3. Community Square (广场)
-- ============================================================

-- 3a. Add columns to banks
ALTER TABLE public.banks ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;
ALTER TABLE public.banks ADD COLUMN IF NOT EXISTS source_bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL;
ALTER TABLE public.banks ADD COLUMN IF NOT EXISTS source_user_name text;

-- 3b. RLS — allow anyone to read shared banks
DROP POLICY IF EXISTS "Anyone can read shared banks" ON public.banks;
CREATE POLICY "Anyone can read shared banks"
  ON public.banks FOR SELECT
  USING (is_shared = true);

-- 3c. Copy a shared bank to user's collection
CREATE OR REPLACE FUNCTION public.copy_shared_bank(p_bank_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_user_id    uuid;
  v_new_bank_id uuid;
  v_src        RECORD;
  v_q          RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '请先登录';
  END IF;

  SELECT * INTO v_src FROM public.banks WHERE id = p_bank_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '题库不存在';
  END IF;
  IF v_src.is_shared = false AND v_src.user_id != v_user_id THEN
    RAISE EXCEPTION '题库未公开分享';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.banks
    WHERE user_id = v_user_id AND source_bank_id = p_bank_id
  ) THEN
    RAISE EXCEPTION '该题库已被导入过';
  END IF;

  v_new_bank_id := gen_random_uuid();
  INSERT INTO public.banks (id, user_id, title, description, is_shared, source_bank_id, source_user_name)
  VALUES (
    v_new_bank_id, v_user_id,
    v_src.title || ' (来自' || coalesce(v_src.source_user_name, (SELECT name FROM public.profiles WHERE id = v_src.user_id)) || ')',
    v_src.description, false, p_bank_id,
    coalesce(v_src.source_user_name, (SELECT name FROM public.profiles WHERE id = v_src.user_id))
  );

  FOR v_q IN SELECT * FROM public.questions WHERE bank_id = p_bank_id LOOP
    INSERT INTO public.questions (bank_id, type, content, options, answer, explanation, difficulty, tags)
    VALUES (v_new_bank_id, v_q.type, v_q.content, v_q.options, v_q.answer, v_q.explanation, v_q.difficulty, v_q.tags);
  END LOOP;

  RETURN v_new_bank_id;
END;
$$;
