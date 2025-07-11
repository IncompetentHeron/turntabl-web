/*
  # Add Privacy Settings to Profiles

  1. Changes
    - Add `is_private` column to profiles table
    - Update RLS policies for reviews, lists, and listens to respect privacy settings

  2. Security
    - Private profiles only show content to followers and the profile owner
    - Public profiles show content to everyone
*/

-- Add is_private column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Update reviews RLS policy to respect privacy
DROP POLICY IF EXISTS "Reviews are viewable by everyone when public" ON public.reviews;
CREATE POLICY "Reviews are viewable based on profile privacy"
  ON public.reviews
  FOR SELECT
  TO public
  USING (
    (auth.uid() = user_id) OR
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = reviews.user_id AND p.is_private = FALSE)) OR
    (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = reviews.user_id))
  );

-- Update lists RLS policy to respect privacy
DROP POLICY IF EXISTS "Lists are viewable by everyone" ON public.lists;
CREATE POLICY "Lists are viewable based on profile privacy"
  ON public.lists
  FOR SELECT
  TO public
  USING (
    (auth.uid() = user_id) OR
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lists.user_id AND p.is_private = FALSE)) OR
    (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = lists.user_id))
  );

-- Update listens RLS policy to respect privacy (only for profile owner)
DROP POLICY IF EXISTS "Listens are viewable by everyone" ON public.listens;
CREATE POLICY "Listens are viewable based on profile privacy"
  ON public.listens
  FOR SELECT
  TO public
  USING (
    (auth.uid() = user_id) OR
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = listens.user_id AND p.is_private = FALSE)) OR
    (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = listens.user_id))
  );

-- Update listen_later RLS policy to respect privacy (only for profile owner)
DROP POLICY IF EXISTS "Listen later items are viewable by everyone" ON public.listen_later;
CREATE POLICY "Listen later items are viewable based on profile privacy"
  ON public.listen_later
  FOR SELECT
  TO public
  USING (
    (auth.uid() = user_id) OR
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = listen_later.user_id AND p.is_private = FALSE)) OR
    (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = listen_later.user_id))
  );