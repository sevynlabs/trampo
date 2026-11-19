-- Cidade/UF base do profissional (preenchidas pelo app a partir do GPS da
-- tela "Área de atuação"; mostradas e pesquisáveis no painel).
-- Aplicado via `prisma db push`; este arquivo documenta a mudança.
ALTER TABLE "tasker_profiles" ADD COLUMN IF NOT EXISTS "city" TEXT, ADD COLUMN IF NOT EXISTS "state" TEXT;
