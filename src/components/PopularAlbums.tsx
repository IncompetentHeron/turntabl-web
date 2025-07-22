import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOurPopularAlbums } from '../lib/supabase';
import { generateSlug } from '../lib/spotify';

export default function PopularAlbums() {
  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['ourPopularAlbums'],
    queryFn: () => getOurPopularAlbums(10),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-secondary">Loading popular albums...</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold">Popular This Week</h2>
      </div>
      <div className="flex flex-row overflow-x-auto lg:grid grid-cols-5 gap-4">
        {albums.slice(0, 10).map((album) => (
          <Link
            key={album.id}
            to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
            className="group flex-shrink-0 w-24 md:w-32 lg:w-auto mb-3"
          >
            <div className="aspect-square mb-3">
              <img
                src={album.coverUrl}
                alt={album.name}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <h3 className="text-xs md:text-base lg:text-lg group-hover:text-accent transition-colors line-clamp-1">
              {album.name}
            </h3>
            <p className="text-secondary text-xs md:text-sm lg:text-base line-clamp-1">{album.artist}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}