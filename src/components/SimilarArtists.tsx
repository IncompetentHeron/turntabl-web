import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSimilarArtists, generateSlug } from '../lib/spotify';

interface SimilarArtistsProps {
  artistId: string;
}

export default function SimilarArtists({ artistId }: SimilarArtistsProps) {
  const { data: similarArtists = [], isLoading } = useQuery({
    queryKey: ['similarArtists', artistId],
    queryFn: () => getSimilarArtists(artistId),
    enabled: !!artistId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Similar Artists</h3>
        <div className="text-center py-4">
          <p className="text-secondary text-sm">Loading similar artists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Similar Artists</h3>
      {similarArtists.length > 0 ? (
        <div className="space-y-3">
          {similarArtists.map((artist) => (
            <Link
              key={artist.id}
              to={`/artist/${generateSlug(artist.name, artist.id)}`}
              className="flex items-center gap-3 p-3 bg-surface/50 hover:bg-surface transition-colors rounded-lg"
            >
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate hover:text-accent transition-colors">
                  {artist.name}
                </h4>
                {artist.genres.length > 0 && (
                  <p className="text-sm text-secondary truncate">
                    {artist.genres[0]}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-secondary text-sm">No similar artists found</p>
        </div>
      )}
    </div>
  );
}