-- Ensure we have an artists table (create if it doesn't exist)
CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  spotify_url TEXT,
  genres TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on artists table
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for artists table
CREATE POLICY "Anyone can view artists"
  ON artists
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only authenticated users can insert artists"
  ON artists
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only authenticated users can update artists"
  ON artists
  FOR UPDATE
  TO authenticated
  USING (true);

-- First, add the artist_id column to list_items
ALTER TABLE list_items
ADD COLUMN IF NOT EXISTS artist_id TEXT;

-- Now add the foreign key constraint to the existing artist_id column
ALTER TABLE list_items
ADD CONSTRAINT fk_artist_id
FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;

-- Make album_id nullable since items can now be either albums or artists
ALTER TABLE list_items
ALTER COLUMN album_id DROP NOT NULL;

-- Add a check constraint to ensure each list item has either an album_id OR an artist_id, but not both
ALTER TABLE list_items
ADD CONSTRAINT list_items_content_check
CHECK (
  (album_id IS NOT NULL AND artist_id IS NULL) OR
  (album_id IS NULL AND artist_id IS NOT NULL)
);

-- Create index for artist_id for better query performance
CREATE INDEX IF NOT EXISTS list_items_artist_id_idx ON list_items(artist_id);

-- Drop the artist_lists table if it exists (functionality moved to unified lists)
DROP TABLE IF EXISTS artist_lists CASCADE;

-- Update RLS policies for list_items to handle the new structure
DROP POLICY IF EXISTS "Users can view public lists" ON list_items;
DROP POLICY IF EXISTS "Users can manage their own list items" ON list_items;

-- Recreate RLS policies
CREATE POLICY "Users can view list items of public lists"
  ON list_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
    )
  );

CREATE POLICY "Users can manage their own list items"
  ON list_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );
