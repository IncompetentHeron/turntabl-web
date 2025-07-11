/*
  # Update Albums RLS Policies

  1. Changes
    - Remove policies that allow inserting and updating albums
    - Keep only the SELECT policy for public access
  
  2. Security
    - Maintains public read access
    - Prevents client-side modifications to albums table
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Albums are viewable by everyone" ON albums;
DROP POLICY IF EXISTS "Authenticated users can insert albums" ON albums;
DROP POLICY IF EXISTS "Authenticated users can update albums" ON albums;

-- Create new policy for read-only access
CREATE POLICY "Albums are viewable by everyone"
  ON albums FOR SELECT
  USING (true);