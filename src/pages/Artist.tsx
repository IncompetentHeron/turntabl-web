import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAlbum, getArtist as getSpotifyArtist, generateSlug } from '../lib/spotify';
import {
  getArtistStats,
  getArtistReviewsAggregate,
  getTopReviewsByArtist,
  getTopListsIncludingArtist,
  getAlbumStats,
  getSupabaseArtist,
  getSupabaseArtistAlbums,
  Artist as SupabaseArtist, // Import the new Artist interface from supabase.ts
} from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import RatingDistributionChart from '../components/RatingDistributionChart';
import ArtistDiscography from '../components/ArtistDiscography';
import SimilarArtists from '../components/SimilarArtists';
import ReviewCardUnknown from '../components/ReviewCardUnknown';
import AddToListModal from '../components/AddToListModal';
import AuthModal from '../components/Auth';
import ListCard from '../components/ListCard';
import Avatar from '../components/Avatar';
import { IoAdd } from 'react-icons/io5';
import { MdFormatListBulletedAdd } from 'react-icons/md';
import { format, isAfter, subDays } from 'date-fns';
import { ToastOptions } from '../hooks/useToast'; // Import ToastOptions


interface ArtistProps {
  showToast: (options: ToastOptions) => void; // Add showToast prop
}

// New helper function for Spotify ID validation
function isValidSpotifyId(id: string): boolean {
  return /^[a-zA-Z0-9]{22}$/.test(id);
}

