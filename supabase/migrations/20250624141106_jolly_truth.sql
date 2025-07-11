/*
  # Add List Likes System

  1. New Tables
    - `list_likes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `list_id` (uuid, foreign key to lists)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `list_likes` table
    - Add policies for users to manage their own likes
    - Add policy for public viewing of likes
*/

CREATE TABLE IF NOT EXISTS list_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, list_id)
);

ALTER TABLE list_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "List likes are viewable by everyone"
  ON list_likes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can toggle own list likes"
  ON list_likes
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS list_likes_list_id_idx ON list_likes(list_id);
CREATE INDEX IF NOT EXISTS list_likes_user_id_list_id_idx ON list_likes(user_id, list_id);