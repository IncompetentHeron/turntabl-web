import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchUsers } from '../lib/supabase';
import Avatar from '../components/Avatar';

const ITEMS_PER_PAGE = 20;

export default function SearchUsers() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [page, setPage] = useState(1);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['userSearch', query],
    queryFn: () => searchUsers(query),
    enabled: !!query,
  });

  if (!query) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Search Users</h1>
        <p className="text-secondary">Use the search bar above to find users</p>
      </div>
    );
  }

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageUsers = users.slice(startIndex, endIndex);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Users matching "{query}"</h1>
        <div className="flex gap-2">
          <Link to="/search" className="text-accent hover:text-accent/80">
            Back to all results
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-xl text-secondary">Searching...</div>
        </div>
      ) : currentPageUsers.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {currentPageUsers.map((profile) => (
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

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-surface rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-surface rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-xl text-secondary">No users found</div>
        </div>
      )}
    </div>
  );
}