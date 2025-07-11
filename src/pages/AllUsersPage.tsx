import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAllUsers, toggleFollow } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import Avatar from '../components/Avatar';
import { IoGridOutline, IoListOutline, IoFunnelOutline } from 'react-icons/io5';

type SortOption = 'followers' | 'recent' | 'reviews';
type ViewMode = 'grid' | 'list';

export default function AllUsersPage() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('followers');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['allUsers', page, sortBy],
    queryFn: () => getAllUsers(page, 20),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const followMutation = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
  });

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setPage(1); // Reset to first page when sorting changes
  };

  const handleFollow = async (userId: string) => {
    if (!user) return;
    try {
      await followMutation.mutateAsync(userId);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Error loading users</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">All Users</h1>
          <p className="text-secondary">Discover and connect with music lovers</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
              }`}
            >
              <IoGridOutline size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
              }`}
            >
              <IoListOutline size={20} />
            </button>
          </div>

          {/* Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <IoFunnelOutline size={20} />
            Filters
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-surface rounded-lg p-6 mb-8">
          <h3 className="text-lg font-bold mb-4">Sort by</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'followers', label: 'Most Followers' },
              { key: 'recent', label: 'Recently Joined' },
              { key: 'reviews', label: 'Most Reviews' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSortChange(key as SortOption)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  sortBy === key
                    ? 'bg-accent text-white'
                    : 'bg-surface2 text-secondary hover:text-primary hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-xl text-secondary">Loading users...</div>
        </div>
      ) : users.length > 0 ? (
        <>
          {/* Users Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {users.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-surface rounded-lg p-6 text-center hover:bg-white/5 transition-colors"
                >
                  <Link to={`/user/${profile.id}`}>
                    <Avatar
                      url={profile.avatar_url}
                      name={profile.display_name || profile.username}
                      size="lg"
                      className="mx-auto mb-4"
                    />
                    <h3 className="font-bold text-lg mb-1 truncate">
                      {profile.display_name || profile.username}
                    </h3>
                    <p className="text-secondary text-sm mb-3 truncate">@{profile.username}</p>
                  </Link>
                  <div className="text-xs text-secondary mb-4">
                    {profile.follower_count || 0} followers • {profile.review_count || 0} reviews
                  </div>
                  <div className="flex gap-2">
                    {user && user.id !== profile.id && (
                      <button
                        onClick={() => handleFollow(profile.id)}
                        disabled={followMutation.isPending}
                        className="btn btn-primary text-sm px-3 py-1 flex-1"
                      >
                        Follow
                      </button>
                    )}
                    <Link
                      to={`/user/${profile.id}`}
                      className="btn btn-secondary text-sm px-3 py-1 flex-1"
                    >
                      Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 bg-surface rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Link
                    to={`/user/${profile.id}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    <Avatar
                      url={profile.avatar_url}
                      name={profile.display_name || profile.username}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">
                        {profile.display_name || profile.username}
                      </h3>
                      <p className="text-secondary text-sm truncate">@{profile.username}</p>
                      <p className="text-xs text-secondary">
                        {profile.follower_count || 0} followers • {profile.review_count || 0} reviews
                      </p>
                    </div>
                  </Link>
                  
                  <div className="flex gap-2">
                    {user && user.id !== profile.id && (
                      <button
                        onClick={() => handleFollow(profile.id)}
                        disabled={followMutation.isPending}
                        className="btn btn-primary text-sm px-3 py-1"
                      >
                        Follow
                      </button>
                    )}
                    <Link
                      to={`/user/${profile.id}`}
                      className="btn btn-secondary text-sm px-3 py-1"
                    >
                      Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {users.length === 20 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="flex items-center px-4 py-2">
                Page {page}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={users.length < 20}
                className="btn btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-surface rounded-lg">
          <h2 className="text-2xl font-bold mb-2">No Users Found</h2>
          <p className="text-secondary mb-4">
            Be the first to join the community!
          </p>
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      )}
    </div>
  );
}