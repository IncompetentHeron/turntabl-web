import { useMemo } from 'react';
import type { Review } from '../lib/supabase';
import StarRating from './StarRating';

interface RatingDistributionChartProps {
  reviews: Review[];
}

export default function RatingDistributionChart({ reviews }: RatingDistributionChartProps) {
  const distribution = useMemo(() => {
    // Create 10 ranges: 1-10, 11-20, 21-30, ..., 91-100
    const ranges = Array.from({ length: 10 }, (_, i) => ({
      min: i * 10 + 1,
      max: (i + 1) * 10,
      count: 0
    }));

    reviews.forEach(review => {
      const rating = review.rating;
      // Calculate which range this rating falls into (0-9)
      const rangeIndex = Math.min(Math.floor((rating - 1) / 10), 9);
      ranges[rangeIndex].count++;
    });

    const maxCount = Math.max(...ranges.map(r => r.count));
    
    return ranges.map(range => ({
      ...range,
      percentage: maxCount > 0 ? (range.count / maxCount) * 100 : 0
    }));
  }, [reviews]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  return (
    <div className="flex items-center gap-2">
      
      {/* Bar chart with 10 bars */}
      <div className="flex items-end gap-0.5 h-14">
        {distribution.map((range, index) => (
          <div
            key={index}
            className="w-4 bg-surface2 rounded-t hover:bg-accent2 transition-colors"
            style={{ 
              height: `${Math.max(range.percentage, 2)}%`,
              opacity: range.count > 0 ? 1 : 80
            }}
            title={`${range.min}-${range.max}: ${range.count} reviews`}
          />
        ))}
      </div>
      
      {/* Average rating */}
      <div className="text-center">
        <div className="text-xl font-bold">{averageRating}</div>
        <div className="text-xs text-secondary justify-center">average</div>
            <StarRating rating={averageRating} size="xs" className="sm:hidden" />
            <StarRating rating={averageRating} size="sm" className="hidden sm:block lg:hidden" />
            <StarRating rating={averageRating} size="md" className="hidden lg:block" />
      </div>
    </div>
  );
}