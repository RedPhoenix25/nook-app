-- ================================================================
-- Migration: 0005_storage_bucket.sql
-- Purpose: Create storage bucket for space_media and RLS
-- ================================================================

-- Create a public bucket so we can easily display images using their public URLs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('space_media', 'space_media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'space_media');

-- Allow users to update their own files
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'space_media' AND auth.uid() = owner);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'space_media' AND auth.uid() = owner);

-- Allow everyone to read from the public bucket
CREATE POLICY "Public read access for space media"
ON storage.objects FOR SELECT
USING (bucket_id = 'space_media');
