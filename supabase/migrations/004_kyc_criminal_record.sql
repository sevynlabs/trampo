-- Certidão de antecedentes criminais na verificação (KYC) do profissional.
-- Aplicado via `prisma db push`; este arquivo documenta a mudança.
ALTER TABLE "tasker_profiles" ADD COLUMN IF NOT EXISTS "criminal_record_path" TEXT;

-- O bucket privado "kyc-documents" passa a aceitar PDF (a certidão do gov.br
-- é emitida em PDF). A API faz esse ajuste sozinha no primeiro envio de PDF:
--   allowed_mime_types = {image/jpeg, image/png, application/pdf}
