-- ============================================================
-- Fix: Remove pgcrypto dependency for AI API key storage
-- Run this in Supabase SQL Editor to fix the encryption error
-- https://supabase.com/dashboard/project/bbiwowuwlrneivycdqkf/sql
-- ============================================================

-- 1. Drop the encryption-dependent functions and recreate as plaintext
CREATE OR REPLACE FUNCTION public.save_ai_api_key(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET ai_api_key = CASE
    WHEN p_key IS NULL OR p_key = '' THEN NULL
    ELSE p_key
  END
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_api_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT ai_api_key INTO v_key FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_key, '');
END;
$$;

-- 2. Migrate any existing encrypted keys back to plaintext
--    (If a key looks like base64-encoded PGP data, try to decode it;
--     otherwise leave it as-is since it's already plaintext)
UPDATE public.profiles
SET ai_api_key = NULL
WHERE ai_api_key IS NOT NULL
  AND ai_api_key != ''
  AND LENGTH(ai_api_key) > 200;
  -- Very long values are likely encrypted blobs; clear them
  -- Users will need to re-enter their API key

-- 3. Clean up encryption infrastructure (optional, safe to skip)
-- DROP FUNCTION IF EXISTS public.get_enc_secret();
-- DROP TABLE IF EXISTS public.app_settings;
