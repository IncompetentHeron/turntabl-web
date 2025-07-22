import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IoClose } from 'react-icons/io5';
import Avatar from './Avatar';
import { SuggestedProfile, toggleFollow, dismissSuggestion } from '../lib/supabase';
import { useUser } from '../hooks/useUser';

interface SuggestedProfileCardProps {
  profile: SuggestedProfile;
  onDismiss: (profileId: string) => void;
  onFollowSuccess?: () => void;
}

export default function SuggestedProfileCard({ profile, onDismiss, onFollowSuccess }: SuggestedProfileCardProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const followMutation = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] }); // Invalidate current user's profile to update following count
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] }); // Invalidate suggested user's profile to update follower count
      if (onFollowSuccess) {
        onFollowSuccess();
      }
    },
  });

  const handleFollow = async () => {
    if (!user) return; // Or show auth modal
    await followMutation.mutateAsync(profile.id);
  };

  const mutualFollowerText = () => {
    if (profile.mutual_followers_count === 0) return null;
    if (profile.mutual_followers_count === 1 && profile.first_mutual_follower_display_name) {
      return `Followed by ${profile.first_mutual_follower_display_name}`;
    }
    if (profile.mutual_followers_count > 1 && profile.first_mutual_follower_display_name) {
      return `Followed by ${profile.first_mutual_follower_display_name} ${profile.mutual_followers_count - 1} more`;
    }
    return `Followed by ${profile.mutual_followers_count} of your followers`;
  };

  return (
    <div className="bg-surface rounded-lg p-4 text-center relative">
      <button
        onClick={() => onDismiss(profile.id)}
        className="absolute top-2 right-2 text-secondary hover:text-primary"
        aria-label="Dismiss suggestion"
      >
        <IoClose size={18} />
      </button>
      <Link to={`/user/${profile.id}`} className="block">
        <Avatar
          url={profile.avatar_url}
          name={profile.display_name || profile.username}
          size="lg"
          className="mx-auto mb-3"
        />
        <h3 className="font-bold text-lg mb-1 truncate">
          {profile.display_name || profile.username}
        </h3>
        <p className="text-secondary text-sm mb-3 truncate">@{profile.username}</p>
      </Link>
      {mutualFollowerText() && (
        <p className="text-xs text-secondary mb-3">{mutualFollowerText()}</p>
      )}
      <button
        onClick={handleFollow}
        disabled={followMutation.isPending}
        className="btn btn-primary w-full"
      >
        {followMutation.isPending ? 'Following...' : 'Follow'}
      </button>
    </div>
  );
}
