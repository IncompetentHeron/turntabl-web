import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFilteredAlbums } from '../lib/supabase';
import { generateSlug } from '../lib/spotify';
import { useUser } from '../hooks/useUser';

export default function CommunityPopularAlbums() {
  const { user } = useUser();
  
  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['communityAlbums', user?.id],
    queryFn: () => getFilteredAlbums({
      sortBy: 'popular_this_week',
      limit: 10,
    }),
    enabled: !!user,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  if (isLoading) {
    return (
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Albums Reviewed by Your Community</h2>
        <div className="text-center py-8">
          <p className="text-secondary">Loading community albums...</p>
        </div>
      </section>
    );
  }

  if (albums.length === 0) {
    return (
      <section className="bg-surface rounded-lg p-8 text-center mb-12">
        <h2 className="text-2xl font-bold mb-4">No Community Albums Yet</h2>
        <p className="text-lg text-secondary mb-6">
          Follow more users to see what albums they're reviewing
        </p>
        <Link to="/search/users" className="btn btn-primary">
          Find Users to Follow
        </Link>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Albums Reviewed by Your Community</h2>
        <Link 
          to="/albums?sortBy=popular_this_week"
          className="text-accent hover:text-accent/80 transition-colors"
        >
          See all
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {albums.map((album) => (
          <Link
            key={album.id}
            to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
            className="group"
          >
            <div className="aspect-square mb-3">
              <img
                src={album.coverUrl}
                alt={album.name}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <h3 className="font-medium group-hover:text-accent transition-colors line-clamp-1">
              {album.name}
            </h3>
            <p className="text-secondary text-sm line-clamp-1">{album.artist}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}