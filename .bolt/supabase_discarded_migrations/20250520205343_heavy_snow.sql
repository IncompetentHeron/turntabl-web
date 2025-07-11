/*
  # Fix Comment Relationships

  1. Changes
    - Add explicit self-referential foreign key for review comments
    - Update comment queries to properly handle nested replies
    
  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity with cascading deletes
*/

-- Drop existing foreign key if it exists
ALTER TABLE review_comments 
DROP CONSTRAINT IF EXISTS review_comments_parent_id_fkey;

-- Add the correct self-referential foreign key
ALTER TABLE review_comments
ADD CONSTRAINT review_comments_parent_id_fkey 
FOREIGN KEY (parent_id) 
REFERENCES review_comments(id) 
ON DELETE CASCADE;