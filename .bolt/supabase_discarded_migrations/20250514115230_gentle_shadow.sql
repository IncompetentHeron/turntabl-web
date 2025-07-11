/*
  # Update Albums RLS Policies

  1. Changes
    - Add policy to allow inserting new albums
    - Add policy to allow updating existing albums
  
  2. Security
    - Maintains public read access
    - Allows authenticated users to insert and update albums
    - Prevents deletion of albums
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Albums are viewable by everyone" ON albums;

-- Create new policies
CREATE POLICY "Albums are viewable by everyone"
  ON albums FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert albums"
  ON albums FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update albums"
  ON albums FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);