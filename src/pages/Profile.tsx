// src/pages/Profile.tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, getUserReviews, toggleFollow, getUserLists, getUserListens } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { IoSettingsOutline, IoCheckmark } from 'react-icons/io5';
import * as Tabs from '@radix-ui/react-tabs';
import ProfileForm from '../components/ProfileForm';
import ProfileMenu from '../components/ProfileMenu';
import ReviewFeed from '../components/ReviewFeed';
import ListFeed from '../components/ListFeed';
import ListenGrid from '../components/ListenGrid';
import ListenCalendar from '../components/ListenCalendar';
import ListensFeed from '../components/ListensFeed';
import FollowListModal from '../components/FollowListModal';
import FollowSuggestionsCarousel from '../components/FollowSuggestionsCarousel';
import Avatar from '../components/Avatar';
import { useToast, ToastOptions } from '../hooks/useToast';
import ListenLaterSection from '../components/ListenLaterSection'; // Import the new component

interface ListensFeedProps {
  listens: Listen[];
  listenLater: Listen[];
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFollowListModal, setShowFollowListModal] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [avatarSize, setAvatarSize] = useState<'sm' | 'md' | 'lg'>('lg');
  const [listenViewMode, setListenViewMode] = useState<'feed' | 'grid' | 'calendar'>('feed');
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  console.log('Profile component rendered. isEditing:', isEditing);

  // Responsive avatar sizing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setAvatarSize('md');
      } else if (window.innerWidth < 1024) {
        setAvatarSize('lg');
      } else {
        setAvatarSize('lg');
      }
    };

    handleResize(); // Set initial size
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id!),
    enabled: !!id,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['userReviews', id],
    queryFn: () => getUserReviews(id!),
    enabled: !!id,
  });

  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ['userLists', id],
    queryFn: () => getUserLists(id!),
    enabled: !!id,
  });


  const { data: listensData, isLoading: listensLoading } = useQuery({ // Renamed to listensData
    queryKey: ['userListens', id],
    queryFn: () => getUserListens(id!),
    enabled: !!id && user?.id === id,
  });

  const followMutation = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', id] });
      if (profile?.is_following) {
        showToast({ title: 'Unfollowed!', description: `You are no longer following ${profile.display_name || profile.username}.` });
      } else {
        showToast({ title: 'Followed!', description: `You are now following ${profile?.display_name || profile?.username}.` });
      }
    },
  });

  const handleFollowersClick = () => {
    setFollowListType('followers');
    setShowFollowListModal(true);
  };

  const handleFollowingClick = () => {
    setFollowListType('following');
    setShowFollowListModal(true);
  };

  if (profileLoading || reviewsLoading || listsLoading || (user?.id === id && listensLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Profile not found</div>
      </div>
    );
  }

  const isOwnProfile = user?.id === profile.id;
  const isFriend = profile.is_following && profile.is_followed_by_user;

  const getFollowButtonText = () => {
    if (isFriend) return 'Friends';
    if (profile.is_following) return 'Following';
    if (profile.is_followed_by_user) return 'Follow Back';
    return 'Follow';
  };

  return (
    <div className="mx-auto">
      <div>
        {/* Desktop Layout (md and up) */}
        <div className="hidden md:block">
          <div className="flex justify-between items-center mb-4">
            {/* Left: Avatar + Profile Info */}
            <div className="flex items-start gap-6">
              <Avatar
                url={profile.avatar_url}
                name={profile.display_name || profile.username}
                size={avatarSize}
              />
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2 mb-2">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">{profile.display_name}</h1>
                  {profile.pronouns && (
                    <span className="text-secondary text-sm">{profile.pronouns}</span>
                  )}
                </div>
                <p className="text-secondary text-sm">@{profile.username}</p>
              </div>

            </div>
            {/* Right: Stats (Review, Follower, Following) */}
            <div className="flex items-center gap-4"> {/* Stats in a row */}
              <div className="flex flex-col items-center"> {/* Single stat column */}
                <div className="text-2xl font-bold">{profile.review_count || 0}</div>
                <div className="text-secondary">Reviews</div>
              </div>
              <div className="flex flex-col items-center">
                <button onClick={handleFollowersClick} className="text-2xl font-bold hover:text-accent transition-colors">
                  {profile.follower_count}
                </button>
                <div className="text-secondary">Followers</div>
              </div>
              <div className="flex flex-col items-center">
                <button onClick={handleFollowingClick} className="text-2xl font-bold hover:text-accent transition-colors">
                  {profile.following_count}
                </button>
                <div className="text-secondary">Following</div>
              </div>
            </div>
            {/* Settings/Follow Buttons & Carousel (Desktop) */}
            <div className="flex justify-end items-center gap-4 mb-4">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => {
                      console.log('setIsMenuOpen(true) called');
                      setIsMenuOpen(!isMenuOpen);
                    }}
                    className="p-3 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <IoSettingsOutline className="text-2xl" />
                  </button>
                  <ProfileMenu
                    isOpen={isMenuOpen}
                    onClose={() => {
                      console.log('ProfileMenu onClose called');
                      setIsMenuOpen(false);
                    }}
                    onEditClick={() => {
                      console.log('setIsEditing(true) called');
                      setIsEditing(true);
                    }}
                    profile={profile}
                  />
                </>
              ) : (
                <button
                  onClick={() => followMutation.mutate(profile.id)}
                  className={`btn flex items-center gap-2 ${
                    profile.is_following ? 'border border-white/20 bg-transparent hover:bg-white/5' : 'btn-primary'
                  }`}
                  disabled={followMutation.isPending}
                >
                  {getFollowButtonText()}
                </button>
              )}
              {isOwnProfile && (
                <FollowSuggestionsCarousel />
              )}
            </div>
          </div>


          {/* Bio (Desktop) */}
          {profile.bio && (
            <p className="text-sm md:text-md mt-4 mb-4">{profile.bio}</p>
          )}
        </div>

        {/* Mobile Layout (below md) */}
        <div className="block md:hidden">
          {/* Top Row: Avatar and Stats */}
          <div className="flex items-center justify-start gap-4 mb-4">
            <Avatar
              url={profile.avatar_url}
              name={profile.display_name || profile.username}
              size="md" // Base size
              className="sm:w-24 sm:h-24 sm:text-3xl" // Override for sm breakpoint and up
            />
            <div className="flex items-center gap-3"> {/* Stats in a row */}
              <div className="flex flex-col items-center"> {/* Single stat column */}
                <div className="text-lg sm:text-2xl font-bold">{profile.review_count || 0}</div>
                <div className="text-xs sm:text-base text-secondary">Reviews</div>
              </div>
              <div className="flex flex-col items-center">
                <button onClick={handleFollowersClick} className="text-lg sm:text-2xl font-bold hover:text-accent transition-colors">
                  {profile.follower_count}
                </button>
                <div className="text-xs sm:text-base text-secondary">Followers</div>
              </div>
              <div className="flex flex-col items-center">
                <button onClick={handleFollowingClick} className="text-lg sm:text-2xl font-bold hover:text-accent transition-colors">
                  {profile.following_count}
                </button>
                <div className="text-xs sm:text-base text-secondary">Following</div>
              </div>
            </div>
          </div>

          {/* Profile Info (Display Name, Username, Pronouns) */}
          <div className="mb-4 text-left">
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg font-bold">{profile.display_name}</h1>
              {profile.pronouns && (
                <span className="text-secondary text-sm">{profile.pronouns}</span>
              )}
            </div>
            <p className="text-secondary text-sm">@{profile.username}</p>
          </div>

          {/* Bio (Mobile) */}
          {profile.bio && (
            <p className="text-sm mb-4">{profile.bio}</p>
          )}

          {/* Follow Suggestions Carousel (Mobile) */}
          {isOwnProfile && (
            <FollowSuggestionsCarousel />
          )}
        </div>

        {/* Settings/Follow Button */}
        <div className="flex justify-center mb-4 block md:hidden">
          {isOwnProfile ? (
            <>
              <button
                onClick={() => {
                  console.log('setIsMenuOpen(true) called');
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="btn btn-secondary bg-surface2 w-full text-sm" // Full width button
              >
                Edit Profile
              </button>
              <ProfileMenu
                isOpen={isMenuOpen}
                onClose={() => {
                  console.log('ProfileMenu onClose called');
                  setIsMenuOpen(false);
                }}
                onEditClick={() => {
                  console.log('setIsEditing(true) called');
                  setIsEditing(true);
                }}
                profile={profile}
              />
            </>
          ) : (
            <button
              onClick={() => followMutation.mutate(profile.id)}
              className={`btn w-full ${
                profile.is_following ? 'btn-secondary' : 'btn-primary'
              }`}
              disabled={followMutation.isPending}
            >
              {getFollowButtonText()}
            </button>
          )}
        </div>

        {isEditing ? (
          <ProfileForm
            profile={profile}
            onSuccess={() => {
              console.log('ProfileForm onSuccess called');
              setIsEditing(false);
              queryClient.invalidateQueries({ queryKey: ['profile', id] });
              showToast({ title: 'Profile Updated!', description: 'Your profile changes have been saved.' });
            }}
            onCancel={() => {
              console.log('ProfileForm onCancel called');
              setIsEditing(false);
            }}
            showToast={showToast}
          />
        ) : null}
      </div>

      <Tabs.Root defaultValue="reviews">
        <Tabs.List className="flex border-b border-white/10 mb-4">
          <Tabs.Trigger
            value="reviews"
            className={`flex-1 py-3 text-center text-secondary data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-accent ${
              isOwnProfile ? 'w-1/3' : 'w-1/2'
            }`}
          >
            Reviews
          </Tabs.Trigger>
          <Tabs.Trigger
            value="lists"
            className={`flex-1 py-3 text-center text-secondary data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-accent ${
              isOwnProfile ? 'w-1/3' : 'w-1/2'
            }`}
          >
            Lists
          </Tabs.Trigger>
          {isOwnProfile && (
            <Tabs.Trigger
              value="listens"
              className="flex-1 w-1/3 py-3 text-center text-secondary data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-accent"
            >
              Listens
            </Tabs.Trigger>
          )}
        </Tabs.List>

        <Tabs.Content value="reviews">
          {reviews && reviews.length > 0 ? (
            <ReviewFeed
              reviews={reviews}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ['userReviews', id] })}
            />
          ) : (
            <div className="text-center py-8 text-secondary">
              No reviews yet
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="lists">
          {lists && lists.length > 0 ? (
            <ListFeed lists={lists} />
          ) : (
            <div className="text-center py-8 text-secondary">
              No lists yet
            </div>
          )}
        </Tabs.Content>

        {isOwnProfile && (
          <Tabs.Content value="listens">
            {listensData && ( // Ensure listensData is available
              <ListenLaterSection listenLater={listensData.listenLater} />
            )}

            {listensData && listensData.listens.length > 0 ? (
              <>
                <div className="flex justify-end gap-2 mb-4">
                  <button
                    onClick={() => setListenViewMode('feed')}
                    className={`btn btn-xs ${listenViewMode === 'feed' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Feed
                  </button>
                  <button
                    onClick={() => setListenViewMode('grid')}
                    className={`btn btn-sm ${listenViewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setListenViewMode('calendar')}
                    className={`btn btn-sm ${listenViewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Calendar
                  </button>
                </div>

                {listenViewMode === 'feed' && (
                  <ListensFeed
                    listens={listensData.listens}
                    listenLater={listensData.listenLater}
                  />
                )}
                {listenViewMode === 'grid' && (
                  <ListenGrid listens={listensData.listens} />
                )}
                {listenViewMode === 'calendar' && (
                  <ListenCalendar listens={listensData.listens} />
                )}
              </>
            ) : (
              <div className="text-center py-8 text-secondary">
                No listening history yet.
              </div>
            )}
          </Tabs.Content>
        )}
      </Tabs.Root>

      {showFollowListModal && (
        <FollowListModal
          userId={profile.id}
          type={followListType}
          onClose={() => setShowFollowListModal(false)}
        />
      )}
    </div>
  );
}
