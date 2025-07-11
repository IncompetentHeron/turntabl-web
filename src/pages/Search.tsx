import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchSpotify, generateSlug } from '../lib/spotify';
import { searchUsers } from '../lib/supabase';
import Avatar from '../components/Avatar';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const { data: searchResults, isLoading: spotifyLoading } = useQuery({
    queryKey: ['spotifySearch', query],
    queryFn: () => searchSpotify(query),
    enabled: !!query,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['userSearch', query],
    queryFn: () => searchUsers(query),
    enabled: !!query,
  });

  const isLoading = spotifyLoading || usersLoading;

  if (!query) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Search Albums & Artists</h1>
        <p className="text-secondary">Use the search bar above to find music</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <h1 className="text-3xl font-bold mb-8">Search Results for "{query}"</h1>
      
      {searchResults?.albums && searchResults.albums.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Albums & Singles</h2>
            <Link 
              to={`/search/albums?q=${query}`}
              className="text-accent hover:text-accent/80 transition-colors"
            >
              See all {searchResults.albums.length} albums
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {searchResults.albums.slice(0, 8).map((album) => (
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
        </section>
      )}
      
      {searchResults?.artists && searchResults.artists.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Artists</h2>
            <Link 
              to={`/search/artists?q=${query}`}
              className="text-accent hover:text-accent/80 transition-colors"
            >
              See all {searchResults.artists.length} artists
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {searchResults.artists.slice(0, 8).map((artist) => (
              <Link
                key={artist.id}
                to={`/artist/${generateSlug(artist.name, artist.id)}`}
                className="block bg-surface rounded-lg overflow-hidden hover:bg-white/5 transition-colors"
              >
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="w-full aspect-square object-cover rounded-t-lg"
                />
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 truncate">{artist.name}</h3>
                  {artist.genres.length > 0 && (
                    <p className="text-secondary truncate">{artist.genres[0]}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {users && users.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Users</h2>
            <Link 
              to={`/search/users?q=${query}`}
              className="text-accent hover:text-accent/80 transition-colors"
            >
              See all {users.length} users
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {users.slice(0, 8).map((profile) => (
              <Link
                key={profile.id}
                to={`/user/${profile.id}`}
                className="block bg-surface rounded-lg overflow-hidden hover:bg-white/5 transition-colors p-4"
              >
                <Avatar
                  url={profile.avatar_url}
                  name={profile.display_name || profile.username}
                  size="lg"
                  className="mx-auto mb-4"
                />
                <h3 className="font-bold text-lg mb-1 text-center truncate">
                  {profile.display_name || profile.username}
                </h3>
                <p className="text-secondary text-center truncate">@{profile.username}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-xl text-secondary">Searching...</div>
        </div>
      ) : !searchResults?.albums?.length && !searchResults?.artists?.length && !users.length && (
        <div className="text-center py-12">
          <div className="text-xl text-secondary">No results found</div>
        </div>
      )}
    </div>
  );
}