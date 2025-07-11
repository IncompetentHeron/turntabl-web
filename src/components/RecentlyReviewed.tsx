import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getReviewsWithFilters } from '../lib/supabase';
import { generateSlug } from '../lib/spotify';
import StarRating from './StarRating'; // Add this import

export default function RecentlyReviewed() {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['recentReviews'],
    queryFn: () => getReviewsWithFilters({
      sortBy: 'newest',
      limit: 10,
    }),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-secondary">Loading recent reviews...</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold">Recently Reviewed</h2>
        <Link
          to="/reviews"
          className="btn btn-secondary text-sm md:text-base lg:text-lg hover:text-accent2 transition-colors"
        >
          See all
        </Link>
      </div>
      <div className="flex flex-row overflow-x-auto lg:grid grid-cols-5 gap-4">
        {reviews.slice(0, 10).map((review) => (
          <Link
            key={review.id}
            to={`/album/${generateSlug(`${review.album?.artist} ${review.album?.name}`, review.album_id)}`}
            className="group justify-centerflex-shrink-0 w-24 md:w-32 lg:w-auto mb-3"
          >
            <div className="aspect-square mb-3">
              <img
                src={review.album?.cover_url}
                alt={review.album?.name}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            {/* Replace manual star rendering with StarRating component */}
            <StarRating rating={review.rating} size="sm" className="lg:hidden" />
            <StarRating rating={review.rating} size="md" className="hidden lg:block" />
          </Link>
        ))}
      </div>
    </section>
  );
}
