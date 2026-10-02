-- ============================================================================
-- 002: Close the PostgREST (anon key) surface
-- ============================================================================
-- The mobile app never reads tables through Supabase: all data goes through
-- the API (Prisma, service connection) and the app only uses Supabase
-- Realtime broadcast. The app also doesn't use Supabase Auth, so auth.uid()
-- is always NULL and the "own row" policies from 001 never match. The only
-- policies that do match are the permissive ones (e.g.
-- tasker_profiles_select_approved, reviews_select_public), which let anyone
-- holding the public anon key read Pix keys, KYC document paths and
-- locations via /rest/v1.
--
-- Revoking table privileges from the API roles removes that surface entirely
-- while keeping RLS enabled as defense in depth. The backend is unaffected:
-- it connects as the postgres/service role.
-- ============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Tables created later (e.g. by Prisma migrations) must not be exposed either
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Drop the policies that were readable by anon
DROP POLICY IF EXISTS "tasker_profiles_select_approved" ON tasker_profiles;
DROP POLICY IF EXISTS "reviews_select_public" ON reviews;
DROP POLICY IF EXISTS "tasks_select_open_for_taskers" ON tasks;
