-- Verificação em duas camadas:
--   1. identity_verifications: documento + selfie, para TODOS os usuários.
--      Enviado (SUBMITTED) já libera publicar e contratar.
--   2. tasker_profiles.kyc_status passa a ser a análise da conta profissional
--      (certidão de antecedentes criminais). Feed e aceite exigem 1 e 2 APPROVED.
-- A tabela é criada via `prisma db push`; este arquivo documenta e traz a
-- migração dos dados existentes (rodar depois do push).

-- Proteção igual às outras tabelas: só a API (service role) acessa.
ALTER TABLE "identity_verifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "identity_verifications" FROM anon, authenticated;

-- Os documentos de identidade que estavam no perfil profissional passam para
-- a tabela nova, com o mesmo status que já tinham.
INSERT INTO "identity_verifications"
  ("user_id", "document_front_path", "document_back_path", "selfie_path",
   "status", "submitted_at", "approved_at", "rejected_at", "reject_reason", "updated_at")
SELECT "user_id", "document_front_path", "document_back_path", "selfie_path",
       "kyc_status", "kyc_submitted_at", "kyc_approved_at", "kyc_rejected_at", "kyc_reject_reason", NOW()
FROM "tasker_profiles"
WHERE "document_front_path" IS NOT NULL OR "selfie_path" IS NOT NULL
ON CONFLICT ("user_id") DO NOTHING;

-- Decisão do produto: profissionais já aprovados (ou em análise) sem certidão
-- perdem o acesso ao feed até enviarem a certidão e serem aprovados de novo.
UPDATE "tasker_profiles"
SET "kyc_status" = 'PENDING', "kyc_approved_at" = NULL, "kyc_submitted_at" = NULL
WHERE "criminal_record_path" IS NULL AND "kyc_status" IN ('APPROVED', 'SUBMITTED');
