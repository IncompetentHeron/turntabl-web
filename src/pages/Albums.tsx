import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getFilteredAlbums } from '../lib/supabase';
import { searchSpotify, generateSlug } from '../lib/spotify';
import { useDebounce } from '../hooks/useDebounce';
import { IoGridOutline, IoListOutline, IoFunnelOutline, IoSearch } from 'react-icons/io5';

type SortOption = 'newest' | 'popular_all_time' | 'top_rated' | 'lowest_rated';
type ViewMode = 'grid' | 'list';

export default function GlobalAlbums() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- Applied Filter States (trigger data fetching and URL updates) ---
  const [page, setPage] = useState(1);
  const [appliedSortBy, setAppliedSortBy] = useState<SortOption>(
    (searchParams.get('sortBy') as SortOption) || 'popular_all_time'
  );
  const [appliedArtistIdFilter, setAppliedArtistIdFilter] = useState<string | null>(
    searchParams.get('artistId') || null
  );
  const [appliedReleaseYearFilter, setAppliedReleaseYearFilter] = useState<number | null>(
    searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  );
  const [appliedReleaseDecadeFilter, setAppliedReleaseDecadeFilter] = useState<number | null>(
    searchParams.get('decade') ? parseInt(searchParams.get('decade')!) : null
  );
  const [appliedAlbumTypeFilter, setAppliedAlbumTypeFilter] = useState<string | null>(
    searchParams.get('albumType') || null
  );

  // --- Temporary Filter States (bound to form inputs) ---
  const [tempSortBy, setTempSortBy] = useState<SortOption>(appliedSortBy);
  const [tempArtistNameSearch, setTempArtistNameSearch] = useState('');
  const [tempReleaseYearFilter, setTempReleaseYearFilter] = useState<number | null>(appliedReleaseYearFilter);
  const [tempReleaseDecadeFilter, setTempReleaseDecadeFilter] = useState<number | null>(appliedReleaseDecadeFilter);
  const [tempAlbumTypeFilter, setTempAlbumTypeFilter] = useState<string | null>(appliedAlbumTypeFilter);

  // --- Selected item states (for dropdown selections) ---
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(appliedArtistIdFilter);
  const [selectedArtistName, setSelectedArtistName] = useState('');

  // --- View mode state ---
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // --- Debounced versions for search suggestions ---
  const debouncedArtistName = useDebounce(tempArtistNameSearch, 300);

  // --- Dropdown visibility states and refs ---
  const [showArtistDropdown, setShowArtistDropdown] = useState(false);

  const artistInputRef = useRef<HTMLInputElement>(null);
  const artistDropdownRef = useRef<HTMLDivElement>(null);

  // --- Search suggestions queries ---
  const { data: artistSuggestions } = useQuery({
    queryKey: ['artistSuggestions', debouncedArtistName],
    queryFn: () => searchSpotify(debouncedArtistName),
    enabled: showArtistDropdown && debouncedArtistName.length > 1,
  });

  // --- Main albums query (depends on applied filters) ---
  const { data: albums = [], isLoading, error } = useQuery({
    queryKey: [
      'filteredAlbums',
      appliedSortBy,
      page,
      appliedArtistIdFilter,
      appliedReleaseYearFilter,
      appliedReleaseDecadeFilter,
      appliedAlbumTypeFilter,
    ],
    queryFn: () =>
      getFilteredAlbums({
        sortBy: appliedSortBy,
        page,
        limit: 20,
        artistId: appliedArtistIdFilter,
        releaseYear: appliedReleaseYearFilter,
        releaseDecade: appliedReleaseDecadeFilter,
        albumType: appliedAlbumTypeFilter,
      }),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // --- Effect to update URL search params when applied filters change ---
  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedSortBy !== 'popular_all_time') params.set('sortBy', appliedSortBy);
    if (appliedArtistIdFilter) params.set('artistId', appliedArtistIdFilter);
    if (appliedReleaseYearFilter) params.set('year', appliedReleaseYearFilter.toString());
    if (appliedReleaseDecadeFilter) params.set('decade', appliedReleaseDecadeFilter.toString());
    if (appliedAlbumTypeFilter) params.set('albumType', appliedAlbumTypeFilter);
    params.set('page', page.toString());
    navigate(`?${params.toString()}`, { replace: true });
  }, [
    appliedSortBy,
    page,
    appliedArtistIdFilter,
    appliedReleaseYearFilter,
    appliedReleaseDecadeFilter,
    appliedAlbumTypeFilter,
    navigate,
  ]);

  // --- Click outside handler for dropdowns ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        artistDropdownRef.current && !artistDropdownRef.current.contains(event.target as Node) &&
        artistInputRef.current && !artistInputRef.current.contains(event.target as Node)
      ) {
        setShowArtistDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- Handlers for filter changes ---
  const handleSortChange = (newSort: SortOption) => {
    setTempSortBy(newSort);
  };

  const handleApplyFilters = () => {
    setAppliedSortBy(tempSortBy);
    // Use selected artist ID if available, otherwise clear the filter if search is empty
    if (tempArtistNameSearch.trim() === '') {
      setAppliedArtistIdFilter(null);
      setSelectedArtistId(null);
      setSelectedArtistName('');
    } else {
      setAppliedArtistIdFilter(selectedArtistId);
    }
    setAppliedReleaseYearFilter(tempReleaseYearFilter);
    setAppliedReleaseDecadeFilter(tempReleaseDecadeFilter);
    setAppliedAlbumTypeFilter(tempAlbumTypeFilter);
    setPage(1); // Reset to first page on filter apply
    setShowFilters(false); // Close filter panel after applying
  };

  const getPageTitle = () => {
    switch (appliedSortBy) {
      case 'popular_all_time':
        return 'Popular Albums';
      case 'popular_this_week':
        return 'Popular This Week';
      case 'top_rated':
        return 'Top Rated Albums';
      case 'lowest_rated':
        return 'Lowest Rated Albums';
      case 'newest':
        return 'Recently Added Albums';
      default:
        return 'All Albums';
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Error loading albums</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{getPageTitle()}</h1>
          <p className="text-secondary">Discover the most reviewed and loved albums</p>
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
            Filters
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-surface rounded-lg p-6 mb-8">
          <h3 className="text-lg font-bold mb-4">Sort by</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'popular_all_time', label: 'Most Popular' },
              { key: 'top_rated', label: 'Highest Rated' },
              { key: 'lowest_rated', label: 'Lowest Rated' },
              { key: 'newest', label: 'Recently Added' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSortChange(key as SortOption)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  tempSortBy === key
                    ? 'bg-accent text-white'
                    : 'bg-surface2 text-secondary hover:text-primary hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <h3 className="text-lg font-bold mb-4">Filter by</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Artist Name Search with Dropdown */}
            <div className="relative">
              <label htmlFor="artistName" className="block text-sm font-medium mb-2">
                Artist Name
              </label>
              <input
                ref={artistInputRef}
                type="text"
                id="artistName"
                value={tempArtistNameSearch}
                onChange={(e) => {
                  setTempArtistNameSearch(e.target.value);
                  setShowArtistDropdown(true);
                }}
                onFocus={() => setShowArtistDropdown(true)}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg pr-10"
                placeholder="e.g., Pink Floyd"
              />
              <IoSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary" />
              {showArtistDropdown && debouncedArtistName.length > 1 && artistSuggestions?.artists?.length > 0 && (
                <div ref={artistDropdownRef} className="absolute z-10 w-full mt-1 bg-surface border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {artistSuggestions.artists.slice(0, 5).map((artist) => (
                    <div
                      key={artist.id}
                      className="flex items-center gap-3 p-2 hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        setTempArtistNameSearch(artist.name);
                        setSelectedArtistId(artist.id);
                        setSelectedArtistName(artist.name);
                        setShowArtistDropdown(false);
                      }}
                    >
                      <img src={artist.imageUrl} alt={artist.name} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <div className="font-medium">{artist.name}</div>
                        <div className="text-sm text-secondary">Artist</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="releaseYear" className="block text-sm font-medium mb-2">
                Release Year
              </label>
              <input
                type="number"
                id="releaseYear"
                value={tempReleaseYearFilter || ''}
                onChange={(e) => {
                  setTempReleaseYearFilter(e.target.value ? parseInt(e.target.value) : null);
                }}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg"
                placeholder="e.g., 2023"
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>

            <div>
              <label htmlFor="releaseDecade" className="block text-sm font-medium mb-2">
                Release Decade
              </label>
              <input
                type="number"
                id="releaseDecade"
                value={tempReleaseDecadeFilter || ''}
                onChange={(e) => {
                  setTempReleaseDecadeFilter(e.target.value ? parseInt(e.target.value) : null);
                }}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg"
                placeholder="e.g., 2020 (for 2020s)"
                step="10"
                min="1900"
                max={Math.floor(new Date().getFullYear() / 10) * 10}
              />
            </div>

            <div>
              <label htmlFor="albumType" className="block text-sm font-medium mb-2">
                Album Type
              </label>
              <select
                id="albumType"
                value={tempAlbumTypeFilter || ''}
                onChange={(e) => setTempAlbumTypeFilter(e.target.value || null)}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg"
              >
                <option value="">All Types</option>
                <option value="album">Albums</option>
                <option value="single">Singles</option>
                <option value="compilation">Compilations</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={handleApplyFilters}
              className="btn btn-primary"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-xl text-secondary">Loading albums...</div>
        </div>
      ) : albums.length > 0 ? (
        <>
          {/* Albums Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
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
                      className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <h3 className="font-medium group-hover:text-accent transition-colors line-clamp-2 mb-1">
                    {album.name}
                  </h3>
                  <p className="text-secondary text-sm line-clamp-1 mb-1">{album.artist}</p>
                  {album.review_count && (
                    <p className="text-accent text-xs">{album.review_count} reviews</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {albums.map((album) => (
                <Link
                  key={album.id}
                  to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
                  className="flex items-center gap-4 p-4 bg-surface rounded-lg hover:bg-white/5 transition-colors"
                >
                  <img
                    src={album.coverUrl}
                    alt={album.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{album.name}</h3>
                    <p className="text-secondary text-sm truncate">{album.artist}</p>
                    {album.review_count && (
                      <p className="text-accent text-xs">{album.review_count} reviews</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {albums.length === 20 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="flex items-center px-4 py-2">
                Page {page}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={albums.length < 20}
                className="btn btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-surface rounded-lg">
        <h2 className="text-2xl font-bold mb-2">No Albums Found</h2>
        {appliedArtistIdFilter && selectedArtistName ? (
          <>
            <p className="text-secondary mb-4">
              We couldn't find any albums for "{selectedArtistName}" in our database with the current filters.
              It's possible their full discography hasn't been synced yet.
            </p>
            <Link to={`/artist/${generateSlug(selectedArtistName, appliedArtistIdFilter)}`} className="btn btn-primary">
              Visit {selectedArtistName}'s Profile to Sync Albums
            </Link>
          </>
        ) : (
          <>
            <p className="text-secondary mb-4">
              No albums match your current filters. Try adjusting them or browse other sections.
            </p>
            <Link to="/search" className="btn btn-primary">
              Browse Albums
            </Link>
          </>
        )}
      </div>
    )}
    </div>
  );
}