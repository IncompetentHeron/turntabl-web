import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { IoHeartOutline, IoHeart, IoChatboxOutline, IoFlagOutline } from 'react-icons/io5'; // ADDED: IoFlagOutline
import Avatar from './Avatar';
import type { ReviewComment } from '../lib/supabase';
import ReportContentModal from './ReportContentModal'; // ADDED: Import ReportContentModal
import { useUser } from '../hooks/useUser'; // ADDED: Import useUser
import { useToast } from '../hooks/useToast'; // ADDED: Import useToast

interface CommentProps {
  comment: ReviewComment;
  onLike: (commentId: string) => void;
  onReply: () => void;
  isLiked?: boolean;
  likeCount?: number;
  replyCount?: number;
  depth?: number;
  replies?: ReviewComment[];
  onComment?: (content: string, parentId: string) => void;
  onUpdate?: () => void; // ADDED: onUpdate prop for refreshing comments
}

export default function Comment({ 
  comment, 
  onLike, 
  onReply, 
  isLiked = false,
  likeCount = 0,
  replyCount = 0,
  depth = 0,
  replies = [],
  onComment,
  onUpdate // ADDED: Destructure onUpdate
}: CommentProps) {
  const { user } = useUser(); // ADDED: Initialize useUser
  const { showToast } = useToast(); // ADDED: Initialize useToast
  const [showReplies, setShowReplies] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReportModal, setShowReportModal] = useState(false); // ADDED: State for report modal

  const formattedDate = isToday(new Date(comment.created_at))
    ? format(new Date(comment.created_at), 'h:mm a')
    : format(new Date(comment.created_at), 'MMM d');

  const handleReply = () => {
    if (onComment && replyContent.trim()) {
      onComment(replyContent.trim(), comment.id);
      setReplyContent('');
      setIsReplying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { // ADDED: handleKeyDown function
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  };

  // ADDED: Function to handle reporting
  const handleReport = () => {
    if (!user) {
      showToast({ title: 'Not Authenticated', description: 'Please log in to report content.' });
      return;
    }
    setShowReportModal(true);
  };

  // ADDED: Conditional rendering based on moderation_status
  const isModerated = comment.moderation_status === 'pending_review' || comment.moderation_status === 'rejected';
  const isOwner = user?.id === comment.user_id;

  if (isModerated && !isOwner) {
    return (
      <div className="space-y-4">
        <div 
          className="flex gap-3 bg-surface/50 p-3 rounded-lg text-center text-secondary"
          style={{ marginLeft: `${depth * 32}px` }}
        >
          <p className="font-bold mb-1">This comment is currently under review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div 
        className="flex gap-3"
        style={{ marginLeft: `${depth * 32}px` }}
      >
        <Link to={`/user/${comment.user_id}`}>
          <Avatar
            url={comment.profile?.avatar_url || null}
            name={comment.profile?.display_name || comment.profile?.username || ''}
            size="sm"
          />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/user/${comment.user_id}`}
              className="font-bold hover:text-accent transition-colors"
            >
              {comment.profile?.display_name || comment.profile?.username}
            </Link>
            <span className="text-sm text-secondary">{formattedDate}</span>
          </div>
          <p className="text-sm mb-2">{comment.content}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onLike(comment.id)}
              className="flex items-center gap-1 text-sm text-secondary hover:text-primary transition-colors"
            >
              {isLiked ? (
                <IoHeart className="text-accent2" />
              ) : (
                <IoHeartOutline />
              )}
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="text-sm text-secondary hover:text-primary transition-colors"
            >
              Reply
            </button>
            {user?.id !== comment.user_id && ( // ADDED: Report button for non-owners
              <button
                onClick={handleReport}
                className="text-sm text-secondary hover:text-primary transition-colors"
                title="Report comment"
              >
                <IoFlagOutline size={16} />
              </button>
            )}
          </div>

          {isReplying && (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-1 bg-surface border border-white/10 rounded-lg text-sm"
                placeholder="Write a reply..."
              />
              <button
                onClick={handleReply}
                disabled={!replyContent.trim()}
                className="btn btn-primary text-sm py-1"
              >
                Post
              </button>
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div className="pl-8">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-sm text-accent hover:text-accent/80 mb-2"
          >
            {showReplies ? 'Hide replies' : `View ${replies.length} replies`}
          </button>

          {showReplies && (
            <div className="space-y-4">
              {replies.map((reply) => (
                <Comment
                  key={reply.id}
                  comment={reply}
                  onLike={onLike}
                  onReply={() => {}}
                  depth={depth + 1}
                  onComment={onComment}
                  onUpdate={onUpdate} // ADDED: Pass onUpdate to nested comments
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showReportModal && ( // ADDED: ReportContentModal
        <ReportContentModal
          contentType="comment"
          contentId={comment.id}
          onClose={() => setShowReportModal(false)}
          onSuccess={onUpdate || (() => {})} // Refresh comments after reporting
          showToast={showToast}
        />
      )}
    </div>
  );
}
