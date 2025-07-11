import { useState } from 'react';
import { useUser } from '../hooks/useUser';
import Avatar from './Avatar';
import Comment from './Comment';
import type { ReviewComment } from '../lib/supabase';

interface CommentFeedProps {
  comments: ReviewComment[];
  onComment: (content: string, parentId?: string) => void;
  onLike: (commentId: string) => void;
}

export default function CommentFeed({ comments, onComment, onLike }: CommentFeedProps) {
  const { user } = useUser();
  const [newComment, setNewComment] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Organize comments into a tree structure
  const commentTree = comments.reduce((acc, comment) => {
    if (!comment.parent_id) {
      // This is a top-level comment
      if (!acc[comment.id]) {
        acc[comment.id] = { ...comment, replies: [] };
      } else {
        acc[comment.id] = { ...comment, replies: acc[comment.id].replies };
      }
    } else {
      // This is a reply
      if (!acc[comment.parent_id]) {
        acc[comment.parent_id] = { replies: [comment] };
      } else {
        acc[comment.parent_id].replies.push(comment);
      }
    }
    return acc;
  }, {} as Record<string, ReviewComment & { replies: ReviewComment[] }>);

  // Get top-level comments
  const topLevelComments = Object.values(commentTree).filter(
    comment => !comment.parent_id
  );

  // Sort comments by likes and timestamp
  const sortedComments = [...topLevelComments].sort((a, b) => {
    const likesA = a.like_count || 0;
    const likesB = b.like_count || 0;
    if (likesA !== likesB) return likesB - likesA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const displayedComments = showAll ? sortedComments : sortedComments.slice(0, 10);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim()) return;
    onComment(newComment.trim());
    setNewComment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      {user && (
        <div className="flex gap-3">
          <Avatar
            url={user.avatar_url || null}
            name={user.email || ''}
            size="sm"
          />
          <div className="flex-1">
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-5 py-2 bg-background border border-white/10 rounded-lg"
                placeholder="Add a comment..."
              />
            </form>
          </div>
          <button
            onClick={() => handleSubmit()}
            className="btn btn-primary"
            disabled={!newComment.trim()}
          >
            Post
          </button>
        </div>
      )}

      <div className="space-y-4">
        {displayedComments.map((comment) => (
          <Comment
            key={comment.id}
            comment={comment}
            onLike={() => onLike(comment.id)}
            onReply={() => {}}
            isLiked={comment.is_liked}
            likeCount={comment.like_count}
            replyCount={comment.replies?.length}
            replies={comment.replies}
            onComment={onComment}
          />
        ))}
      </div>

      {sortedComments.length > 5 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-accent hover:text-accent/80 transition-colors"
        >
          Show more comments
        </button>
      )}
    </div>
  );
}