export default function Artist({ showToast }: ArtistProps) {
  const { id } = useParams<{ id: string }>();
  // Validate the extracted ID immediately
  const artistId = id && isValidSpotifyId(id.split('-').pop() || '') ? id.split('-').pop() || '' : '';

  // ALL HOOKS MUST BE DECLARED HERE, BEFORE ANY CONDITIONAL RETURNS
  const { user } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);

  const { data: artist, isLoading: artistLoading } = useQuery({
    queryKey: ['artist', artistId],
    queryFn: async () => {
      let artistData: SupabaseArtist | null = await getSupabaseArtist(artistId);

      if (!artistData) {
        // If not in Supabase, fetch from Spotify and trigger sync
        const spotifyArtistData = await getSpotifyArtist(artistId); // This fetches artist and its albums
        if (!spotifyArtistData) {
          throw new Error('Artist not found on Spotify');
        }

        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-artist`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ artist: spotifyArtistData }),
          });

          if (!response.ok) {
            console.error('Error syncing artist:', await response.text());
            // If sync fails, try to fetch from Supabase again (in case it eventually succeeds)
            artistData = await getSupabaseArtist(artistId);
            if (!artistData) {
                throw new Error('Artist not found after sync attempt');
            }
          } else {
              // If sync was successful, fetch the newly synced data from Supabase
              artistData = await getSupabaseArtist(artistId);
              if (!artistData) {
                  throw new Error('Artist not found after successful sync');
              }
          }
        } catch (syncError) {
          console.error('Error triggering sync-artist function:', syncError);
          throw syncError;
        }
        
        // This is the part that updates the discography - RE-INTRODUCED
        if (spotifyArtistData.albums && spotifyArtistData.albums.length > 0) {
          const syncPromises = spotifyArtistData.albums.map(async (album) => {
            try {
              const albumSyncResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-album`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ album: album }),
              });
              if (!albumSyncResponse.ok) {
                console.warn(`Failed to sync album ${album.name}:`, await albumSyncResponse.text());
              }
            } catch (albumSyncError) {
              console.warn(`Error syncing album ${album.name}:`, albumSyncError);
            }
          });
          // Wait for all sync operations to complete (or settle)
          await Promise.allSettled(syncPromises);
        }
      }

      // Always fetch albums from Supabase after ensuring artist data is there
      const supabaseAlbums = await getSupabaseArtistAlbums(artistId);
      // Combine artist data with albums for the component's expected structure
      return { ...artistData, albums: supabaseAlbums };
    },
    enabled: !!artistId, // Only run this query if artistId is valid
  });

  const { data: stats } = useQuery({
    queryKey: ['artistStats', artistId],
    queryFn: () => getArtistStats(artistId),
    enabled: !!artistId, // Only run this query if artistId is valid
  });

  const { data: reviewsData = [] } = useQuery({
    queryKey: ['artistReviewsAggregate', artistId],
    queryFn: () => getArtistReviewsAggregate(artistId),
    enabled: !!artistId, // Only run this query if artistId is valid
  });

  const { data: topReviews = [] } = useQuery({
    queryKey: ['topReviewsByArtist', artistId],
    queryFn: () => getTopReviewsByArtist(artistId, 10),
    enabled: !!artistId, // Only run this query if artistId is valid
  });

  const { data: topLists = [] } = useQuery({
    queryKey: ['topListsIncludingArtist', artistId],
    queryFn: () => getTopListsIncludingArtist(artistId, 5),
    enabled: !!artistId, // Only run this query if artistId is valid
  });

  // Find recent release (within last 30 days)
  const recentRelease = artist?.albums.find(album => {
    const releaseDate = new Date(album.release_date); // Use release_date from Supabase Album
    const thirtyDaysAgo = subDays(new Date(), 30);
    return isAfter(releaseDate, thirtyDaysAgo);
  });

  // Get stats for recent release
  const { data: recentReleaseStats } = useQuery({
    queryKey: ['albumStats', recentRelease?.id],
    queryFn: () => getAlbumStats(recentRelease!.id),
    enabled: !!recentRelease,
  });

  // CONDITIONAL RENDERING STARTS HERE, AFTER ALL HOOKS
  if (!artistId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Invalid artist ID</div>
      </div>
    );
  }

  if (artistLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Loading artist...</div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Artist not found</div>
      </div>
    );
  }

  const handleAddToList = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowAddToListModal(true);
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Artist Header - spans full width */}
      <div className="col-span-12 flex flex-col gap-3 bg-gradient-to-t from-surface2 to-background rounded-b-lg p-6 sm:flex-row sm:gap-6 sm:mb-3 items-center sm:items-end">
        <div className="w-32 lg:w-48 mx-auto flex-shrink-0">
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="w-full aspect-square rounded-full object-cover shadow-xl"
          />
        </div>

        <div className="flex-1 flex flex-col justify-end text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">{artist.name}</h1>
          {artist.genres.length > 0 && (
            <div className="flex gap-2 flex-wrap sm:mb-3 justify-center sm:justify-start">
              {artist.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 bg-surface text-secondary rounded-full text-xs sm:text-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Mobile action buttons */}
      <div className="col-span-12 sm:hidden flex items-center justify-center gap-4">
        {artist.spotifyUrl && ( // Use spotifyUrl from SupabaseArtist
          <a
            href={artist.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <img src="/spotify-button.svg" alt="Listen on Spotify" className="h-10 w-auto" />
          </a>
        )}
        <button
          onClick={() => user ? setShowAddToListModal(true) : setShowAuthModal(true)}
          className="btn btn-primary flex items-center gap-1"
        >
          <MdFormatListBulletedAdd className="text-xl" /> Add to List
        </button>
      </div>

      {/* Main Content Area - This div will contain the two columns for desktop */}
      <div className="col-span-12 grid grid-cols-1 sm:grid-cols-12 sm:gap-8">
        {/* Left Column - Main Content */}
        <div className="col-span-12 sm:col-span-8">
          {/* Desktop Rating Distribution and Stats */}
          <div className="hidden sm:flex sm:flex-col md:flex-row mb-8 items-center justify-between xl:justify-start gap-3 flex-nowrap">
            <RatingDistributionChart reviews={reviewsData} />
            <div className="flex gap-3 lg:gap-5 py-2">
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-accent">{stats?.reviewCount || 0}</div>
                <div className="text-sm text-secondary">reviews</div>
              </div>
              <div className="flex items-center text-secondary text-4xl font-light">|</div>
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-accent">{stats?.listenCount || 0}</div>
                <div className="text-sm text-secondary">listens</div>
              </div>
              <div className="flex items-center text-secondary text-4xl font-light">|</div>
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-accent">{stats?.listCount || 0}</div>
                <div className="text-sm text-secondary">lists</div>
              </div>
            </div>
          </div>

          {/* Mobile Rating Distribution and Stats */}
          <div className="sm:hidden mb-4 flex flex-col items-center">
            <RatingDistributionChart reviews={reviewsData} />
            <div className="flex gap-5 px-4 py-4 items-center">
              <div className="text-center">
                <div className="text-xl font-bold text-accent">{stats?.reviewCount || 0}</div>
                <div className="text-xs text-secondary">reviews</div>
              </div>
              <div className="text-2xl text-secondary font-light">|</div>
              <div className="text-center">
                <div className="text-xl font-bold text-accent">{stats?.listenCount || 0}</div>
                <div className="text-xs text-secondary">listens</div>
              </div>
              <div className="text-2xl text-secondary font-light">|</div>
              <div className="text-center">
                <div className="text-xl font-bold text-accent">{stats?.listCount || 0}</div>
                <div className="text-xs text-secondary">lists</div>
              </div>
            </div>
            {recentRelease && (
              <div className="flex flex-col">
                <h3 className="text-base font-bold mb-3">Recent Release</h3>
                <Link
                  to={`/album/${generateSlug(`${recentRelease.artist} ${recentRelease.name}`, recentRelease.id)}`}
                  className="block hover:bg-white/5 transition-colors rounded-lg p-2 -m-2"
                >
                  {/* This div will now be a row on mobile, column on desktop */}
                  <div className="flex flex-row items-center gap-4 md:flex-col md:items-start md:gap-0">
                    <img
                      src={recentRelease.cover_url} // Use cover_url from Supabase Album
                      alt={recentRelease.name}
                      className="w-20 h-20 object-cover rounded flex-shrink-0" // Added flex-shrink-0
                    />
                    <div className="flex-1 min-w-0"> {/* Removed justify-center */}
                      <h4 className="font-medium text-lg truncate">{recentRelease.name}</h4>
                      <p className="text-sm text-secondary capitalize">{recentRelease.album_type}</p>
                      <p className="text-sm text-secondary">
                        {format(new Date(recentRelease.release_date), 'd MMM, yyyy')}
                      </p>
                      {recentReleaseStats && recentReleaseStats.averageRating > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={`text-xl ${
                                i < Math.round(recentReleaseStats.averageRating / 20) ? 'text-accent' : 'text-secondary'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                          <span className="text-sm text-secondary ml-1">
                            ({recentReleaseStats.averageRating}/100)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Top Reviews */}
          {topReviews.length > 0 ? (
            <div className="mb-8">
              <h2 className="text-xl lg:text-2xl font-bold mb-4">Top Reviews</h2>
              <div className="space-y-4">
                {topReviews.map((review) => (
                  <ReviewCardUnknown
                    key={review.id}
                    review={review}
                    onUpdate={() => {
                      // Refetch reviews if needed
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-3">Top Reviews</h2>
              <div className="p-6 bg-surface rounded-lg text-center">
                <h3 className="md:text-xl lg:text-2xl font-bold mb-2">No Reviews Yet</h3>
                <p className="text-sm md:text-base text-secondary mb-4">
                  Be the first to review an album by {artist.name}!
                </p>
                <Link to="/search" className="btn btn-primary text-sm md:text-base">
                  Browse Albums
                </Link>
              </div>
            </div>
          )}

          {/* Top Lists */}
          {topLists.length > 0 ? (
            <div className="sm:hidden mb-8">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-3">Top Lists Including {artist.name}</h2>
              <div className="space-y-4">
                {topLists.map((list) => (
                  <ListCard key={list.id} list={list} />
                ))}
              </div>
            </div>
          ) : (
            <div className="sm:hidden mb-8">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-3">Lists Including {artist.name}</h2>
              <div className="p-6 bg-surface rounded-lg text-center">
                <h3 className="md:text-xl lg:text-2xl font-bold mb-2">Not featured in any lists yet</h3>
                <p className="text-sm md:text-base text-secondary mb-4">
                  Be the first to add {artist.name} to a list!
                </p>
                <button
                  onClick={handleAddToList}
                  className="btn btn-primary text-sm md:text-base"
                >
                  Add to List
                </button>
              </div>
            </div>
          )}
          {/* Discography */}
          <ArtistDiscography albums={artist.albums} />
        </div>

        {/* Right Column - Actions and Similar Artists */}
        <div className="hidden sm:block col-span-4">
          <div className="space-y-5">
            
            {/* Actions (Desktop only) */}
            <div className="flex justify-center gap-4">
              {artist.spotifyUrl && ( // Use spotifyUrl from SupabaseArtist
                <a
                  href={artist.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img src="/spotify-button.svg" alt="Listen on Spotify" className="h-10 lg:h-12 w-auto" />
                </a>
              )}
            <button
              onClick={() => user ? setShowAddToListModal(true) : setShowAuthModal(true)}
              className="btn btn-primary flex items-center gap-1"
            >
              <MdFormatListBulletedAdd className="text-xl" /> 
              <span className="hidden lg:block">Add to List</span> {/* MODIFIED LINE */}
            </button>
            </div>

            {/* Recent Release */}
            {recentRelease && (
              <div className="hidden sm:block">
                <h3 className="text-lg font-bold mb-3">Recent Release</h3>
                <Link
                  to={`/album/${generateSlug(`${recentRelease.artist} ${recentRelease.name}`, recentRelease.id)}`}
                  className="block hover:bg-white/5 transition-colors rounded-lg p-2 -m-2"
                >
                  <div>
                    <img
                      src={recentRelease.cover_url} // Use cover_url from Supabase Album
                      alt={recentRelease.name}
                      className="w-full h-full object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xl truncate">{recentRelease.name}</h4>
                      <p className="text-sm text-secondary capitalize">{recentRelease.album_type}</p>
                      <p className="text-sm text-secondary">
                        {format(new Date(recentRelease.release_date), 'MMM d, yyyy')}
                      </p>
                      {recentReleaseStats && recentReleaseStats.averageRating > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={`text-xl ${
                                i < Math.round(recentReleaseStats.averageRating / 20) ? 'text-accent' : 'text-secondary'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                          <span className="text-sm text-secondary ml-1">
                            ({recentReleaseStats.averageRating}/100)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )}
          {/* Top Lists */}
          {topLists.length > 0 ? (
            <div className="mb-8">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-3">Top Lists Including {artist.name}</h2>
              <div className="space-y-4">
                {topLists.map((list) => (
                  <ListCard key={list.id} list={list} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-3">Lists Including {artist.name}</h2>
              <div className="p-6 bg-surface rounded-lg text-center">
                <h3 className="md:text-xl lg:text-2xl font-bold mb-2">Not featured in any lists yet</h3>
                <p className="text-sm md:text-base text-secondary mb-4">
                  Be the first to add {artist.name} to a list!
                </p>
                <button
                  onClick={handleAddToList}
                  className="btn btn-primary text-sm md:text-base"
                >
                  Add to List
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showAddToListModal && (
        <AddToListModal
          artistId={artistId}
          onClose={() => setShowAddToListModal(false)}
          showToast={showToast} // Pass showToast to AddToListModal
        />
      )}
    </div>
  );
}
