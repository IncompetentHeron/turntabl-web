import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReviewsWithFilters } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import ReviewCardUnknown from './ReviewCardUnknown';

export default function CommunityReviews() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['communityReviews', user?.id],
    queryFn: () => getReviewsWithFilters({
      sortBy: 'newest',
      limit: 10,
      followedByUserId: user!.id,
    }),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['communityReviews', user?.id] });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-secondary">Loading community reviews...</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <section className="bg-surface rounded-lg p-8 text-center mb-8">
        <h2 className="text-2xl font-bold mb-4">No Reviews Yet</h2>
        <p className="text-lg text-secondary mb-6">
          Follow more users to see their reviews here
        </p>
        <Link to="/search/users" className="btn btn-primary">
          Find Users to Follow
        </Link>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">New Reviews from Your Community</h2>
        <Link 
          to="/reviews?followed=true&sortBy=newest"
          className="text-accent hover:text-accent/80 transition-colors"
        >
          See all
        </Link>
      </div>
      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCardUnknown
            key={review.id}
            review={review}
            onUpdate={handleUpdate}
          />
        ))}
      </div>
    </section>
  );
}