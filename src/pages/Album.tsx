import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isValid, parseISO } from 'date-fns';
import {
  getAlbumReviews,
  getAlbumLikes,
  getAlbumStats,
  toggleAlbumLike,
  getUserLists,
  deleteReview,
  toggleListenLater,
  getLastListen,
  isInListenLater,
  getSupabaseAlbum,
} from '../lib/supabase';
import { getAlbum as getSpotifyAlbum, getArtist, getArtistProfile } from '../lib/spotify'; // MODIFIED
import { useUser } from '../hooks/useUser';
import ReviewModal from '../components/ReviewModal';
import ReviewCardKnown from '../components/ReviewCardKnown';
import RatingDistributionChart from '../components/RatingDistributionChart';
import ListenModal from '../components/ListenModal';
import AddToListModal from '../components/AddToListModal';
import AuthModal from '../components/Auth';
import Avatar from '../components/Avatar';
import ListCard from '../components/ListCard';
import SimilarAlbums from '../components/SimilarAlbums';
import { IoHeart, IoHeadset, IoAdd, IoCheckmark } from 'react-icons/io5';
import { MdFormatListBulletedAdd } from 'react-icons/md';
import { ToastOptions } from '../hooks/useToast'; // Import ToastOptions

interface AlbumProps {
  showToast: (options: ToastOptions) => void; // Add showToast prop
}

