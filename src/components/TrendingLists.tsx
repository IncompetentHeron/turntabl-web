import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import ListCard from './ListCard';

export default function TrendingLists() {
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['trendingLists'],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;

        const { data, error } = await supabase
          .from('lists')
          .select(`
            *,
            profile:profiles!lists_user_id_fkey (*),
            list_items (
              id,
              album_id,
              artist_id,
              rank,
              note,
              album:albums (*),
              artist:artists (*)
            ),
            list_likes (
              id,
              user_id
            )
          `)
          .neq('title', 'Liked Albums')
          .order('created_at', { ascending: false })
          .limit(3);

        if (error) throw error;
        
        return data.map(list => ({
          ...list,
          like_count: list.list_likes?.length || 0,
          is_liked: currentUserId ? list.list_likes?.some(like => like.user_id === currentUserId) : false,
          list_items: list.list_items
            ?.map(item => ({
              ...item,
              album: item.album ? {
                ...item.album,
                coverUrl: item.album.cover_url
              } : null,
              artist: item.artist ? {
                ...item.artist,
                imageUrl: item.artist.image_url,
                spotifyUrl: item.artist.spotify_url
              } : null
            }))
            .sort((a, b) => (a.rank || 0) - (b.rank || 0))
        }));
      } catch (error) {
        console.error('Error fetching trending lists:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-secondary">Loading trending lists...</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Trending Lists</h2>
        <Link
          to="/lists"
          className="text-accent hover:text-accent/80 transition-colors"
        >
          See all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </div>
    </section>
  );
}