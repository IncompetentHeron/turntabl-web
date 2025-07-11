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
import ListensFeed from '../components/ListensFeed';
import FollowListModal from '../components/FollowListModal';
import Avatar from '../components/Avatar';

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFollowListModal, setShowFollowListModal] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [avatarSize, setAvatarSize] = useState<'sm' | 'md' | 'lg'>('lg');
  const queryClient = useQueryClient();

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

  const { data: listens, isLoading: listensLoading } = useQuery({
    queryKey: ['userListens', id],
    queryFn: () => getUserListens(id!),
    enabled: !!id && user?.id === id,
  });

  const followMutation = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', id] });
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-surface rounded-lg p-8 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-6">
            <Avatar
              url={profile.avatar_url}
              name={profile.display_name || profile.username}
              size={avatarSize}
            />
            <div>
              <h1 className="text-3xl font-bold mb-1">{profile.display_name}</h1>
              <p className="text-secondary mb-1">@{profile.username}</p>
              {profile.pronouns && (
                <p className="text-secondary mb-2">{profile.pronouns}</p>
              )}
              <div className="flex gap-4 text-sm">
                <button
                  onClick={handleFollowersClick}
                  className="hover:text-accent transition-colors"
                >
                  {profile.followers_count} followers
                </button>
                <button
                  onClick={handleFollowingClick}
                  className="hover:text-accent transition-colors"
                >
                  {profile.following_count} following
                </button>
              </div>
            </div>
          </div>
          
          <div className="relative">
            {isOwnProfile ? (
              <>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-3 hover:bg-white/5 rounded-full transition-colors"
                >
                  <IoSettingsOutline className="text-2xl" />
                </button>
                <ProfileMenu
                  isOpen={isMenuOpen}
                  onClose={() => setIsMenuOpen(false)}
                  onEditClick={() => setIsEditing(true)}
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
                {profile.is_following && <IoCheckmark className="text-lg" />}
                {getFollowButtonText()}
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <ProfileForm
            profile={profile}
            onSuccess={() => {
              setIsEditing(false);
              queryClient.invalidateQueries({ queryKey: ['profile', id] });
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          profile.bio && (
            <p className="text-lg mt-4">{profile.bio}</p>
          )
        )}
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
            {listens ? (
              <ListensFeed
                listens={listens.listens}
                listenLater={listens.listenLater}
              />
            ) : (
              <div className="text-center py-8 text-secondary">
                No listening history yet
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