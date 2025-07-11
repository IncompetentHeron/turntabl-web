import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchSpotify, generateSlug } from '../lib/spotify';

const ITEMS_PER_PAGE = 20;

export default function SearchAlbums() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [page, setPage] = useState(1);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['spotifySearch', query],
    queryFn: () => searchSpotify(query),
    enabled: !!query,
  });

  if (!query) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Search Albums</h1>
        <p className="text-secondary">Use the search bar above to find albums</p>
      </div>
    );
  }

  const albums = searchResults?.albums || [];
  const totalPages = Math.ceil(albums.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageAlbums = albums.slice(startIndex, endIndex);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Albums matching "{query}"</h1>
        <div className="flex gap-2">
          <Link to="/search" className="text-accent hover:text-accent/80">
            Back to all results
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-xl text-secondary">Searching...</div>
        </div>
      ) : currentPageAlbums.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {currentPageAlbums.map((album) => (
              <Link
                key={album.id}
                to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
                className="block bg-surface rounded-lg overflow-hidden hover:bg-white/5 transition-colors"
              >
                <img
                  src={album.coverUrl}
                  alt={album.name}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 truncate">{album.name}</h3>
                  <p className="text-secondary truncate">{album.artist}</p>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-surface rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-surface rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-xl text-secondary">No albums found</div>
        </div>
      )}
    </div>
  );
}