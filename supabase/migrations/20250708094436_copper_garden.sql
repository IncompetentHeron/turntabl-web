/*
  # Add Spotify Popularity Column to Albums

  1. Changes
    - Add `popularity` column to albums table to store Spotify's popularity metric
    - Update existing albums to have a default popularity of 0

  2. Security
    - No RLS changes needed as albums table already has proper policies
*/

-- Add popularity column to albums table
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS popularity INTEGER DEFAULT 0;

-- Create index for better performance when sorting by popularity
CREATE INDEX IF NOT EXISTS albums_popularity_idx ON public.albums (popularity DESC);

-- Update existing albums to have popularity 0 if null
UPDATE public.albums SET popularity = 0 WHERE popularity IS NULL;