import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReviewsWithFilters } from '../lib/supabase';
import ReviewCardUnknown from './ReviewCardUnknown';

export default function PopularReviews() {
  const queryClient = useQueryClient();
  
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['popularReviews'],
    queryFn: () => getReviewsWithFilters({
      sortBy: 'popular',
      limit: 10,
    }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['popularReviews'] });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-secondary">Loading popular reviews...</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold">Popular Reviews This Week</h2>
        <Link 
          to="/reviews"
          className="btn btn-secondary text-sm md:text-base lg:text-lg hover:text-accent2 transition-colors"
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