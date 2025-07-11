import { Link } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import type { Review } from '../lib/supabase';
import ReviewCardUnknown from './ReviewCardUnknown';

interface ReviewFeedProps {
  reviews: Review[];
  onUpdate: () => void;
}

export default function ReviewFeed({ reviews, onUpdate }: ReviewFeedProps) {
  return (
    <div className="space-y-2">
      {reviews.map((review) => (
        <ReviewCardUnknown
          key={review.id}
          review={review}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}