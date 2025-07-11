import { useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import { toggleReviewLike, createComment } from '../lib/supabase';
import type { Review, ReviewComment } from '../lib/supabase';
import Avatar from './Avatar';

interface ReviewListProps {
  reviews: Review[];
  onUpdate: () => void;
  onDelete?: (reviewId: string) => void;
  maxLines?: number;
}

export default function ReviewList({ reviews, onUpdate, onDelete, maxLines = 0 }: ReviewListProps) {
  const { user } = useUser();
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [newComment, setNewComment] = useState('');

  const handleLike = async (reviewId: string) => {
    if (!user) return;
    try {
      await toggleReviewLike(reviewId, user.id);
      onUpdate();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComment = async (reviewId: string) => {
    if (!user || !newComment.trim()) return;
    try {
      await createComment({
        user_id: user.id,
        review_id: reviewId,
        content: newComment,
      });
      setNewComment('');
      onUpdate();
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  const toggleReviewExpansion = (reviewId: string) => {
    setExpandedReviews(prev => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  };

  const toggleComments = (reviewId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div key={review.id} className="bg-surface rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Link to={`/user/${review.user_id}`}>
              <Avatar
                url={review.profile?.avatar_url || null}
                name={review.profile?.display_name || review.profile?.username || ''}
                size="sm"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    to={`/user/${review.user_id}`}
                    className="font-bold hover:text-accent transition-colors truncate"
                  >
                    {review.profile?.display_name || review.profile?.username}
                  </Link>
                  <span className="text-secondary text-sm">
                    {format(new Date(review.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                {onDelete && user?.id === review.user_id && (
                  <button
                    onClick={() => onDelete(review.id)}
                    className="text-secondary hover:text-error transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-2xl ${
                      i < review.rating ? 'text-accent' : 'text-secondary'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>

              <div 
                className={`prose prose-invert max-w-none ${
                  maxLines && !expandedReviews.has(review.id)
                    ? 'line-clamp-4'
                    : ''
                }`}
                dangerouslySetInnerHTML={{ __html: review.content }}
              />

              {maxLines > 0 && (
                <button
                  onClick={() => toggleReviewExpansion(review.id)}
                  className="text-accent hover:text-accent/80 text-sm mt-2"
                >
                  {expandedReviews.has(review.id) ? 'Show less' : 'Read more'}
                </button>
              )}

              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={() => handleLike(review.id)}
                  className="text-secondary hover:text-primary transition-colors"
                  disabled={!user}
                >
                  ♥ {review.like_count || 0}
                </button>
                <button
                  onClick={() => toggleComments(review.id)}
                  className="text-secondary hover:text-primary transition-colors"
                  disabled={!user}
                >
                  💬 {review.review_comments?.length || 0}
                </button>
              </div>

              {expandedComments.has(review.id) && (
                <div className="mt-4 space-y-4">
                  {review.review_comments?.map((comment: ReviewComment) => (
                    <div key={comment.id} className="bg-background rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Link
                          to={`/user/${comment.user_id}`}
                          className="font-bold hover:text-accent transition-colors"
                        >
                          {comment.profile?.display_name || comment.profile?.username}
                        </Link>
                        <span className="text-secondary text-sm">
                          {format(new Date(comment.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="break-words">{comment.content}</p>
                    </div>
                  ))}
                  {user && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 bg-background border border-white/10 rounded p-2"
                        placeholder="Add a comment..."
                      />
                      <button
                        onClick={() => handleComment(review.id)}
                        className="btn btn-primary"
                        disabled={!newComment.trim()}
                      >
                        Post
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}