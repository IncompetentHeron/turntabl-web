import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getUserListens } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { generateSlug } from '../lib/spotify';
import { IoGridOutline, IoListOutline, IoFunnelOutline } from 'react-icons/io5';
import { format } from 'date-fns';

type SortOption = 'newest_added' | 'oldest_added' | 'album_name_asc' | 'album_name_desc' | 'artist_name_asc' | 'artist_name_desc' | 'release_date_newest' | 'release_date_oldest';
type ViewMode = 'grid' | 'list';

export default function ListenLater() {
  const { user, loading: userLoading } = useUser();
  const [sortBy, setSortBy] = useState<SortOption>('newest_added');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const { data: listensData, isLoading: listensLoading, error } = useQuery({
    queryKey: ['userListens', user?.id],
    queryFn: () => getUserListens(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const listenLaterAlbums = listensData?.listenLater || [];

  const sortedListenLaterAlbums = [...listenLaterAlbums].sort((a, b) => {
    switch (sortBy) {
      case 'newest_added':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest_added':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'album_name_asc':
        return (a.album?.name || '').localeCompare(b.album?.name || '');
      case 'album_name_desc':
        return (b.album?.name || '').localeCompare(a.album?.name || '');
      case 'artist_name_asc':
        return (a.album?.artist || '').localeCompare(b.album?.artist || '');
      case 'artist_name_desc':
        return (b.album?.artist || '').localeCompare(a.album?.artist || '');
      case 'release_date_newest':
        return new Date(b.album?.release_date || '1900-01-01').getTime() - new Date(a.album?.release_date || '1900-01-01').getTime();
      case 'release_date_oldest':
        return new Date(a.album?.release_date || '1900-01-01').getTime() - new Date(b.album?.release_date || '1900-01-01').getTime();
      default:
        return 0;
    }
  });

  if (userLoading || listensLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Loading your Listen Later list...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Error loading your Listen Later list.</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12 bg-surface rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Sign In to View Your Listen Later List</h2>
        <p className="text-secondary mb-4">
          Log in or create an account to save albums for later.
        </p>
        <Link to="/" className="btn btn-primary">
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Listen Later List</h1>
          <p className="text-secondary">Albums you've saved to check out later</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
              }`}
            >
              <IoGridOutline size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
              }`}
            >
              <IoListOutline size={20} />
            </button>
          </div>

          {/* Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <IoFunnelOutline size={20} />
            Sort By
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-surface rounded-lg p-6 mb-8">
          <h3 className="text-lg font-bold mb-4">Sort by</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'newest_added', label: 'Recently Added' },
              { key: 'oldest_added', label: 'Oldest Added' },
              { key: 'album_name_asc', label: 'Album Name (A-Z)' },
              { key: 'album_name_desc', label: 'Album Name (Z-A)' },
              { key: 'artist_name_asc', label: 'Artist Name (A-Z)' },
              { key: 'artist_name_desc', label: 'Artist Name (Z-A)' },
              { key: 'release_date_newest', label: 'Release Date (Newest)' },
              { key: 'release_date_oldest', label: 'Release Date (Oldest)' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setSortBy(key as SortOption);
                  setShowFilters(false); // Close filters after selection
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  sortBy === key
                    ? 'bg-accent text-white'
                    : 'bg-surface2 text-secondary hover:text-primary hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Listen Later Albums Display */}
      {sortedListenLaterAlbums.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {sortedListenLaterAlbums.map((listen) => (
                <Link
                  key={listen.id}
                  to={`/album/${generateSlug(`${listen.album?.artist} ${listen.album?.name}`, listen.album_id)}`}
                  className="group"
                >
                  <div className="aspect-square mb-3">
                    <img
                      src={listen.album?.cover_url}
                      alt={listen.album?.name}
                      className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <h3 className="font-medium group-hover:text-accent transition-colors line-clamp-1">
                    {listen.album?.name}
                  </h3>
                  <p className="text-secondary text-sm line-clamp-1">{listen.album?.artist}</p>
                  <p className="text-secondary text-xs mt-1">
                    Added {format(new Date(listen.created_at), 'MMM d, yyyy')}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedListenLaterAlbums.map((listen) => (
                <Link
                  key={listen.id}
                  to={`/album/${generateSlug(`${listen.album?.artist} ${listen.album?.name}`, listen.album_id)}`}
                  className="flex items-center gap-4 p-4 bg-surface rounded-lg hover:bg-white/5 transition-colors"
                >
                  <img
                    src={listen.album?.cover_url}
                    alt={listen.album?.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{listen.album?.name}</h3>
                    <p className="text-secondary text-sm truncate">{listen.album?.artist}</p>
                    <p className="text-secondary text-xs mt-1">
                      Added {format(new Date(listen.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-surface rounded-lg">
          <h2 className="text-2xl font-bold mb-2">Your Listen Later list is empty!</h2>
          <p className="text-secondary mb-4">
            Start saving albums you want to check out.
          </p>
          <Link to="/search" className="btn btn-primary">
            Find Albums
          </Link>
        </div>
      )}
    </div>
  );
}