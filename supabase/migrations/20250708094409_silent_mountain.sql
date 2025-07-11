-- supabase/migrations/YYYYMMDDHHmmss_add_album_filters.sql

-- This migration adds a new RPC function `get_filtered_albums`
-- to allow comprehensive filtering and sorting of albums,
-- including by artist, release year/decade, new releases, album type,
-- and uses Spotify's popularity metric for sorting.

-- Drop the old RPC function if it exists to replace it with the new one
DROP FUNCTION IF EXISTS public.get_filtered_albums(
    p_sort_by TEXT,
    p_page INT,
    p_limit INT,
    p_artist_id TEXT,
    p_release_year INT,
    p_release_decade INT,
    p_is_new_release BOOLEAN
);

-- Create the new RPC function `get_filtered_albums`
CREATE OR REPLACE FUNCTION public.get_filtered_albums(
    p_sort_by TEXT DEFAULT 'newest',
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 20,
    p_artist_id TEXT DEFAULT NULL,
    p_release_year INT DEFAULT NULL,
    p_release_decade INT DEFAULT NULL,
    p_is_new_release BOOLEAN DEFAULT FALSE,
    p_album_type TEXT DEFAULT NULL
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
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    review_count BIGINT,
    average_rating NUMERIC,
    weighted_average_rating NUMERIC,
    spotify_popularity INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _offset INT := (p_page - 1) * p_limit;
    _order_by_clause TEXT := '';
    _where_clause TEXT := 'TRUE';
    -- Parameters for Bayesian average (C = confidence factor, M = global average rating)
    -- C: Minimum number of reviews required for an album's rating to be considered stable.
    -- M: Global average rating across all reviews in the system.
    _C NUMERIC := 25; -- Can be adjusted based on desired confidence
    _M NUMERIC;
BEGIN
    -- Calculate global average rating (M)
    SELECT AVG(rating) INTO _M FROM public.reviews;

    -- Handle cases where there are no reviews yet to avoid division by zero or null M
    IF _M IS NULL THEN
        _M := 50; -- Default to 50 if no reviews exist yet
    END IF;

    -- Construct WHERE clause based on filters
    IF p_artist_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND a.artist_id = ' || quote_literal(p_artist_id);
    END IF;

    IF p_release_year IS NOT NULL THEN
        _where_clause := _where_clause || ' AND LEFT(a.release_date, 4)::INTEGER = ' || p_release_year;
    END IF;

    IF p_release_decade IS NOT NULL THEN
        _where_clause := _where_clause || ' AND FLOOR(LEFT(a.release_date, 4)::INTEGER / 10) * 10 = ' || p_release_decade;
    END IF;

    IF p_album_type IS NOT NULL THEN
        _where_clause := _where_clause || ' AND a.album_type = ' || quote_literal(p_album_type);
    END IF;

    IF p_is_new_release THEN
        -- Assuming 'new release' means albums added to our system recently (e.g., last 30 days)
        -- Or, if Spotify's release_date is reliable and recent, you could use that.
        -- For this example, we'll use the album's created_at in our DB.
        _where_clause := _where_clause || ' AND a.created_at >= NOW() - INTERVAL ''30 days''';
    END IF;

    -- Construct ORDER BY clause based on sort_by
    CASE p_sort_by
        WHEN 'newest' THEN
            _order_by_clause := 'a.created_at DESC';
        WHEN 'popular_all_time' THEN
            -- Use Spotify popularity as primary sort, then review count as secondary
            _order_by_clause := 'COALESCE(a.popularity, 0) DESC, COALESCE(review_stats.review_count, 0) DESC, a.created_at DESC';
        WHEN 'popular_this_week' THEN
            -- For now, use Spotify popularity. Later this could be enhanced with recent review activity
            _order_by_clause := 'COALESCE(a.popularity, 0) DESC, COALESCE(review_stats.review_count, 0) DESC, a.created_at DESC';
        WHEN 'top_rated' THEN
            _order_by_clause := 'weighted_avg_rating DESC, COALESCE(review_stats.review_count, 0) DESC, a.created_at DESC';
        WHEN 'lowest_rated' THEN
            _order_by_clause := 'weighted_avg_rating ASC, COALESCE(review_stats.review_count, 0) DESC, a.created_at DESC';
        ELSE
            _order_by_clause := 'a.created_at DESC'; -- Default sort
    END CASE;

    RETURN QUERY EXECUTE format('
        SELECT
            a.id,
            a.name,
            a.artist,
            a.artist_id,
            a.cover_url,
            a.release_date,
            a.album_type,
            a.spotify_url,
            a.created_at,
            a.updated_at,
            COALESCE(review_stats.review_count, 0) AS review_count,
            COALESCE(review_stats.average_rating, 0) AS average_rating,
            -- Bayesian average calculation: (C * M + sum_ratings) / (C + num_reviews)
            -- C = _C (confidence factor), M = _M (global average rating)
            -- sum_ratings = review_stats.sum_ratings, num_reviews = review_stats.review_count
            (
                (%s * %s) + COALESCE(review_stats.sum_ratings, 0)
            ) / (
                %s + COALESCE(review_stats.review_count, 0)
            ) AS weighted_average_rating,
            COALESCE(a.popularity, 0) AS spotify_popularity
        FROM
            public.albums a
        LEFT JOIN LATERAL (
            SELECT
                r.album_id,
                COUNT(r.id) AS review_count,
                AVG(r.rating) AS average_rating,
                SUM(r.rating) AS sum_ratings
            FROM
                public.reviews r
            WHERE
                r.album_id = a.id
            GROUP BY
                r.album_id
        ) AS review_stats ON TRUE
        WHERE
            %s
        ORDER BY
            %s
        LIMIT %L OFFSET %L
    ', _C, _M, _C, _where_clause, _order_by_clause, p_limit, _offset);
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_filtered_albums(TEXT, INT, INT, TEXT, INT, INT, BOOLEAN, TEXT) TO anon, authenticated;