export default function Album({ showToast }: AlbumProps) {
  const { slug } = useParams<{ slug: string }>();
  const albumId = slug?.split('-').pop() || '';
  const { user } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showListenModal, setShowListenModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [isAddingToList, setIsAddingToList] = useState(false);
  const queryClient = useQueryClient();

const { data: album, isLoading: albumLoading, error: albumError } = useQuery({
  queryKey: ['album', albumId],
  queryFn: async () => {
    // 1. Try to fetch from Supabase first
    let albumData = await getSupabaseAlbum(albumId);

    if (!albumData) {
      // 2. If not in Supabase, fetch from Spotify
      const spotifyAlbumData = await getSpotifyAlbum(albumId);
      if (!spotifyAlbumData) {
        throw new Error('Album not found on Spotify');
      }

      // 3. Asynchronously trigger sync to Supabase (fire-and-forget)
      // The UI will not wait for this to complete.
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-album`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ album: spotifyAlbumData }),
      }).then(response => {
        if (!response.ok) {
          console.warn('Error asynchronously syncing album:', response.status, response.statusText);
        }
      }).catch(syncError => {
        console.warn('Error triggering async sync-album function:', syncError);
      });

      // 4. Immediately return the Spotify data for display.
      // This is the key change for performance.
      // Ensure the returned object matches the 'Album' interface expected by the component.
      return {
        id: spotifyAlbumData.id,
        name: spotifyAlbumData.name,
        artist: spotifyAlbumData.artist,
        artist_id: spotifyAlbumData.artistId, // Map Spotify's artistId to Supabase's artist_id
        cover_url: spotifyAlbumData.coverUrl, // Map Spotify's coverUrl to Supabase's cover_url
        release_date: spotifyAlbumData.releaseDate,
        album_type: spotifyAlbumData.type,
        spotify_url: spotifyAlbumData.spotifyUrl,
        popularity: spotifyAlbumData.popularity,
        tracks: spotifyAlbumData.tracks,
        coverUrl: spotifyAlbumData.coverUrl, // Keep this for component usage
      };
    }
    // If albumData was found in Supabase, return it directly
    return albumData;
  },
  enabled: !!albumId,
  retry: 1,
});

// New query for artist data
const { data: artist, isLoading: artistDataLoading } = useQuery({
  queryKey: ['artist', album?.artist_id],
  queryFn: async () => {
    // 1. Try to fetch from Supabase first
    let artistData = await getSupabaseArtist(album!.artist_id);

    if (!artistData) {
      // 2. If not in Supabase, fetch from Spotify
      const spotifyArtistData = await getArtistProfile(album!.artist_id); // MODIFIED: Changed to getArtistProfile

      if (spotifyArtistData) {
        // 3. Asynchronously trigger sync to Supabase
        try {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-artist`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ artist: spotifyArtistData }),
          }).then(response => {
            if (!response.ok) {
              console.warn('Error asynchronously syncing artist:', response.status, response.statusText);
            }
          }).catch(syncError => {
            console.warn('Error triggering async sync-artist function:', syncError);
          });
        } catch (syncError) {
          console.warn('Error setting up async sync-artist function:', syncError);
        }
        return spotifyArtistData; // Return Spotify data for immediate display
      }
    }
    return artistData; // Return Supabase data if found, or null if neither found
  },
  enabled: !!album?.artist_id,
});



  const { data: likes } = useQuery({
    queryKey: ['albumLikes', albumId, user?.id],
    queryFn: () => getAlbumLikes(albumId),
    enabled: !!albumId,
  });

  const { data: stats } = useQuery({
    queryKey: ['albumStats', albumId],
    queryFn: () => getAlbumStats(albumId),
    enabled: !!albumId,
  });

  const { data: lists } = useQuery({
    queryKey: ['userLists', user?.id],
    queryFn: () => getUserLists(user!.id),
    enabled: !!user,
  });

  const { data: lastListen } = useQuery({
    queryKey: ['lastListen', albumId, user?.id],
    queryFn: () => getLastListen(user!.id, albumId),
    enabled: !!user && !!albumId,
  });

  const { data: inListenLater } = useQuery({
    queryKey: ['listenLater', albumId, user?.id],
    queryFn: () => isInListenLater(albumId),
    enabled: !!user && !!albumId,
  });

  const {
    data: reviews,
    isLoading: reviewsLoading,
    refetch: refetchReviews
  } = useQuery({
    queryKey: ['reviews', albumId],
    queryFn: () => getAlbumReviews(albumId),
    enabled: !!albumId,
  });

  const likeMutation = useMutation({
    mutationFn: () => toggleAlbumLike(albumId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albumLikes', albumId] });
    },
  });

  const listenLaterMutation = useMutation({
    mutationFn: () => toggleListenLater(albumId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listenLater', albumId] });
      queryClient.invalidateQueries({ queryKey: ['userListens', user?.id] });
      setIsAddingToList(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', albumId] });
      queryClient.invalidateQueries({ queryKey: ['albumStats', albumId] });
    },
  });

  const handleLike = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    likeMutation.mutate();
  };

  const handleListenLater = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (isAddingToList || listenLaterMutation.isPending) return;

    try {
      setIsAddingToList(true);
      await listenLaterMutation.mutateAsync();
    } catch (error) {
      console.error('Error toggling listen later:', error);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      await deleteMutation.mutateAsync(reviewId);
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };

  const formatReleaseDate = (dateString: string | undefined | null) => {
    if (!dateString) {
      return 'N/A';
    }
    
    // If it's a full date, format it normally
    const date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, 'dd/MM/yyyy');
    }

    // If it's just a year, return it as is
    if (/^\d{4}$/.test(dateString)) {
      return dateString;
    }

    // If it's a year-month, format accordingly
    if (/^\d{4}-\d{2}$/.test(dateString)) {
      const yearMonthDate = parseISO(dateString + '-01');
      if (isValid(yearMonthDate)) { // Ensure the new date is valid
        return format(yearMonthDate, 'MMMM yyyy');
      }
    }

    // Fallback
    return dateString;
  };

  if (albumLoading || reviewsLoading) { // Added artistDataLoading
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Loading...</div>
      </div>
    );
  }

  if (albumError || !album) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Album not found</div>
      </div>
    );
  }

  const userReviews = user ? reviews?.filter(r => r.user_id === user.id) || [] : [];
  const followedReviews = user ? reviews?.filter(r => {
    const review = r as any;
    return r.user_id !== user.id && review.profile?.is_followed_by_user;
  }) || [] : [];
  const topReviews = reviews
    ?.filter(r => !userReviews.includes(r) && !followedReviews.includes(r))
    .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    .slice(0, 3) || [];

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Album Header - spans full width */}
      <div className="col-span-12 flex flex-col gap-3 bg-gradient-to-t from-surface2/50 to-background rounded-b-lg p-6 md:flex-row md:gap-6 md:mb-3 items-center md:items-end">
        <div className="w-48 mx-auto flex-shrink-0">
          <img
            src={album.coverUrl}
            alt={album.name}
            className="w-full rounded-lg shadow-xl"
          />
        </div>

        <div className="flex-1 flex flex-col justify-end text-center md:text-left">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">{album.name}</h1>
             <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
              {/* DEBUGGING: Log the artist object and its imageUrl */}
              {console.log('DEBUG: Artist object:', artist)}
              {console.log('DEBUG: Artist imageUrl:', artist?.imageUrl)}
            
              {/* Always link to artist page, conditionally show image or initials fallback */}
              <Link to={`/artist/${album.artist_id}`} className="flex items-center gap-2">
                {artist && artist.imageUrl ? ( // Only show img if artist object and imageUrl exist
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  // Fallback for when artist.imageUrl is missing, but artist object exists
                  artist && (
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-bold">
                      {(artist.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )
                )}
                <span className="text-base md:text-lg font-bold hover:text-accent transition-colors">
                  {album.artist}
                </span>
              </Link>
            </div>
          <div className="flex items-center justify-center md:justify-start gap-2 md:gap-4 text-sm md:text-md md:mb-3">
            <span className="text-secondary capitalize">{album.album_type}</span>
            <span className="text-secondary">•</span>
            <span className="text-secondary">
              {formatReleaseDate(album.release_date)}
            </span>
            <span className="text-secondary">•</span>
            <span className="text-secondary">
          {(album.tracks?.length || 0)} tracks, {Math.floor((album.tracks || []).reduce((acc, track) => acc + track.duration, 0) / 60)} min
            </span>
          </div>

          {/* Desktop-only action buttons (Like, Add to List, Listen Later, Spotify) */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`btn ${likes?.isLiked ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2`}
              disabled={likeMutation.isPending}
            >
              <span className="text-xl"> <IoHeart/></span>
              <span>{likes?.count || 0}</span>
            </button>
            <button
              onClick={() => user ? setShowAddToListModal(true) : setShowAuthModal(true)}
              className="btn btn-primary flex items-center gap-1"
            >
              <MdFormatListBulletedAdd className="text-xl" /> Add to List
            </button>
            <motion.button
              onClick={handleListenLater}
              className={`btn relative overflow-hidden ${inListenLater ? 'btn-secondary' : 'btn-primary'}`}
              disabled={listenLaterMutation.isPending}
              whileTap={{ scale: 0.95 }}
            >
              <AnimatePresence mode="wait">
                {inListenLater ? (
                  <motion.div
                    key="check"
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    exit={{ y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1"
                  >
                    <IoHeadset className="text-xl"/>
                    <span>Listen Later</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="add"
                    initial={{ y: -20 }}
                    animate={{ y: 0 }}
                    exit={{ y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1"
                  >
                    <IoAdd className="text-xl" />
                    <span>Listen Later</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            {album.spotifyUrl && (
              <a
                href={album.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src="/spotify-button.svg" alt="Listen on Spotify" className="h-10" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Mobile action buttons */}
      <div className="col-span-12 md:hidden flex items-center justify-center gap-4">
        <button
          onClick={handleLike}
          className={`btn ${likes?.isLiked ? 'btn-secondary' : 'btn-primary'} flex items-center justify-center h-10 gap-1`}
          disabled={likeMutation.isPending}
        >
          <span className="text-lg"> <IoHeart/></span>
          <span>{likes?.count || 0}</span>
        </button>
        <button
          onClick={() => user ? setShowAddToListModal(true) : setShowAuthModal(true)}
          className="btn btn-primary flex items-center justify-center h-10"
        >
          <MdFormatListBulletedAdd className="text-lg" />
        </button>
        <motion.button
          onClick={handleListenLater}
          className={`btn relative overflow-hidden ${inListenLater ? 'btn-secondary' : 'btn-primary'} flex items-center justify-center h-10`}
          disabled={listenLaterMutation.isPending}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {inListenLater ? (
              <motion.div
                key="check"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                exit={{ y: -20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center h-full gap-1"
              >
                <IoCheckmark className="text-lg"/>
              </motion.div>
            ) : (
              <motion.div
                key="add"
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                exit={{ y: 20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center h-full gap-1"
              >
                <IoHeadset className="text-lg" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
        {album.spotifyUrl && (
          <a
            href={album.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-10"
          >
            <img src="/spotify-logo.svg" alt="Listen on Spotify" className="btn bg-accent2 h-full object-contain" />
          </a>
        )}
      </div>

      {/* Main Content Area - This div will contain the two columns for desktop */}
      <div className="col-span-12 grid grid-cols-1 md:grid-cols-12 md:gap-8">
        {/* Left Column - Main Content (Reviews, Stats, Featured Lists) */}
        <div className="col-span-12 md:col-span-8">
          {/* Desktop Rating Distribution and Stats */}
          <div className="hidden sm:flex mb-8 items-center justify-center xl:justify-start gap-6 flex-nowrap">
            <RatingDistributionChart reviews={reviews} />
            <div className="flex gap-5 py-2">
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-accent">{stats?.reviewCount || 0}</div>
                <div className="text-sm text-secondary">reviews</div>
              </div>
              <div className="flex items-center text-secondary text-4xl font-light">|</div>
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-accent">{stats?.listCount || 0}</div>
                <div className="text-sm text-secondary">lists</div>
              </div>
              <div className="flex items-center text-secondary text-4xl font-light">|</div>
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold text-accent">{stats?.listenCount || 0}</div>
                <div className="text-sm text-secondary">listens</div>
              </div>
            </div>
          </div>

          {/* Mobile Rating Distribution and Stats */}
          <div className="sm:hidden mb-4 flex flex-col items-center">
            <RatingDistributionChart reviews={reviews} />
            <div className="flex gap-5 px-4 py-4 items-center">
              <div className="text-center">
                <div className="text-xl font-bold text-accent">{stats?.reviewCount || 0}</div>
                <div className="text-xs text-secondary">reviews</div>
              </div>
              <div className="text-2xl text-secondary font-light">|</div>
              <div className="text-center">
                <div className="text-xl font-bold text-accent">{stats?.listCount || 0}</div>
                <div className="text-xs text-secondary">lists</div>
              </div>
              <div className="text-2xl text-secondary font-light">|</div>
              <div className="text-center">
                <div className="text-xl font-bold text-accent">{stats?.listenCount || 0}</div>
                <div className="text-xs text-secondary">listens</div>
              </div>
            </div>
          </div>

          <div className="col-span-12 md:hidden space-y-4 mb-8">
            {user ? (
              <>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="btn btn-primary text-sm w-full"
                >
                  Write a Review
                </button>
                <button
                  onClick={() => setShowListenModal(true)}
                  className="btn btn-secondary text-sm w-full"
                >
                  Log Listen
                </button>
                {lastListen && (
                  <p className="text-sm text-secondary text-center">
                    Last listen: {format(new Date(lastListen.listened_at), 'MMM d, yyyy')}
                  </p>
                )}
              </>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="btn btn-primary w-full"
          >
            Sign in to Review
          </button>
        )}
      </div>
          {/* Review Sections */}
          {user ? (
            <>
              {followedReviews.length > 0 ? (
                <div className="mb-8">
                  <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Reviews From Your Community</h2>
                  <div className="space-y-4">
                    {followedReviews.map((review) => (
                      <ReviewCardKnown
                        key={review.id}
                        review={review}
                        onUpdate={refetchReviews}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-8">
                  <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Reviews from your community</h2>
                  <div className="p-6 bg-surface rounded-lg text-center">
                    <h3 className="md:text-lg lg:text-xl font-bold mb-2">No reviews from your community yet</h3>
                    <p className="text-sm text-secondary mb-4">
                      Follow more users to see what albums they're reviewing.
                    </p>
                    <Link to="/search/users" className="btn btn-primary text-sm">
                      Find users to follow
                    </Link>
                  </div>
                </div>
              )}

              {topReviews.length > 0 ? (
                <div className="mb-8">
                  <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Top Reviews</h2>
                  <div className="space-y-4">
                    {topReviews.map((review) => (
                      <ReviewCardKnown
                        key={review.id}
                        review={review}
                        onUpdate={refetchReviews}
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
                      Be the first to review this album!
                    </p>
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="btn btn-primary text-sm md:text-base"
                    >
                      Write First Review
                    </button>
                  </div>
                </div>
              )}

              {userReviews.length > 0 ? (
                <div className="mb-8">
                  <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Your Reviews</h2>
                  <div className="space-y-4">
                    {userReviews.map((review) => (
                      <ReviewCardKnown
                        key={review.id}
                        review={review}
                        onUpdate={refetchReviews}
                        onDelete={handleDeleteReview}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-8">
                  <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Your Reviews</h2>
                  <div className="p-6 bg-surface rounded-lg text-center">
                    <h3 className="md:text-xl lg:text-2xl font-bold mb-2">You haven't reviewed this album yet</h3>
                    <p className="text-sm md:text-base text-secondary mb-4">
                      Share your thoughts about this album with the community.
                    </p>
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="btn btn-primary text-sm md:text-base"
                    >
                      Write Your Review
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Top Reviews</h2>
                {topReviews.length > 0 ? (
                  <div className="space-y-4">
                    {topReviews.map((review) => (
                      <ReviewCardKnown
                        key={review.id}
                        review={review}
                        onUpdate={refetchReviews}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary md:text-xl lg:text-2xl font-bold">No reviews yet. Be the first to review!</p>
                )}

                <div className="mt-8 p-6 bg-surface rounded-lg text-center">
                  <h3 className="md:text-xl lg:text-2xl font-bold mb-2">Join The Conversation</h3>
                  <p className="text-sm md:text-base text-secondary mb-4">
                    Sign up to share your thoughts, follow other reviewers, and build your music collection.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="btn btn-primary text-sm md:text-base"
                    >
                      Sign Up
                    </button>
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="btn btn-secondary text-sm md:text-base"
                    >
                      Log In
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Featured in Lists */}
          <div className="mb-4">
            <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-4">Featured In Lists</h2>
            {lists?.filter(list =>
              list.id !== 'liked-albums-list' &&
              list.list_items?.some(item => item.album_id === albumId)
            ).length > 0 ? (
              <div className="space-y-4">
                {lists
                  .filter(list =>
                    list.id !== 'liked-albums-list' &&
                    list.list_items?.some(item => item.album_id === albumId)
                  )
                  .map(list => (
                    <ListCard key={list.id} list={list} />
                  ))}
              </div>
            ) : (
              <div className="p-6 bg-surface rounded-lg text-center">
                <h3 className="md:text-xl lg:text-2xl font-bold mb-2">Not featured in any lists yet</h3>
                <p className="text-sm md:text-base text-secondary mb-4">
                  Be the first to add this album to a list!
                </p>
                <button
                  onClick={() => user ? setShowAddToListModal(true) : setShowAuthModal(true)}
                  className="btn btn-primary text-sm md:text-base"
                >
                  Add to List
                </button>
              </div>
            )}
          </div>
        </div>


        {/* Right Column - Desktop-only Review/Listen buttons and Tracklist */}
        <div className="col-span-12 md:col-span-4">
          <div className="space-y-6">
            {user ? (
              <div className="space-y-4 hidden md:block">
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="btn btn-primary w-full"
                >
                  Write a Review
                </button>
                <button
                  onClick={() => setShowListenModal(true)}
                  className="btn btn-secondary w-full"
                >
                  Log Listen
                </button>
                {lastListen && (
                  <p className="text-sm text-secondary text-center">
                    Last listen: {format(new Date(lastListen.listened_at), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="btn btn-primary w-full"
              >
                Sign in to Review
              </button>
            )}

            <div>
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-2 md:mb-4">Tracklist</h2>
              <div className="space-y-2">
                {(album.tracks || []).map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between py-2 px-4 bg-surface rounded text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-secondary flex-shrink-0">{track.trackNumber}</span>
                      <span className="truncate overflow-hidden text-ellipsis whitespace-nowrap">{track.name}</span>
                    </div>
                    <span className="text-secondary ml-2 flex-shrink-0">
                      {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      <ReviewModal
        albumId={albumId}
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => {
          refetchReviews();
          queryClient.invalidateQueries({ queryKey: ['albumStats', albumId] });
          setShowReviewModal(false);
        }}
      />

      {showListenModal && (
        <ListenModal
          albumId={albumId}
          onClose={() => setShowListenModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lastListen', albumId, user?.id] });
            queryClient.invalidateQueries({ queryKey: ['userListens', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['albumStats', albumId] });
            setShowListenModal(false);
          }}
        />
      )}

      {showAddToListModal && (
        <AddToListModal
          albumId={albumId}
          onClose={() => setShowAddToListModal(false)}
          showToast={showToast} // Pass showToast to AddToListModal
        />
      )}
    </div>
  );
}
