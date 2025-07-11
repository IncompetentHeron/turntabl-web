import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAlbum, getArtist, generateSlug } from '../lib/spotify';
import {
  getArtistStats,
  getArtistReviewsAggregate,
  getTopReviewsByArtist,
  getTopListsIncludingArtist,
  getAlbumStats
} from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import RatingDistributionChart from '../components/RatingDistributionChart';
import ArtistDiscography from '../components/ArtistDiscography';
import SimilarArtists from '../components/SimilarArtists';
import ReviewCardUnknown from '../components/ReviewCardUnknown';
import AddToListModal from '../components/AddToListModal';
import AuthModal from '../components/Auth';
import ListCard from '../components/ListCard';
import Avatar from '../components/Avatar'; // Import Avatar component
import { IoAdd } from 'react-icons/io5';
import { format, isAfter, subDays } from 'date-fns';

export default function Artist() {
  const { id } = useParams<{ id: string }>();
  const artistId = id?.split('-').pop() || '';
  const { user } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);

  const { data: artist, isLoading: artistLoading } = useQuery({
    queryKey: ['artist', artistId],
    queryFn: async () => {
      const artistData = await getArtist(artistId);
      if (!artistData) {
        throw new Error('Artist not found');
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-artist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ artist: artistData }),
        });

        if (!response.ok) {
          console.error('Error syncing artist:', await response.text());
        }
      } catch (error) {
        console.error('Error syncing artist:', error);
      }
      
      if (artistData.albums && artistData.albums.length > 0) {
        const syncPromises = artistData.albums.map(async (album) => {
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

      return artistData;
    },
    enabled: !!artistId,
  });

  const { data: stats } = useQuery({
    queryKey: ['artistStats', artistId],
    queryFn: () => getArtistStats(artistId),
    enabled: !!artistId,
  });

  const { data: reviewsData = [] } = useQuery({
    queryKey: ['artistReviewsAggregate', artistId],
    queryFn: () => getArtistReviewsAggregate(artistId),
    enabled: !!artistId,
  });

  const { data: topReviews = [] } = useQuery({
    queryKey: ['topReviewsByArtist', artistId],
    queryFn: () => getTopReviewsByArtist(artistId, 10),
    enabled: !!artistId,
  });

  const { data: topLists = [] } = useQuery({
    queryKey: ['topListsIncludingArtist', artistId],
    queryFn: () => getTopListsIncludingArtist(artistId, 5),
    enabled: !!artistId,
  });

  // Find recent release (within last 30 days)
  const recentRelease = artist?.albums.find(album => {
    const releaseDate = new Date(album.releaseDate);
    const thirtyDaysAgo = subDays(new Date(), 30);
    return isAfter(releaseDate, thirtyDaysAgo);
  });

  // Get stats for recent release
  const { data: recentReleaseStats } = useQuery({
    queryKey: ['albumStats', recentRelease?.id],
    queryFn: () => getAlbumStats(recentRelease!.id),
    enabled: !!recentRelease,
  });

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
      <div className="col-span-12 flex flex-col gap-3 md:flex-row md:gap-6 md:mb-3 items-center md:items-end">
        <div className="w-48 mx-auto flex-shrink-0">
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="w-full aspect-square rounded-full object-cover shadow-xl"
          />
        </div>

        <div className="flex-1 flex flex-col justify-end text-center md:text-left">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">{artist.name}</h1>
          {artist.genres.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4 justify-center md:justify-start">
              {artist.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 bg-surface text-secondary rounded-full text-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
          {artist.spotifyUrl && (
            <a
              href={`https://open.spotify.com/artist/${artistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:block"
            >
              <img src="/spotify-button.svg" alt="Listen on Spotify" className="h-10" />
            </a>
          )}
        </div>
      </div>

      {/* Mobile action buttons */}
      <div className="col-span-12 md:hidden flex items-center justify-center gap-4">
        {artist.albums.length > 0 && artist.albums[0].spotifyUrl && (
          <a
            href={`https://open.spotify.com/artist/${artistId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <img src="/spotify-button.svg" alt="Listen on Spotify" className="h-10 w-auto" />
          </a>
        )}

        <button
          onClick={handleAddToList}
          className="btn btn-primary flex items-center justify-center gap-2 h-10"
        >
          <IoAdd className="text-lg" />
          to list
        </button>
      </div>

      {/* Main Content Area - This div will contain the two columns for desktop */}
      <div className="col-span-12 grid grid-cols-1 md:grid-cols-12 md:gap-8">
        {/* Left Column - Main Content */}
        <div className="col-span-12 md:col-span-8">
          {/* Desktop Rating Distribution and Stats */}
          <div className="hidden sm:flex mb-8 items-center justify-center xl:justify-start gap-6 flex-nowrap">
            {reviewsData.length > 0 && (
              <RatingDistributionChart reviews={reviewsData} />
            )}
            <div className="flex gap-5 py-2">
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
            {reviewsData.length > 0 && (
              <RatingDistributionChart reviews={reviewsData} />
            )}
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
          </div>

          {/* Discography */}
          <ArtistDiscography albums={artist.albums} />

          {/* Top Reviews */}
          {topReviews.length > 0 ? (
            <div className="mb-8">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Top Reviews</h2>
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
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Top Reviews</h2>
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
            <div className="mb-8">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Top Lists Including {artist.name}</h2>
              <div className="space-y-4">
                {topLists.map((list) => (
                  <ListCard key={list.id} list={list} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Lists Including {artist.name}</h2>
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

        {/* Right Column - Actions and Similar Artists */}
        <div className="col-span-12 md:col-span-4">
          <div className="space-y-5">
            {/* Actions (Desktop only) */}
            <div className="hidden md:flex justify-center gap-2">
              {artist.albums.length > 0 && artist.albums[0].spotifyUrl && (
                <a
                  href={`https://open.spotify.com/artist/${artistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img src="/spotify-button.svg" alt="Listen on Spotify" className="h-10 w-auto" />
                </a>
              )}
              <button
                onClick={handleAddToList}
                className="btn btn-primary w-auto h-10 flex items-center justify-center gap-1"
              >
                <IoAdd className="text-xl" />
                to List
              </button>
            </div>

            {/* Recent Release */}
            {recentRelease && (
              <div>
                <h3 className="text-lg font-bold mb-3">Recent Release</h3>
                <Link
                  to={`/album/${generateSlug(`${recentRelease.artist} ${recentRelease.name}`, recentRelease.id)}`}
                  className="block hover:bg-white/5 transition-colors rounded-lg p-2 -m-2"
                >
                  <div>
                    <img
                      src={recentRelease.coverUrl}
                      alt={recentRelease.name}
                      className="w-full h-full object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xl truncate">{recentRelease.name}</h4>
                      <p className="text-sm text-secondary capitalize">{recentRelease.type}</p>
                      <p className="text-sm text-secondary">
                        {format(new Date(recentRelease.releaseDate), 'MMM d, yyyy')}
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

            {/* Similar Artists */}
            <SimilarArtists artistId={artistId} />
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
        />
      )}
    </div>
  );
}
