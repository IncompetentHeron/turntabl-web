/*
  # Update release_date column type

  1. Changes
    - Change release_date column type from date to text
    - Preserve existing data by converting to text format
    - Update column constraints

  2. Security
    - Maintains existing RLS policies
*/

-- First create a temporary column to store the text values
ALTER TABLE albums 
ADD COLUMN release_date_text text;

-- Copy existing dates to text format
UPDATE albums 
SET release_date_text = release_date::text;

-- Drop the old column
ALTER TABLE albums 
DROP COLUMN release_date;

-- Rename the new column to release_date
ALTER TABLE albums 
RENAME COLUMN release_date_text TO release_date;

-- Make release_date NOT NULL since it's required
ALTER TABLE albums 
ALTER COLUMN release_date SET NOT NULL;