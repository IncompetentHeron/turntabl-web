import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchUsers, toggleFollow } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import Avatar from './Avatar';

export default function HallOfFame() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['topUsers'],
    queryFn: () => searchUsers(''), // TODO: Replace with actual top users endpoint
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const followMutation = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topUsers'] });
    },
  });

  const handleFollow = async (userId: string) => {
    if (!user) return;
    try {
      await followMutation.mutateAsync(userId);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-secondary">Loading top users...</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-2 md:mb-6">
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold">Hall of Fame</h2>
        <Link 
          to="/users"
          className="btn btn-secondary text-sm md:text-base lg:text-lg hover:text-accent2 transition-colors"
        >
          See all
        </Link>
      </div>
      <div className="flex flex-row overflow-x-auto lg:grid grid-cols-5 gap-4">
        {users.slice(0, 6).map((profile) => (
          <div
            key={profile.id}
            className="bg-surface rounded-lg p-4 text-center hover:bg-white/5 transition-colors"
          >
            <Avatar
              url={profile.avatar_url}
              name={profile.display_name || profile.username}
              size="lg" 
              className="mx-auto mb-3" 
            />
            <h3 className="font-semibold mb-1 line-clamp-1">
              {profile.display_name || profile.username}
            </h3>
            <p className="text-sm text-secondary mb-3"> {/* Adjust margin-bottom */}
              {profile.follower_count || 0} followers • {profile.review_count || 0} reviews {/* Add review count */}
            </p>

            <div className="flex gap-2">
              {user && user.id !== profile.id && (
                <button
                  onClick={() => handleFollow(profile.id)}
                  disabled={followMutation.isPending}
                  className="btn btn-primary text-sm px-3 py-1 flex-1" // Adjust classes
                >
                  Follow
                </button>
              )}
              <Link
                to={`/user/${profile.id}`}
                className="btn btn-secondary bg-surface2 text-sm px-3 py-1 flex-1" // Adjust classes
              >
                Profile
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}