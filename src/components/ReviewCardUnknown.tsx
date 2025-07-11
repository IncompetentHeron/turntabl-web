import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useUser } from '../hooks/useUser';
import { useQuery } from '@tanstack/react-query';
import { getAlbum, generateSlug } from '../lib/spotify';
import { toggleReviewLike, createComment, toggleCommentLike } from '../lib/supabase';
import type { Review } from '../lib/supabase';
import Avatar from './Avatar';
import CommentFeed from './CommentFeed';
import StarRating from './StarRating';
import { IoTrashOutline, IoHeart, IoHeartOutline, IoChatbox, IoChatboxOutline, IoReload } from 'react-icons/io5';

interface ReviewCardUnknownProps {
  review: Review;
  onUpdate: () => void;
  onDelete?: (reviewId: string) => void;
}

export default function ReviewCardUnknown({ review, onUpdate, onDelete }: ReviewCardUnknownProps) {
  const { user } = useUser();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: album } = useQuery({
    queryKey: ['album', review.album_id],
    queryFn: () => getAlbum(review.album_id),
  });

  useEffect(() => {
  const timer = setTimeout(() => {
    if (contentRef.current) {
      const lineHeight = parseInt(
        getComputedStyle(contentRef.current).lineHeight,
        10
      );
      const maxVisibleHeight = lineHeight * 5; // Approximately 5 lines
    
      if (contentRef.current.scrollHeight > maxVisibleHeight + 5) {
        setIsOverflowing(true);
      } else {
        setIsOverflowing(false); // Explicitly set to false if not overflowing
      }
    }
  }, 400); // Small delay to allow content to render

  return () => clearTimeout(timer); // Cleanup the timer
}, [review.content, isExpanded]);


  const handleLike = async () => {
    if (!user || isLiking) return;
    
    try {
      setIsLiking(true);
      await toggleReviewLike(review.id, user.id);
      onUpdate();
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = async (content: string, parentId?: string) => {
    if (!user) return;
    try {
      await createComment({
        user_id: user.id,
        review_id: review.id,
        content,
        parent_id: parentId,
      });
      onUpdate();
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!user) return;
    try {
      await toggleCommentLike(commentId, user.id);
      onUpdate();
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    onDelete(review.id);
    setShowDeleteConfirm(false);
  };

  if (!album) return null;

  return (
    <div className="xl:bg-surface overflow-hidden border-t border-accent2/80 mx-[-1rem]">
      <div className="p-4 pt-3 pb-3 md:p-6">
        <div className="flex justify-between mb-3">
          <div className="flex gap-4">
            <Link
              to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
              className="flex-shrink-0"
            >
              <img
                src={album.coverUrl}
                alt={album.name}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded"
              />
            </Link>
            <div className="flex flex-col justify-end">
              <Link
                to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
                className="font-bold text-sm sm:text-lg line-clamp-2 hover:text-accent transition-colors"
              >
                {album.name}
              </Link>
              <Link
                to={`/artist/${album.artistId}`}
                className="text-secondary text-sm sm:text-base line-clamp-1 hover:text-primary transition-colors"
              >
                {album.artist}
              </Link>
            </div>
          </div>
          
          <div className="flex flex-col justify-center items-end sm:flex-row sm:items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1">
              {review.is_relisten && (
                <IoReload className="text-xl sm:text-3xl text-white" />
              )}
              <span className="text-sm sm:text-xl">{review.rating}/100</span>
            </div>
            <StarRating rating={review.rating} size="xs" className="sm:hidden" />
            <StarRating rating={review.rating} size="sm" className="hidden sm:block lg:hidden" />
            <StarRating rating={review.rating} size="md" className="hidden lg:block" />
          </div>

        </div>

        <div className="relative">
          <div 
            ref={contentRef}
            className={`prose prose-invert max-w-none px-0 py-2 [text-wrap:pretty] break-words text-sm sm:text-base ${
              !isExpanded ? 'max-h-[160px] overflow-hidden' : ''
            }`}
            dangerouslySetInnerHTML={{ __html: review.content }}
          />
          
          {!isExpanded && isOverflowing && (
            <>
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface via-surface/80 to-transparent pointer-events-none" />
              <button
                onClick={() => setIsExpanded(true)}
                className="absolute bottom-0 left-0 right-0 h-10 md:h-12 bg-black border border-accent2 rounded text-white hover:text-accent2/80 text-sm md:text-base font-semibold transition-colors flex items-center justify-center"
              >
                Read more...
              </button>
            </>
          )}
          
          {isExpanded && isOverflowing && (
            <div className="flex justify-center border border-accent2 rounded mt-4">
              <button
                onClick={() => setIsExpanded(false)}
                className="w-full h-10 md:h-12 text-white hover:text-accent2/80 text-sm md:text-base font-semibold transition-colors"
              >
                Show less
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <Link to={`/user/${review.user_id}`}>
              <Avatar
                url={review.profile?.avatar_url || null}
                name={review.profile?.display_name || review.profile?.username || ''}
                size="sm"
              />
            </Link>
            <div>
              <Link
                to={`/user/${review.user_id}`}
                className="block text-sm sm:text-base font-bold hover:text-accent transition-colors"
              >
                {review.profile?.display_name || review.profile?.username}
              </Link>
              <span className="text-xs sm:text-sm text-secondary">
                {format(new Date(review.listened_at), 'dd/MM/yy')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {user?.id === review.user_id && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-white hover:text-error transition-colors"
              >
                <IoTrashOutline className="text-2xl sm:text-4xl" />
              </button>
            )}         
            <button
              onClick={handleLike}
              className="flex items-center gap-1 transition-colors"
            >
              {review.is_liked ? (
                <IoHeart className="text-3xl sm:text-4xl text-accent2" />
              ) : (
                <IoHeartOutline className="text-3xl sm:text-4xl text-white hover:text-accent2" />
              )}
              <span className="text-white font-bold">{review.like_count || 0}</span>
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1 transition-colors"
              disabled={!user}
            >
              {showComments ? (
                <IoChatbox className="text-3xl sm:text-4xl text-accent2" />
              ) : (
                <IoChatboxOutline className="text-3xl sm:text-4xl text-white hover:text-accent2" />
              )}
              <span className="text-white font-bold">{review.review_comments?.length || 0}</span>
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-surface p-5 rounded-lg w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Delete Review</h3>
              <p className="text-secondary mb-6">
                Are you sure you want to delete this review? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-secondary hover:text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-error hover:bg-error/90 text-white rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showComments && (
        <div className="border-t border-white/10 p-4">
          <CommentFeed
            comments={review.review_comments || []}
            onComment={handleComment}
            onLike={handleCommentLike}
          />
        </div>
      )}
    </div>
  );
}