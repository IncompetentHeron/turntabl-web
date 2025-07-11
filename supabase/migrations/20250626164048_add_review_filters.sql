-- supabase/migrations/20250626164048_add_review_filters.sql

-- This migration adds a new RPC function `get_filtered_reviews`
-- to allow comprehensive filtering and sorting of reviews,
-- including by album, artist, user, followed users, and new
-- release year and decade filters.

-- Drop the old RPC function if it exists to replace it with the new one
DROP FUNCTION IF EXISTS public.get_filtered_reviews(
    p_sort_by TEXT,
    p_page INT,
    p_limit INT,
    p_album_id TEXT,
    p_artist_id TEXT,
    p_user_id UUID,
    p_followed_by_user_id UUID
);

-- Create the new RPC function `get_filtered_reviews`
CREATE OR REPLACE FUNCTION public.get_filtered_reviews(
    p_sort_by TEXT DEFAULT 'newest',
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 20,
    p_album_id TEXT DEFAULT NULL,
    p_artist_id TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_followed_by_user_id UUID DEFAULT NULL,
    p_release_year INT DEFAULT NULL,
    p_release_decade INT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    album_id TEXT,
    content TEXT,
    rating INT,
    listened_at TIMESTAMPTZ,
    visibility TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_relisten BOOLEAN,
    like_count BIGINT,
    is_liked BOOLEAN,
    profile JSONB,
    album JSONB,
    review_comments JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _offset INT := (p_page - 1) * p_limit;
    _order_by_clause TEXT := '';
    _where_clause TEXT := 'TRUE';
    _current_user_id UUID := auth.uid();
BEGIN
    -- Construct WHERE clause based on filters
    IF p_album_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND r.album_id = ' || quote_literal(p_album_id);
    END IF;

    IF p_artist_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND a.artist_id = ' || quote_literal(p_artist_id);
    END IF;

    IF p_user_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND r.user_id = ' || quote_literal(p_user_id);
    END IF;

    IF p_followed_by_user_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = ' || quote_literal(p_followed_by_user_id) || ')';
    END IF;

    IF p_release_year IS NOT NULL THEN
        _where_clause := _where_clause || ' AND LEFT(a.release_date, 4)::INTEGER = ' || p_release_year;
    END IF;

    IF p_release_decade IS NOT NULL THEN
        _where_clause := _where_clause || ' AND FLOOR(LEFT(a.release_date, 4)::INTEGER / 10) * 10 = ' || p_release_decade;
    END IF;

    -- Construct ORDER BY clause based on sort_by
    CASE p_sort_by
        WHEN 'newest' THEN
            _order_by_clause := 'r.created_at DESC';
        WHEN 'oldest' THEN
            _order_by_clause := 'r.created_at ASC';
        WHEN 'popular' THEN
            _order_by_clause := 'COALESCE(rl.like_count, 0) DESC, r.created_at DESC';
        WHEN 'top_rated' THEN
            _order_by_clause := 'r.rating DESC, COALESCE(rl.like_count, 0) DESC, r.created_at DESC';
        WHEN 'lowest_rated' THEN
            _order_by_clause := 'r.rating ASC, COALESCE(rl.like_count, 0) ASC, r.created_at DESC';
        ELSE
            _order_by_clause := 'r.created_at DESC'; -- Default sort
    END CASE;

    RETURN QUERY EXECUTE format('
        SELECT
            r.id,
            r.user_id,
            r.album_id,
            r.content,
            r.rating,
            r.listened_at,
            r.visibility,
            r.created_at,
            r.updated_at,
            r.is_relisten,
            COALESCE(rl.like_count, 0) AS like_count,
            (EXISTS (SELECT 1 FROM public.review_likes WHERE review_id = r.id AND user_id = %L)) AS is_liked,
            jsonb_build_object(
                ''id'', p.id,
                ''username'', p.username,
                ''display_name'', p.display_name,
                ''avatar_url'', p.avatar_url,
                ''is_followed_by_user'', (EXISTS (SELECT 1 FROM public.follows WHERE follower_id = %L AND following_id = p.id))
            ) AS profile,
            jsonb_build_object(
                ''id'', a.id,
                ''name'', a.name,
                ''artist'', a.artist,
                ''artist_id'', a.artist_id,
                ''cover_url'', a.cover_url,
                ''release_date'', a.release_date,
                ''album_type'', a.album_type,
                ''spotify_url'', a.spotify_url
            ) AS album,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''id'', rc.id,
                        ''user_id'', rc.user_id,
                        ''review_id'', rc.review_id,
                        ''parent_id'', rc.parent_id,
                        ''content'', rc.content,
                        ''created_at'', rc.created_at,
                        ''updated_at'', rc.updated_at,
                        ''like_count'', COALESCE(cl.like_count, 0),
                        ''is_liked'', (EXISTS (SELECT 1 FROM public.comment_likes WHERE comment_id = rc.id AND user_id = %L)),
                        ''profile'', jsonb_build_object(
                            ''id'', rcp.id,
                            ''username'', rcp.username,
                            ''display_name'', rcp.display_name,
                            ''avatar_url'', rcp.avatar_url
                        )
                    ) ORDER BY rc.created_at ASC
                )
                FROM public.review_comments rc
                LEFT JOIN public.profiles rcp ON rc.user_id = rcp.id
                LEFT JOIN (SELECT comment_id, COUNT(*) as like_count FROM public.comment_likes GROUP BY comment_id) cl ON rc.id = cl.comment_id
                WHERE rc.review_id = r.id
            ) AS review_comments
        FROM
            public.reviews r
        JOIN
            public.profiles p ON r.user_id = p.id
        JOIN
            public.albums a ON r.album_id = a.id
        LEFT JOIN
            (SELECT review_id, COUNT(*) as like_count FROM public.review_likes GROUP BY review_id) rl ON r.id = rl.review_id
        WHERE
            %s
        ORDER BY
            %s
        LIMIT %L OFFSET %L
    ', _current_user_id, _current_user_id, _current_user_id, _where_clause, _order_by_clause, p_limit, _offset);
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_filtered_reviews(TEXT, INT, INT, TEXT, TEXT, UUID, UUID, INT, INT) TO anon, authenticated;

