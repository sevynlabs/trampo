-- ============================================================================
-- 003: Advertiser banners + public in-app code for users
-- ============================================================================
-- Applied with `prisma db push` (packages/db/prisma/schema.prisma is the source
-- of truth); kept here as the reviewable SQL record. Additive only.

-- Public handle shown on the shareable profile card ("TR-4F9A2C"). A volatile
-- default makes Postgres fill a distinct value for every existing row.
ALTER TABLE "users"
  ADD COLUMN "public_code" TEXT NOT NULL
  DEFAULT ('TR'::text || upper(substr(md5(((random())::text || (clock_timestamp())::text)), 1, 6)));
CREATE UNIQUE INDEX "users_public_code_key" ON "users"("public_code");

-- Banners for the carousel at the top of the app's home.
CREATE TABLE "ad_banners" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "advertiser" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "link_url" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_banners_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ad_banners_is_active_sort_order_idx" ON "ad_banners"("is_active", "sort_order");

-- Same posture as the other tables (see 001/002): RLS on, no anon access.
ALTER TABLE "ad_banners" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ad_banners" FROM anon, authenticated;
