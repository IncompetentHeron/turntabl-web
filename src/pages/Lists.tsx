import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getFilteredLists, searchUsers } from '../lib/supabase';
import { searchSpotify } from '../lib/spotify';
import { useUser } from '../hooks/useUser';
import { useDebounce } from '../hooks/useDebounce';
import ListCard from '../components/ListCard';
import { IoGridOutline, IoListOutline, IoFunnelOutline, IoSearch, IoCheckmark } from 'react-icons/io5';

type SortOption = 'newest' | 'oldest' | 'popular';
type ViewMode = 'grid' | 'list';

export default function GlobalLists() {
  const { user } = useUser();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- Applied Filter States (trigger data fetching and URL updates) ---
  const [page, setPage] = useState(1);
  const [appliedSortBy, setAppliedSortBy] = useState<SortOption>(
    (searchParams.get('sortBy') as SortOption) || 'newest'
  );
  const [appliedTitleQuery, setAppliedTitleQuery] = useState<string | null>(
    searchParams.get('title') || null
  );
  const [appliedDescriptionQuery, setAppliedDescriptionQuery] = useState<string | null>(
    searchParams.get('description') || null
  );
  const [appliedUserIdFilter, setAppliedUserIdFilter] = useState<string | null>(
    searchParams.get('userId') || null
  );
  const [appliedAlbumIdFilter, setAppliedAlbumIdFilter] = useState<string | null>(
    searchParams.get('albumId') || null
  );
  const [appliedArtistIdFilter, setAppliedArtistIdFilter] = useState<string | null>(
    searchParams.get('artistId') || null
  );
  const [appliedFollowedUsersOnly, setAppliedFollowedUsersOnly] = useState(
    searchParams.get('followed') === 'true'
  );

  // --- Temporary Filter States (bound to form inputs) ---
  const [tempSortBy, setTempSortBy] = useState<SortOption>(appliedSortBy);
  const [tempTitleSearch, setTempTitleSearch] = useState('');
  const [tempDescriptionSearch, setTempDescriptionSearch] = useState('');
  const [tempUsernameSearch, setTempUsernameSearch] = useState('');
  const [tempAlbumNameSearch, setTempAlbumNameSearch] = useState('');
  const [tempArtistNameSearch, setTempArtistNameSearch] = useState('');
  const [tempFollowedUsersOnly, setTempFollowedUsersOnly] = useState(appliedFollowedUsersOnly);

  // --- Selected item states (for dropdown selections) ---
  const [selectedUserId, setSelectedUserId] = useState<string | null>(appliedUserIdFilter);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(appliedAlbumIdFilter);
  const [selectedAlbumName, setSelectedAlbumName] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(appliedArtistIdFilter);
  const [selectedArtistName, setSelectedArtistName] = useState('');

  // --- View mode state ---
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // --- Debounced versions for search suggestions ---
  const debouncedUsername = useDebounce(tempUsernameSearch, 300);
  const debouncedAlbumName = useDebounce(tempAlbumNameSearch, 300);
  const debouncedArtistName = useDebounce(tempArtistNameSearch, 300);

  // --- Dropdown visibility states and refs ---
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAlbumDropdown, setShowAlbumDropdown] = useState(false);
  const [showArtistDropdown, setShowArtistDropdown] = useState(false);

  const userInputRef = useRef<HTMLInputElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const albumDropdownRef = useRef<HTMLDivElement>(null);
  const artistInputRef = useRef<HTMLInputElement>(null);
  const artistDropdownRef = useRef<HTMLDivElement>(null);

  // --- Search suggestions queries ---
  const { data: userSuggestions } = useQuery({
    queryKey: ['userSuggestions', debouncedUsername],
    queryFn: () => searchUsers(debouncedUsername),
    enabled: showUserDropdown && debouncedUsername.length > 1,
  });

  const { data: albumSuggestions } = useQuery({
    queryKey: ['albumSuggestions', debouncedAlbumName],
    queryFn: () => searchSpotify(debouncedAlbumName),
    enabled: showAlbumDropdown && debouncedAlbumName.length > 1,
  });

  const { data: artistSuggestions } = useQuery({
    queryKey: ['artistSuggestions', debouncedArtistName],
    queryFn: () => searchSpotify(debouncedArtistName),
    enabled: showArtistDropdown && debouncedArtistName.length > 1,
  });

  // --- Main lists query (depends on applied filters) ---
  const { data: lists = [], isLoading, error } = useQuery({
    queryKey: [
      'filteredLists',
      appliedSortBy,
      page,
      appliedTitleQuery,
      appliedDescriptionQuery,
      appliedUserIdFilter,
      appliedFollowedUsersOnly,
      appliedAlbumIdFilter,
      appliedArtistIdFilter,
    ],
    queryFn: () =>
      getFilteredLists({
        sortBy: appliedSortBy,
        page,
        limit: 20,
        titleQuery: appliedTitleQuery,
        descriptionQuery: appliedDescriptionQuery,
        userId: appliedUserIdFilter,
        followedByUserId: appliedFollowedUsersOnly && user ? user.id : null,
        albumId: appliedAlbumIdFilter,
        artistId: appliedArtistIdFilter,
      }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // --- Effect to update URL search params when applied filters change ---
  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedSortBy !== 'newest') params.set('sortBy', appliedSortBy);
    if (appliedTitleQuery) params.set('title', appliedTitleQuery);
    if (appliedDescriptionQuery) params.set('description', appliedDescriptionQuery);
    if (appliedUserIdFilter) params.set('userId', appliedUserIdFilter);
    if (appliedAlbumIdFilter) params.set('albumId', appliedAlbumIdFilter);
    if (appliedArtistIdFilter) params.set('artistId', appliedArtistIdFilter);
    if (appliedFollowedUsersOnly) params.set('followed', 'true');
    params.set('page', page.toString());
    navigate(`?${params.toString()}`, { replace: true });
  }, [
    appliedSortBy,
    page,
    appliedTitleQuery,
    appliedDescriptionQuery,
    appliedUserIdFilter,
    appliedAlbumIdFilter,
    appliedArtistIdFilter,
    appliedFollowedUsersOnly,
    navigate,
  ]);

  // --- Click outside handler for dropdowns ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node) &&
        userInputRef.current && !userInputRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
      if (
        albumDropdownRef.current && !albumDropdownRef.current.contains(event.target as Node) &&
        albumInputRef.current && !albumInputRef.current.contains(event.target as Node)
      ) {
        setShowAlbumDropdown(false);
      }
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
    setAppliedTitleQuery(tempTitleSearch.trim() || null);
    setAppliedDescriptionQuery(tempDescriptionSearch.trim() || null);
    
    // Use selected IDs if available, otherwise clear filters if search inputs are empty
    if (tempUsernameSearch.trim() === '') {
      setAppliedUserIdFilter(null);
      setSelectedUserId(null);
      setSelectedUserName('');
    } else {
      setAppliedUserIdFilter(selectedUserId);
    }
    
    if (tempAlbumNameSearch.trim() === '') {
      setAppliedAlbumIdFilter(null);
      setSelectedAlbumId(null);
      setSelectedAlbumName('');
    } else {
      setAppliedAlbumIdFilter(selectedAlbumId);
    }
    
    if (tempArtistNameSearch.trim() === '') {
      setAppliedArtistIdFilter(null);
      setSelectedArtistId(null);
      setSelectedArtistName('');
    } else {
      setAppliedArtistIdFilter(selectedArtistId);
    }
    
    setAppliedFollowedUsersOnly(tempFollowedUsersOnly);
    setPage(1); // Reset to first page on filter apply
    setShowFilters(false); // Close filter panel after applying
  };

  const getPageTitle = () => {
    switch (appliedSortBy) {
      case 'popular':
        return 'Popular Lists';
      case 'oldest':
        return 'Oldest Lists';
      case 'newest':
        return 'Latest Lists';
      default:
        return 'All Lists';
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Error loading lists</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{getPageTitle()}</h1>
          <p className="text-secondary">Discover curated music lists from the community</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {user && (
            <button
              onClick={() => setTempFollowedUsersOnly(!tempFollowedUsersOnly)}
              className={`btn ${tempFollowedUsersOnly ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
            >
              {tempFollowedUsersOnly ? <IoCheckmark size={20} /> : null}
              My Community
            </button>
          )}

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
              { key: 'newest', label: 'Newest First' },
              { key: 'oldest', label: 'Oldest First' },
              { key: 'popular', label: 'Most Popular' },
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
            {/* Title Search */}
            <div>
              <label htmlFor="titleSearch" className="block text-sm font-medium mb-2">
                List Title
              </label>
              <input
                type="text"
                id="titleSearch"
                value={tempTitleSearch}
                onChange={(e) => setTempTitleSearch(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg"
                placeholder="e.g., Best Albums of 2023"
              />
            </div>

            {/* Description Search */}
            <div>
              <label htmlFor="descriptionSearch" className="block text-sm font-medium mb-2">
                Description
              </label>
              <input
                type="text"
                id="descriptionSearch"
                value={tempDescriptionSearch}
                onChange={(e) => setTempDescriptionSearch(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg"
                placeholder="e.g., indie rock favorites"
              />
            </div>

            {/* Username Search with Dropdown */}
            <div className="relative">
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                ref={userInputRef}
                type="text"
                id="username"
                value={tempUsernameSearch}
                onChange={(e) => {
                  setTempUsernameSearch(e.target.value);
                  setShowUserDropdown(true);
                }}
                onFocus={() => setShowUserDropdown(true)}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg pr-10"
                placeholder="e.g., musiclover123"
              />
              <IoSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary" />
              {showUserDropdown && debouncedUsername.length > 1 && userSuggestions?.length > 0 && (
                <div ref={userDropdownRef} className="absolute z-10 w-full mt-1 bg-surface border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {userSuggestions.slice(0, 5).map((userProfile) => (
                    <div
                      key={userProfile.id}
                      className="flex items-center gap-3 p-2 hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        setTempUsernameSearch(userProfile.username);
                        setSelectedUserId(userProfile.id);
                        setSelectedUserName(userProfile.username);
                        setShowUserDropdown(false);
                      }}
                    >
                      <img src={userProfile.avatar_url || 'https://via.placeholder.com/300'} alt={userProfile.username} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <div className="font-medium">{userProfile.display_name || userProfile.username}</div>
                        <div className="text-sm text-secondary">@{userProfile.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Album Name Search with Dropdown */}
            <div className="relative">
              <label htmlFor="albumName" className="block text-sm font-medium mb-2">
                Album Name
              </label>
              <input
                ref={albumInputRef}
                type="text"
                id="albumName"
                value={tempAlbumNameSearch}
                onChange={(e) => {
                  setTempAlbumNameSearch(e.target.value);
                  setShowAlbumDropdown(true);
                }}
                onFocus={() => setShowAlbumDropdown(true)}
                className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg pr-10"
                placeholder="e.g., The Dark Side of the Moon"
              />
              <IoSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary" />
              {showAlbumDropdown && debouncedAlbumName.length > 1 && albumSuggestions?.albums?.length > 0 && (
                <div ref={albumDropdownRef} className="absolute z-10 w-full mt-1 bg-surface border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {albumSuggestions.albums.slice(0, 5).map((album) => (
                    <div
                      key={album.id}
                      className="flex items-center gap-3 p-2 hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        setTempAlbumNameSearch(album.name);
                        setSelectedAlbumId(album.id);
                        setSelectedAlbumName(album.name);
                        setShowAlbumDropdown(false);
                      }}
                    >
                      <img src={album.coverUrl} alt={album.name} className="w-8 h-8 rounded object-cover" />
                      <div>
                        <div className="font-medium">{album.name}</div>
                        <div className="text-sm text-secondary">{album.artist}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
          <div className="text-xl text-secondary">Loading lists...</div>
        </div>
      ) : lists.length > 0 ? (
        <>
          {/* Lists Grid/List */}
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          }>
            {lists.map((list) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>

          {/* Pagination */}
          {lists.length === 20 && (
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
                disabled={lists.length < 20}
                className="btn btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-surface rounded-lg">
          <h2 className="text-2xl font-bold mb-2">No Lists Found</h2>
          <p className="text-secondary mb-4">
            Be the first to create a list and share your favorite music!
          </p>
          <Link to="/search" className="btn btn-primary">
            Browse Albums
          </Link>
        </div>
      )}
    </div>
  );
}