/*
  # Add Filtered Lists Function

  1. New Functions
    - Creates a function to get filtered lists based on various criteria
    - Supports filtering by title, description, user, followed users, albums, and artists
    - Includes sorting by newest, oldest, and popularity

  2. Changes
    - Adds a new RPC function for fetching filtered lists
    - Optimizes query performance with proper joins and indexing
*/

-- Create function to get filtered lists
CREATE OR REPLACE FUNCTION public.get_filtered_lists(
    p_sort_by TEXT DEFAULT 'newest',
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 20,
    p_title_query TEXT DEFAULT NULL,
    p_description_query TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_followed_by_user_id UUID DEFAULT NULL,
    p_album_id TEXT DEFAULT NULL,
    p_artist_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    title TEXT,
    description TEXT,
    is_ranked BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    like_count BIGINT,
    is_liked BOOLEAN,
    profile JSONB,
    list_items JSONB
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
    IF p_title_query IS NOT NULL THEN
        _where_clause := _where_clause || ' AND l.title ILIKE ' || quote_literal('%' || p_title_query || '%');
    END IF;

    IF p_description_query IS NOT NULL THEN
        _where_clause := _where_clause || ' AND l.description ILIKE ' || quote_literal('%' || p_description_query || '%');
    END IF;

    IF p_user_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND l.user_id = ' || quote_literal(p_user_id);
    END IF;

    IF p_followed_by_user_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND l.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = ' || quote_literal(p_followed_by_user_id) || ')';
    END IF;

    IF p_album_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND EXISTS (SELECT 1 FROM public.list_items li WHERE li.list_id = l.id AND li.album_id = ' || quote_literal(p_album_id) || ')';
    END IF;

    IF p_artist_id IS NOT NULL THEN
        _where_clause := _where_clause || ' AND EXISTS (SELECT 1 FROM public.list_items li WHERE li.list_id = l.id AND li.artist_id = ' || quote_literal(p_artist_id) || ')';
    END IF;

    -- Construct ORDER BY clause based on sort_by
    CASE p_sort_by
        WHEN 'newest' THEN
            _order_by_clause := 'l.created_at DESC';
        WHEN 'oldest' THEN
            _order_by_clause := 'l.created_at ASC';
        WHEN 'popular' THEN
            _order_by_clause := 'COALESCE(ll.like_count, 0) DESC, l.created_at DESC';
        ELSE
            _order_by_clause := 'l.created_at DESC'; -- Default sort
    END CASE;

    RETURN QUERY EXECUTE format('
        SELECT
            l.id,
            l.user_id,
            l.title,
            l.description,
            l.is_ranked,
            l.created_at,
            l.updated_at,
            COALESCE(ll.like_count, 0) AS like_count,
            (EXISTS (SELECT 1 FROM public.list_likes WHERE list_id = l.id AND user_id = %L)) AS is_liked,
            jsonb_build_object(
                ''id'', p.id,
                ''username'', p.username,
                ''display_name'', p.display_name,
                ''avatar_url'', p.avatar_url
            ) AS profile,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''id'', li.id,
                        ''list_id'', li.list_id,
                        ''album_id'', li.album_id,
                        ''artist_id'', li.artist_id,
                        ''rank'', li.rank,
                        ''note'', li.note,
                        ''created_at'', li.created_at,
                        ''updated_at'', li.updated_at,
                        ''album'', CASE 
                            WHEN li.album_id IS NOT NULL THEN
                                jsonb_build_object(
                                    ''id'', a.id,
                                    ''name'', a.name,
                                    ''artist'', a.artist,
                                    ''artist_id'', a.artist_id,
                                    ''cover_url'', a.cover_url,
                                    ''release_date'', a.release_date,
                                    ''album_type'', a.album_type,
                                    ''spotify_url'', a.spotify_url
                                )
                            ELSE NULL
                        END,
                        ''artist'', CASE 
                            WHEN li.artist_id IS NOT NULL THEN
                                jsonb_build_object(
                                    ''id'', ar.id,
                                    ''name'', ar.name,
                                    ''image_url'', ar.image_url,
                                    ''spotify_url'', ar.spotify_url,
                                    ''genres'', ar.genres
                                )
                            ELSE NULL
                        END
                    ) ORDER BY li.rank ASC NULLS LAST, li.created_at ASC
                )
                FROM public.list_items li
                LEFT JOIN public.albums a ON li.album_id = a.id
                LEFT JOIN public.artists ar ON li.artist_id = ar.id
                WHERE li.list_id = l.id
            ) AS list_items
        FROM
            public.lists l
        JOIN
            public.profiles p ON l.user_id = p.id
        LEFT JOIN
            (SELECT list_id, COUNT(*) as like_count FROM public.list_likes GROUP BY list_id) ll ON l.id = ll.list_id
        WHERE
            %s
        ORDER BY
            %s
        LIMIT %L OFFSET %L
    ', _current_user_id, _where_clause, _order_by_clause, p_limit, _offset);
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_filtered_lists(TEXT, INT, INT, TEXT, TEXT, UUID, UUID, TEXT, TEXT) TO anon, authenticated;