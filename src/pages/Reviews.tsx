import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getReviewsWithFilters, searchUsers } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import ReviewCardUnknown from '../components/ReviewCardUnknown';
import { IoFunnelOutline, IoSearch, IoCheckmark } from 'react-icons/io5';
import { useDebounce } from '../hooks/useDebounce';
import { searchSpotify } from '../lib/spotify';
import { motion, AnimatePresence } from 'framer-motion';

type SortOption = 'newest' | 'oldest' | 'popular' | 'top_rated' | 'lowest_rated';

export default function GlobalReviews() {
  const { user } = useUser();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Applied Filter States (trigger data fetching and URL updates) ---
  const [appliedSortBy, setAppliedSortBy] = useState<SortOption>(
    (searchParams.get('sortBy') as SortOption) || 'newest'
  );
  const [appliedAlbumIdFilter, setAppliedAlbumIdFilter] = useState<string | null>(
    searchParams.get('albumId') || null
  );
  const [appliedArtistIdFilter, setAppliedArtistIdFilter] = useState<string | null>(
    searchParams.get('artistId') || null
  );
  const [appliedUserIdFilter, setAppliedUserIdFilter] = useState<string | null>(
    searchParams.get('userId') || null
  );
  const [appliedFollowedUsersOnly, setAppliedFollowedUsersOnly] = useState(
    searchParams.get('followed') === 'true'
  );
  const [appliedReleaseYearFilter, setAppliedReleaseYearFilter] = useState<number | null>(
    searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  );
  const [appliedReleaseDecadeFilter, setAppliedReleaseDecadeFilter] = useState<number | null>(
    searchParams.get('decade') ? parseInt(searchParams.get('decade')!) : null
  );

  // --- Temporary Filter States (bound to form inputs) ---
  const [tempSortBy, setTempSortBy] = useState<SortOption>(appliedSortBy);
  const [tempAlbumNameSearch, setTempAlbumNameSearch] = useState('');
  const [tempArtistNameSearch, setTempArtistNameSearch] = useState('');
  const [tempUsernameSearch, setTempUsernameSearch] = useState('');
  const [tempReleaseYearFilter, setTempReleaseYearFilter] = useState<number | null>(appliedReleaseYearFilter);
  const [tempReleaseDecadeFilter, setTempReleaseDecadeFilter] = useState<number | null>(appliedReleaseDecadeFilter);
  const [tempFollowedUsersOnly, setTempFollowedUsersOnly] = useState(appliedFollowedUsersOnly);

  // --- Selected item states (for dropdown selections) ---
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(appliedAlbumIdFilter);
  const [selectedAlbumName, setSelectedAlbumName] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(appliedArtistIdFilter);
  const [selectedArtistName, setSelectedArtistName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(appliedUserIdFilter);
  const [selectedUserName, setSelectedUserName] = useState('');

  // --- Debounced versions for search suggestions ---
  const debouncedAlbumName = useDebounce(tempAlbumNameSearch, 300);
  const debouncedArtistName = useDebounce(tempArtistNameSearch, 300);
  const debouncedUsername = useDebounce(tempUsernameSearch, 300);

  // --- Dropdown visibility states and refs ---
  const [showFilters, setShowFilters] = useState(false);
  const [showAlbumDropdown, setShowAlbumDropdown] = useState(false);
  const [showArtistDropdown, setShowArtistDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const albumInputRef = useRef<HTMLInputElement>(null);
  const albumDropdownRef = useRef<HTMLDivElement>(null);
  const artistInputRef = useRef<HTMLInputElement>(null);
  const artistDropdownRef = useRef<HTMLDivElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // --- Scroll state for dynamic mobile button ---
  const [isScrolled, setIsScrolled] = useState(false);

  // --- Search suggestions queries ---
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

  const { data: userSuggestions } = useQuery({
    queryKey: ['userSuggestions', debouncedUsername],
    queryFn: () => searchUsers(debouncedUsername),
    enabled: showUserDropdown && debouncedUsername.length > 1,
  });

  // --- Infinite reviews query (depends on applied filters) ---
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: [
      'filteredReviews',
      appliedSortBy,
      appliedAlbumIdFilter,
      appliedArtistIdFilter,
      appliedUserIdFilter,
      appliedFollowedUsersOnly,
      appliedReleaseYearFilter,
      appliedReleaseDecadeFilter,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      return getReviewsWithFilters({
        sortBy: appliedSortBy,
        page: pageParam as number,
        limit: 20,
        albumId: appliedAlbumIdFilter,
        artistId: appliedArtistIdFilter,
        userId: appliedUserIdFilter,
        followedByUserId: appliedFollowedUsersOnly && user ? user.id : null,
        releaseYear: appliedReleaseYearFilter,
        releaseDecade: appliedReleaseDecadeFilter,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.length === 20) {
        return lastPageParam + 1;
      }
      return undefined;
    },
    select: (data) => ({
      ...data,
      pages: data.pages.flat(), // Flatten the array of arrays into a single array
    }),
    staleTime: 1000 * 60 * 5,
  });

  const reviews = data?.pages || [];

  // --- Effect to update URL search params when applied filters change ---
  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedSortBy !== 'newest') params.set('sortBy', appliedSortBy);
    if (appliedAlbumIdFilter) params.set('albumId', appliedAlbumIdFilter);
    if (appliedArtistIdFilter) params.set('artistId', appliedArtistIdFilter);
    if (appliedUserIdFilter) params.set('userId', appliedUserIdFilter);
    if (appliedFollowedUsersOnly) params.set('followed', 'true');
    if (appliedReleaseYearFilter) params.set('year', appliedReleaseYearFilter.toString());
    if (appliedReleaseDecadeFilter) params.set('decade', appliedReleaseDecadeFilter.toString());
    // Page parameter is removed as it's handled by infinite scroll
    navigate(`?${params.toString()}`, { replace: true });
  }, [
    appliedSortBy,
    appliedAlbumIdFilter,
    appliedArtistIdFilter,
    appliedUserIdFilter,
    appliedFollowedUsersOnly,
    appliedReleaseYearFilter,
    appliedReleaseDecadeFilter,
    navigate,
  ]);

  // --- Click outside handler for dropdowns ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
      if (
        userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node) &&
        userInputRef.current && !userInputRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- Scroll detection for dynamic mobile button ---
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Handlers for filter changes ---
  const handleSortChange = (newSort: SortOption) => {
    setTempSortBy(newSort);
  };

  const handleApplyFilters = () => {
    setAppliedSortBy(tempSortBy);

    // Use selected IDs if available, otherwise clear filters if search inputs are empty
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

    if (tempUsernameSearch.trim() === '') {
      setAppliedUserIdFilter(null);
      setSelectedUserId(null);
      setSelectedUserName('');
    } else {
      setAppliedUserIdFilter(selectedUserId);
    }

    setAppliedReleaseYearFilter(tempReleaseYearFilter);
    setAppliedReleaseDecadeFilter(tempReleaseDecadeFilter);
    setAppliedFollowedUsersOnly(tempFollowedUsersOnly);

    // Invalidate and refetch the infinite query from the beginning
    queryClient.invalidateQueries({ queryKey: ['filteredReviews'] });
    setShowFilters(false); // Close filter panel after applying
  };

  const handleUpdate = useCallback(() => {
    // Invalidate the query to refetch the current visible reviews
    queryClient.invalidateQueries({ queryKey: ['filteredReviews'] });
  }, [queryClient]);

  const getPageTitle = () => {
    switch (appliedSortBy) {
      case 'popular':
        return 'Trending Reviews';
      case 'top_rated':
        return 'Top Reviews';
      case 'lowest_rated':
        return 'Lowest Rated Reviews';
      case 'newest':
        return 'Latest Reviews';
      case 'oldest':
        return 'Oldest Reviews';
      default:
        return 'All Reviews';
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Error loading reviews</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{getPageTitle()}</h1>
          <p className="text-secondary">Discover what the community is saying about music</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {/* Reviews List Column */}
        <div className="md:col-span-3 lg:col-span-4">
          {isLoading && reviews.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-xl text-secondary">Loading reviews...</div>
            </div>
          ) : reviews.length > 0 ? (
            <>
              {/* Reviews Feed */}
              <div className="space-y-4">
                {reviews.map((review) => (
                  <ReviewCardUnknown key={review.id} review={review} onUpdate={handleUpdate} />
                ))}
              </div>

              {/* Load More Button */}
              {hasNextPage && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="btn btn-secondary"
                  >
                    {isFetchingNextPage ? 'Loading more...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-surface rounded-lg">
              <h2 className="text-2xl font-bold mb-2">No Reviews Found</h2>
              <p className="text-secondary mb-4">
                Be the first to write a review and share your thoughts!
              </p>
              <Link to="/search" className="btn btn-primary">
                Find Albums to Review
              </Link>
            </div>
          )}
        </div>
        {/* Filters Column (Desktop) */}
        <div className="hidden md:block md:col-span-1 lg:col-span-1 sticky top-16 self-start max-h-[calc(100vh-4rem)] overflow-y-auto pr-4">
          <div className="bg-surface rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">Sort by</h3>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { key: 'popular', label: 'Trending' },
                { key: 'top_rated', label: 'Top Rated' },
                { key: 'newest', label: 'Latest' },
                { key: 'oldest', label: 'Oldest' },
                { key: 'lowest_rated', label: 'Lowest Rated' },
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
            <div className="grid grid-cols-1 gap-4">
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
              <div className="col-span-full">
                {user && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempFollowedUsersOnly}
                      onChange={() => setTempFollowedUsersOnly(!tempFollowedUsersOnly)}
                      className="form-checkbox h-5 w-5 text-accent rounded"
                    />
                    <span className="text-sm font-medium">Show reviews from users I follow</span>
                  </label>
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
        </div>
      </div>

      {/* Mobile Filter Button */}
      <div className="md:hidden fixed bottom-4 right-4 z-40">
        <motion.button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn btn-primary flex items-center justify-center transition-all duration-300 ${
            isScrolled ? 'w-12 h-12 rounded-full p-0' : 'px-6 py-3 rounded-lg'
          }`}
          initial={false}
          animate={{
            width: isScrolled ? 48 : 'auto',
            height: isScrolled ? 48 : 'auto',
            padding: isScrolled ? '0px' : '12px 24px',
            borderRadius: isScrolled ? '9999px' : '8px',
          }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {isScrolled ? (
              <motion.div
                key="icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <IoFunnelOutline size={24} />
              </motion.div>
            ) : (
              <motion.div
                key="text"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <IoFunnelOutline size={20} />
                Filters
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Mobile Filters Panel Overlay */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            className="md:hidden fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="bg-surface rounded-lg p-6 m-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
              initial={{ y: '100vh' }}
              animate={{ y: 0 }}
              exit={{ y: '100vh' }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Filters</h2>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-secondary hover:text-primary"
                >
                  ✕
                </button>
              </div>
              <h3 className="text-lg font-bold mb-4">Sort by</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { key: 'popular', label: 'Trending' },
                  { key: 'top_rated', label: 'Top Rated' },
                  { key: 'newest', label: 'Latest' },
                  { key: 'oldest', label: 'Oldest' },
                  { key: 'lowest_rated', label: 'Lowest Rated' },
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
              <div className="grid grid-cols-1 gap-4">
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
                <div className="col-span-full">
                  {user && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempFollowedUsersOnly}
                        onChange={() => setTempFollowedUsersOnly(!tempFollowedUsersOnly)}
                        className="form-checkbox h-5 w-5 text-accent rounded"
                      />
                      <span className="text-sm font-medium">Show reviews from users I follow</span>
                    </label>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
