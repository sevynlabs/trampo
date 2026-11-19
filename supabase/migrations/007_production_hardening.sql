-- 007 — Production hardening (Supabase advisors, 19/11/2026)
--
-- The app never reads tables with the public keys: everything goes through
-- the API (service role / direct connection). RLS + revoked grants (001/002)
-- are defense in depth. This migration clears the remaining advisor findings.
-- Idempotent: safe to run more than once.

-- 1) Supabase's auto-RLS event-trigger function was callable through the REST
--    API (/rest/v1/rpc/rls_auto_enable) by anon and signed-in roles.
--    Event triggers keep working without these grants.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 2) KYC bucket must accept the criminal-record certificate (PDF), not only
--    photos. The API used to patch this lazily on the first PDF upload.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf']
WHERE id = 'kyc-documents';

-- 3) RLS policies: evaluate auth.uid() once per query instead of once per row
--    (advisor 0003_auth_rls_initplan). Same rules, rewritten in place.
DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
  LOOP
    new_qual := CASE
      WHEN p.qual IS NULL OR p.qual LIKE '%SELECT auth.uid()%' THEN NULL
      ELSE replace(p.qual, 'auth.uid()', '(select auth.uid())')
    END;
    new_check := CASE
      WHEN p.with_check IS NULL OR p.with_check LIKE '%SELECT auth.uid()%' THEN NULL
      ELSE replace(p.with_check, 'auth.uid()', '(select auth.uid())')
    END;

    IF new_qual IS NULL AND new_check IS NULL THEN
      CONTINUE;
    END IF;

    stmt := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
