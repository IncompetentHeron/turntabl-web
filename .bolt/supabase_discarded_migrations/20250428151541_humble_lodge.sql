/*
  # Fix Review Comments Relationship

  1. Changes
    - Add foreign key constraint from review_comments.user_id to profiles.id
    - Add index on review_comments.user_id for better performance
    - Update existing data for consistency

  2. Security
    - No changes to RLS policies needed
*/

-- Drop existing constraint if it exists
ALTER TABLE review_comments
DROP CONSTRAINT IF EXISTS review_comments_user_id_fkey;

-- Add the foreign key constraint
ALTER TABLE review_comments
ADD CONSTRAINT review_comments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id)
ON DELETE CASCADE;

-- Create index for better join performance
CREATE INDEX IF NOT EXISTS review_comments_user_id_idx ON review_comments(user_id);

-- Ensure data consistency
DELETE FROM review_comments
WHERE user_id NOT IN (SELECT id FROM profiles);