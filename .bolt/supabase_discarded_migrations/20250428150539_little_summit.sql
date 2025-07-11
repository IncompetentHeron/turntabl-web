/*
  # Add Lists and User Mentions Support

  1. New Tables
    - `lists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `title` (text)
      - `description` (text)
      - `is_ranked` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `list_items`
      - `id` (uuid, primary key)
      - `list_id` (uuid, references lists)
      - `album_id` (text)
      - `rank` (integer)
      - `note` (text)
      - `created_at` (timestamp)

    - `user_mentions`
      - `id` (uuid, primary key)
      - `review_id` (uuid, references reviews)
      - `mentioned_user_id` (uuid, references profiles)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  is_ranked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read lists"
  ON lists
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create their own lists"
  ON lists
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
  ON lists
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
  ON lists
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- List items table
CREATE TABLE IF NOT EXISTS list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  album_id text NOT NULL,
  rank integer,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(list_id, album_id)
);

ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read list items"
  ON list_items
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can manage list items for their lists"
  ON list_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id
      AND lists.user_id = auth.uid()
    )
  );

-- User mentions table
CREATE TABLE IF NOT EXISTS user_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id, mentioned_user_id)
);

ALTER TABLE user_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user mentions"
  ON user_mentions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create mentions in their reviews"
  ON user_mentions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_id
      AND reviews.user_id = auth.uid()
    )
  );

-- Add indexes
CREATE INDEX IF NOT EXISTS lists_user_id_idx ON lists(user_id);
CREATE INDEX IF NOT EXISTS list_items_list_id_idx ON list_items(list_id);
CREATE INDEX IF NOT EXISTS list_items_album_id_idx ON list_items(album_id);
CREATE INDEX IF NOT EXISTS user_mentions_review_id_idx ON user_mentions(review_id);
CREATE INDEX IF NOT EXISTS user_mentions_mentioned_user_id_idx ON user_mentions(mentioned_user_id);

-- Add trigger to update lists.updated_at
CREATE OR REPLACE FUNCTION update_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_lists_updated_at();

-- Fix review_comments foreign key
ALTER TABLE review_comments
DROP CONSTRAINT IF EXISTS review_comments_user_id_fkey;

ALTER TABLE review_comments
ADD CONSTRAINT review_comments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id)
ON DELETE CASCADE;

-- Add index for review_comments user_id
CREATE INDEX IF NOT EXISTS review_comments_user_id_idx ON review_comments(user_id);