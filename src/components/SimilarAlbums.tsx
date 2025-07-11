// src/components/SimilarAlbums.tsx
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAlbumRecommendations, generateSlug } from '../lib/spotify'; // We'll need to add getAlbumRecommendations to spotify.ts

interface SimilarAlbumsProps {
  albumId: string;
}

export default function SimilarAlbums({ albumId }: SimilarAlbumsProps) {
  const { data: similarAlbums = [], isLoading } = useQuery({
    queryKey: ['similarAlbums', albumId],
    queryFn: () => getAlbumRecommendations(albumId),
    enabled: !!albumId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Similar Albums</h3>
        <div className="text-center py-4">
          <p className="text-secondary text-sm">Loading similar albums...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Similar Albums</h3>
      {similarAlbums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {similarAlbums.map((album) => (
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
              <h4 className="font-medium group-hover:text-accent transition-colors line-clamp-1">
                {album.name}
              </h4>
              <p className="text-secondary text-sm line-clamp-1">{album.artist}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-secondary text-sm">No similar albums found</p>
        </div>
      )}
    </div>
  );
}
