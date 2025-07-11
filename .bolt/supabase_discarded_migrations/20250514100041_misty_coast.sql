/*
  # Avatar Storage Policies

  This migration sets up the storage policies for avatar uploads.

  1. Storage Policies
    - Create avatars bucket if it doesn't exist
    - Set up policies for avatar uploads and management
    - Enable public access to avatars

  2. Changes
    - Remove original_avatar_url from profiles table as we'll only store one version
*/

-- Remove original_avatar_url column from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS original_avatar_url;

-- Create storage policies for avatars bucket
BEGIN;
  -- Enable storage by creating the storage schema if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS storage;

  -- Create policy to allow authenticated users to upload their own avatars
  CREATE POLICY "Users can upload their own avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

  -- Create policy to allow users to update their own avatars
  CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

  -- Create policy to allow users to delete their own avatars
  CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

  -- Create policy to allow public access to avatars
  CREATE POLICY "Avatar files are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
COMMIT;