import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../hooks/useUser';
import { getUnreadNotificationCount } from '../lib/supabase';
import { searchSpotify, generateSlug } from '../lib/spotify';
import { searchUsers } from '../lib/supabase';
import SearchBar from './SearchBar';
import Avatar from './Avatar';
import NotificationsDropdown from './NotificationsDropdown';
import { IoNotificationsOutline, IoSearchOutline, IoClose } from 'react-icons/io5';

interface HeaderProps {
  onShowAuth: (view: 'sign_in' | 'sign_up') => void;
  query: string;
  setQuery: (query: string) => void;
  onFocusSearch: () => void;
  onSearchSubmit: (query: string) => void;
  showSearchBarDropdown: boolean;
  onCloseSearchBarDropdown: () => void;
}

type SearchFilter = 'all' | 'albums' | 'artists' | 'users';

export default function Header({ 
  onShowAuth, 
  query, 
  setQuery, 
  onFocusSearch, 
  onSearchSubmit,
  showSearchBarDropdown,
  onCloseSearchBarDropdown
}: HeaderProps) {
  const { user, profile } = useUser();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [activeSearchFilter, setActiveSearchFilter] = useState<SearchFilter>('all');

  // Add ref for search dropdown
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: getUnreadNotificationCount,
    enabled: !!user,
  });

  const { data: searchResults, isLoading: isLoadingSpotify } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchSpotify(query),
    enabled: query.length > 1 && showSearchBarDropdown,
  });

  const { data: userResults = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['userSearch', query],
    queryFn: () => searchUsers(query),
    enabled: query.length > 1 && showSearchBarDropdown,
  });

  const isLoading = isLoadingSpotify || isLoadingUsers;

  const renderFilterButtons = () => (
    <div className="flex border-b border-white/10 p-2 gap-1">
      {[
        { key: 'all', label: 'All' },
        { key: 'albums', label: 'Albums' },
        { key: 'artists', label: 'Artists' },
        { key: 'users', label: 'Users' }
      ].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setActiveSearchFilter(key as SearchFilter)}
          className={`px-3 py-1 rounded-md text-sm transition-colors ${
            activeSearchFilter === key
              ? 'bg-accent text-white'
              : 'text-secondary hover:text-primary hover:bg-white/5'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const renderSearchResults = (isMobile = false) => {
    const showAlbums = activeSearchFilter === 'all' || activeSearchFilter === 'albums';
    const showArtists = activeSearchFilter === 'all' || activeSearchFilter === 'artists';
    const showUsers = activeSearchFilter === 'all' || activeSearchFilter === 'users';

    const hasAlbums = searchResults?.albums && searchResults.albums.length > 0;
    const hasArtists = searchResults?.artists && searchResults.artists.length > 0;
    const hasUsers = userResults && userResults.length > 0;

    const hasAnyResults = (showAlbums && hasAlbums) || (showArtists && hasArtists) || (showUsers && hasUsers);

    const getNoResultsMessage = () => {
      if (activeSearchFilter === 'all') {
        return 'No results found';
      }
      return `No ${activeSearchFilter} found`;
    };

    return (
      <div>
        {renderFilterButtons()}
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          {showAlbums && hasAlbums && (
            <div className={showArtists || showUsers ? "border-b border-white/10" : ""}>
              {searchResults.albums.slice(0, 5).map((album) => (
                <Link
                  key={album.id}
                  to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
                  className="flex items-center gap-3 p-2 hover:bg-white/5 transition-colors"
                  onClick={() => {
                    onCloseSearchBarDropdown();
                    if (isMobile) setShowMobileSearch(false);
                  }}
                >
                  <img
                    src={album.coverUrl}
                    alt={album.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div>
                    <div className="font-medium">{album.name}</div>
                    <div className="text-sm text-secondary">{album.artist}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {showArtists && hasArtists && (
            <div className={showUsers ? "border-b border-white/10" : ""}>
              {searchResults.artists.slice(0, 5).map((artist) => (
                <Link
                  key={artist.id}
                  to={`/artist/${generateSlug(artist.name, artist.id)}`}
                  className="flex items-center gap-3 p-2 hover:bg-white/5 transition-colors"
                  onClick={() => {
                    onCloseSearchBarDropdown();
                    if (isMobile) setShowMobileSearch(false);
                  }}
                >
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-medium">{artist.name}</div>
                    <div className="text-sm text-secondary">Artist</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {showUsers && hasUsers && (
            <div>
              {userResults.slice(0, 5).map((userProfile) => (
                <Link
                  key={userProfile.id}
                  to={`/user/${userProfile.id}`}
                  className="flex items-center gap-3 p-2 hover:bg-white/5 transition-colors"
                  onClick={() => {
                    onCloseSearchBarDropdown();
                    if (isMobile) setShowMobileSearch(false);
                  }}
                >
                  <Avatar
                    url={userProfile.avatar_url}
                    name={userProfile.display_name || userProfile.username}
                    size="sm"
                  />
                  <div>
                    <div className="font-medium">{userProfile.display_name || userProfile.username}</div>
                    <div className="text-sm text-secondary">@{userProfile.username}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {!hasAnyResults && (
            <div className="p-4 text-secondary">{getNoResultsMessage()}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-accent2/20">
      <div className="container mx-auto px-3">
        <div className="h-12 flex items-center justify-between gap-4">
          <Link to="/" className="text-2xl font-serif font-bold flex-shrink-0">
              <img src="/turntabl-logo.svg" alt="Turntabl" className="h-10 w-auto" />
          </Link>
          
          <div className="hidden md:block flex-1 max-w-xl relative">
            <SearchBar 
              query={query}
              setQuery={setQuery}
              onFocusSearch={onFocusSearch}
              onSearchSubmit={onSearchSubmit}
            />
            
            {/* Search Results Dropdown */}
            {showSearchBarDropdown && query.length > 1 && (
              <div 
                ref={searchDropdownRef}
                className="search-dropdown absolute top-full left-0 right-0 mt-2 bg-surface border border-white/10 rounded-lg shadow-xl z-50"
              >
                {isLoading ? (
                  <div className="p-4 text-secondary">Searching...</div>
                ) : (
                  renderSearchResults()
                )}
              </div>
            )}
          </div>

          <nav className="flex items-center gap-4">
            {/* Mobile Search Button */}
            <button
              onClick={() => setShowMobileSearch(true)}
              className="md:hidden p-2 text-secondary hover:text-primary transition-colors"
            >
              <IoSearchOutline size={20} />
            </button>

            {user && profile ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-secondary hover:text-primary transition-colors"
                  >
                    <IoNotificationsOutline size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 w-4 h-4 bg-accent2 text-white text-xs flex items-center justify-center rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <>
                      <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setShowNotifications(false)}
                      />
                      <NotificationsDropdown
                        onClose={() => setShowNotifications(false)}
                      />
                    </>
                  )}
                </div>
                <Link 
                  to={`/user/${user.id}`}
                  className="flex items-center gap-2"
                >
                  <Avatar
                    url={profile.avatar_url}
                    name={profile.display_name || profile.username}
                    size="sm"
                  />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onShowAuth('sign_in')}
                  className="btn btn-secondary text-secondary hover:text-primary transition-colors"
                >
                  Log In
                </button>
                <button
                  onClick={() => onShowAuth('sign_up')}
                  className="btn btn-primary"
                >
                  Sign Up
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 md:hidden">
          <div className="container mx-auto px-3">
            <div className="h-12 flex items-center justify-between gap-4">
              <div className="flex-1 relative">
                <SearchBar 
                  query={query}
                  setQuery={setQuery}
                  onFocusSearch={onFocusSearch}
                  onSearchSubmit={(q) => {
                    onSearchSubmit(q);
                    setShowMobileSearch(false);
                  }}
                />
                
                {/* Mobile Search Results */}
                {query.length > 1 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-white/10 rounded-lg shadow-xl">
                    {isLoading ? (
                      <div className="p-4 text-secondary">Searching...</div>
                    ) : (
                      renderSearchResults(true)
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowMobileSearch(false)}
                className="p-2 text-secondary hover:text-primary transition-colors"
              >
                <IoClose size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}