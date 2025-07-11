/*
  # Update Popular Albums Logic

  1. New Functions
    - Creates a function to get popular albums based on unique reviewers in the last N days
    - Includes review count and other album metadata in results

  2. Changes
    - Adds a new RPC function for fetching popular albums
    - Optimizes query performance with proper indexing
*/

-- Create index for faster review counting
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON public.reviews (created_at);

-- Create function to get popular albums by review count
CREATE OR REPLACE FUNCTION public.get_popular_albums_by_reviews(
    days_ago INT DEFAULT 7,
    _limit INT DEFAULT 10
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    artist TEXT,
    artist_id TEXT,
    cover_url TEXT,
    release_date TEXT,
    album_type TEXT,
    spotify_url TEXT,
    unique_reviewer_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.artist,
        a.artist_id,
        a.cover_url,
        a.release_date,
        a.album_type,
        a.spotify_url,
        COUNT(DISTINCT r.user_id) AS unique_reviewer_count
    FROM
        public.albums a
    JOIN
        public.reviews r ON a.id = r.album_id
    WHERE
        r.created_at >= NOW() - INTERVAL '1 day' * days_ago
    GROUP BY
        a.id, a.name, a.artist, a.artist_id, a.cover_url, a.release_date, a.album_type, a.spotify_url
    ORDER BY
        unique_reviewer_count DESC, a.created_at DESC
    LIMIT _limit;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.get_popular_albums_by_reviews TO anon, authenticated;