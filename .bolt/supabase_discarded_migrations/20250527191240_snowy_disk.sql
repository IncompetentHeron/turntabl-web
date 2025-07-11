/*
  # Add Artist Statistics and Lists

  1. New Tables
    - artist_lists: Lists created by artists
    - artist_stats: Materialized view for caching artist statistics

  2. Functions
    - refresh_artist_stats(): Updates the materialized view
    - update_artist_stats_trigger(): Triggers stats refresh on relevant changes

  3. Security
    - RLS policies for artist lists
    - Permissions for stats view
*/

-- Create artist_lists table
CREATE TABLE IF NOT EXISTS artist_lists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id text REFERENCES albums(artist_id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE artist_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artist lists are viewable by everyone"
  ON artist_lists FOR SELECT
  USING (true);

-- Create materialized view for artist statistics
CREATE MATERIALIZED VIEW artist_stats AS
SELECT 
  albums.artist_id,
  albums.artist,
  COUNT(DISTINCT albums.id) as album_count,
  COUNT(DISTINCT reviews.id) as review_count,
  COALESCE(AVG(reviews.rating), 0) as average_rating,
  COUNT(DISTINCT list_items.list_id) as list_inclusion_count
FROM albums
LEFT JOIN reviews ON reviews.album_id = albums.id
LEFT JOIN list_items ON list_items.album_id = albums.id
GROUP BY albums.artist_id, albums.artist;

CREATE UNIQUE INDEX artist_stats_artist_id_idx ON artist_stats (artist_id);

-- Create function to refresh artist stats
CREATE OR REPLACE FUNCTION refresh_artist_stats()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY artist_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh stats
CREATE TRIGGER refresh_artist_stats_on_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_artist_stats();

CREATE TRIGGER refresh_artist_stats_on_list_item
  AFTER INSERT OR UPDATE OR DELETE ON list_items
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_artist_stats();

-- Grant necessary permissions
GRANT SELECT ON artist_stats TO authenticated, anon;