-- Create kyc-documents bucket for KYC document uploads
-- Run this in Supabase Dashboard > SQL Editor

-- Create the bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,  -- Private bucket
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for kyc-documents bucket
-- Policy 1: Users can upload files to their own folder
CREATE POLICY "Users can upload own KYC documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can view their own documents
CREATE POLICY "Users can view own KYC documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can update/replace their own documents
CREATE POLICY "Users can update own KYC documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own documents
CREATE POLICY "Users can delete own KYC documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 5: Service role can access all documents (for admin review)
-- This is automatic since service_role bypasses RLS

-- Note: The backend uses SERVICE_ROLE_KEY to generate signed URLs,
-- which bypasses RLS and allows admin access to all documents.
