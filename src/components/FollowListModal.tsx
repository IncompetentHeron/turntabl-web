import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { IoClose } from 'react-icons/io5';
import { getFollowers, getFollowing, toggleFollow } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import Avatar from './Avatar';

interface FollowListModalProps {
  userId: string;
  type: 'followers' | 'following';
  onClose: () => void;
}

export default function FollowListModal({ userId, type, onClose }: FollowListModalProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: [type, userId],
    queryFn: () => type === 'followers' ? getFollowers(userId) : getFollowing(userId),
    enabled: !!userId,
  });

  const followMutation = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers', userId] });
      queryClient.invalidateQueries({ queryKey: ['following', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;
    try {
      await followMutation.mutateAsync(targetUserId);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-surface p-6 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold capitalize">{type}</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary transition-colors"
          >
            <IoClose size={24} />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-secondary">Loading {type}...</p>
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-4">
            {users.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between">
                <Link
                  to={`/user/${profile.id}`}
                  className="flex items-center gap-3 flex-1 hover:bg-white/5 p-2 rounded-lg transition-colors"
                  onClick={onClose}
                >
                  <Avatar
                    url={profile.avatar_url}
                    name={profile.display_name || profile.username}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {profile.display_name || profile.username}
                    </h3>
                    <p className="text-secondary text-sm truncate">@{profile.username}</p>
                  </div>
                </Link>
                
                {user && user.id !== profile.id && (
                  <button
                    onClick={() => handleFollow(profile.id)}
                    disabled={followMutation.isPending}
                    className={`btn text-sm px-3 py-1 ${
                      profile.is_following ? 'btn-secondary' : 'btn-primary'
                    }`}
                  >
                    {profile.is_following ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-secondary">No {type} yet</p>
          </div>
        )}
      </div>
    </div>
  );
}