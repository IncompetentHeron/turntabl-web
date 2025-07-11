import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import * as Slider from '@radix-ui/react-slider';
import { format } from 'date-fns';
import { createReview, searchUsers, createMention, saveReviewDraft, getReviewDraft, deleteReviewDraft, toggleAlbumLike } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { IoHeart, IoHeartOutline, IoClose, IoReload } from 'react-icons/io5';

interface ReviewModalProps {
  albumId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewModal({ albumId, isOpen, onClose, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isRelisten, setIsRelisten] = useState(false);
  const [likeAlbum, setLikeAlbum] = useState(false);
  const [listenedDate, setListenedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const { user } = useUser();

  const formRef = useRef<HTMLFormElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Write your review...',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: async ({ query }) => {
            if (!query || query.length < 2) return [];
            const users = await searchUsers(query);
            return users.map(user => ({
              id: user.id,
              label: `@${user.username}`,
              username: user.username
            }));
          },
          render: () => {
            let popup: HTMLElement;

            return {
              onStart: (props) => {
                popup = document.createElement('div');
                popup.className = 'absolute z-50 bg-surface border border-white/10 rounded-lg shadow-lg overflow-hidden';
                document.body.appendChild(popup);

                popup.innerHTML = `
                  <div class="py-1">
                    ${props.items
                      .map(
                        (item: any) => `
                          <button
                            type="button"
                            class="w-full px-4 py-2 text-left hover:bg-white/5"
                            data-user-id="${item.id}"
                            data-username="${item.username}"
                          >
                            ${item.label}
                          </button>
                        `
                      )
                      .join('')}
                  </div>
                `;

                const rect = props.clientRect();
                if (rect) {
                  popup.style.left = `${rect.left}px`;
                  popup.style.top = `${rect.top + 24}px`;
                }

                popup.querySelectorAll('button').forEach((button) => {
                  button.addEventListener('click', () => {
                    const userId = button.getAttribute('data-user-id');
                    const username = button.getAttribute('data-username');
                    if (userId && username) {
                      setMentionedUsers((prev) => new Set([...prev, userId]));
                      props.command({ id: userId, label: `@${username}` });
                    }
                  });
                });
              },
              onUpdate: (props) => {
                const rect = props.clientRect();
                if (rect) {
                  popup.style.left = `${rect.left}px`;
                  popup.style.top = `${rect.top + 24}px`;
                }
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  popup.remove();
                  return true;
                }
                return false;
              },
              onExit: () => {
                popup.remove();
              },
            };
          },
        },
      }),
    ],
    onUpdate: () => {
      setHasUnsavedChanges(true);
    },
  });

  // Load draft on component mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!user || isDraftLoaded || !isOpen) return;
      
      try {
        const draft = await getReviewDraft(albumId);
        if (draft) {
          setRating(draft.rating);
          setIsRelisten(draft.is_relisten);
          setLikeAlbum(draft.like_album);
          setListenedDate(draft.listened_at.split('T')[0]);
          if (editor && draft.content) {
            editor.commands.setContent(draft.content);
          }
        }
        setIsDraftLoaded(true);
      } catch (error) {
        console.error('Error loading draft:', error);
        setIsDraftLoaded(true);
      }
    };

    loadDraft();
  }, [user, albumId, editor, isDraftLoaded, isOpen]);

  // Track changes for unsaved changes detection
  useEffect(() => {
    const handleChange = () => setHasUnsavedChanges(true);
    
    const form = formRef.current;
    if (form) {
      form.addEventListener('input', handleChange);
      form.addEventListener('change', handleChange);
      
      return () => {
        form.removeEventListener('input', handleChange);
        form.removeEventListener('change', handleChange);
      };
    }
  }, []);

  // Handle beforeunload event for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && isOpen) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isOpen]);

  const handleStarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = (x / width) * 100;
    const newRating = Math.max(1, Math.min(100, Math.round(percentage)));
    setHoverRating(newRating);
  };

  const handleStarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = (x / width) * 100;
    const newRating = Math.max(1, Math.min(100, Math.round(percentage)));
    setRating(newRating);
    setHoverRating(null);
    setHasUnsavedChanges(true);
  };

  const handleRatingInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setRating(null);
    } else {
      const numValue = Math.min(100, Math.max(1, parseInt(value) || 1));
      setRating(numValue);
    }
    setHasUnsavedChanges(true);
  };

  const handleSliderChange = (values: number[]) => {
    setRating(values[0]);
    setHasUnsavedChanges(true);
  };

  const saveDraft = async () => {
    if (!user || !editor) return;

    try {
      await saveReviewDraft({
        user_id: user.id,
        album_id: albumId,
        content: editor.getHTML(),
        rating,
        listened_at: new Date(listenedDate).toISOString(),
        is_relisten: isRelisten,
        like_album: likeAlbum,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editor || rating === null) return;

    setIsSubmitting(true);
    try {
      // Create the review
      const review = await createReview({
        user_id: user.id,
        album_id: albumId,
        content: editor.getHTML(),
        rating,
        listened_at: new Date(listenedDate).toISOString(),
        visibility: 'public', // Default to public since we removed the visibility option
        is_relisten: isRelisten,
      });

      // Like the album if the user selected that option
      if (likeAlbum) {
        try {
          await toggleAlbumLike(albumId);
        } catch (error) {
          console.error('Error liking album:', error);
          // Don't fail the whole submission if album like fails
        }
      }

      // Create mentions
      for (const userId of mentionedUsers) {
        await createMention({
          review_id: review.id,
          mentioned_user_id: userId,
        });
      }

      // Delete the draft since review was successfully created
      try {
        await deleteReviewDraft(albumId);
      } catch (error) {
        console.error('Error deleting draft:', error);
        // Don't fail if draft deletion fails
      }

      // Reset form
      editor.commands.clearContent();
      setRating(null);
      setIsRelisten(false);
      setLikeAlbum(false);
      setMentionedUsers(new Set());
      setHasUnsavedChanges(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (hasUnsavedChanges) {
      const shouldSave = confirm('You have unsaved changes. Would you like to save as draft?');
      if (shouldSave) {
        await saveDraft();
      }
    }
    onClose();
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const displayRating = hoverRating ?? (rating === null ? 0 : rating);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackgroundClick}
    >
      <div className="bg-surface p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg md:text-xl lg:text-2xl font-bold">Write a Review</h2>
          <button
            onClick={handleClose}
            className="text-secondary hover:text-primary transition-colors"
          >
            <IoClose size={24} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Rating</label>
            <div className="flex items-center gap-2 md:gap-4">
              <div 
                className="flex"
                onMouseLeave={() => setHoverRating(null)}
              >
                <div
                  className="relative w-[100px] h-[21.33px] md:w-[125px] md:h-[26.66px lg:w-[150px] lg:h-[32px] cursor-pointer"
                  onMouseMove={handleStarMouseMove}
                  onClick={handleStarClick}
                >
                  {/* Base star layer */}
                  <div className="absolute inset-0 flex items-center text-2xl md:text-3xl lg:text-4xl text-white/20 pointer-events-none">
                    ★★★★★
                  </div>
                  
                  {/* Filled star layer */}
                  <div
                    className="absolute inset-0 flex items-center text-2xl md:text-3xl lg:text-4xl text-accent overflow-hidden pointer-events-none"
                    style={{
                      width: `${displayRating}%`,
                    }}
                  >
                    ★★★★★
                  </div>
                </div>
              </div>
              <input
                type="number"
                min="1"
                max="100"
                value={rating === null ? '' : rating}
                onChange={handleRatingInput}
                onFocus={(e) => e.target.select()}
                className="w-10 sm:w-12 px-1 py-1 bg-surface border border-white/10 rounded text-center"
                required
              />
              <span className="text-secondary text-sm md:text-base">/100</span>
              
              {/* Re-listen button */}
              <div className="flex items-center justify-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsRelisten(!isRelisten);
                    setHasUnsavedChanges(true);
                  }}
                  className="text-secondary hover:text-accent2 transition-colors"
                  title="Mark as relisten"
                >
                  {isRelisten ? (
                    <IoReload className="text-accent2" size={25} />
                  ) : (
                    <IoReload className="text-secondary" size={25} />
                  )}
                </button>
              </div>
              
              {/* Album like button */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setLikeAlbum(!likeAlbum);
                    setHasUnsavedChanges(true);
                  }}
                  className="text-secondary hover:text-accent2 transition-colors"
                  title="Like album"
                >
                  {likeAlbum ? (
                    <IoHeart className="text-accent2" size={25} />
                  ) : (
                    <IoHeartOutline size={25} />
                  )}
                </button>
              </div>
            </div>
            <Slider.Root
              className="relative flex items-center w-full h-5 mt-4"
              value={[rating === null ? 0 : rating]}
              onValueChange={handleSliderChange}
              min={1}
              max={100}
              step={1}
            >
              <Slider.Track className="relative h-1 flex-grow rounded-full bg-white/10">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb
                className="block w-5 h-5 bg-accent rounded-full hover:bg-accent/90 focus:outline-none focus:shadow-[0_0_0_2px] focus:shadow-accent"
                aria-label="Rating"
              />
            </Slider.Root>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Listen Date</label>
            <input
              type="date"
              value={listenedDate}
              onChange={(e) => {
                setListenedDate(e.target.value);
                setHasUnsavedChanges(true);
              }}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Review</label>
            <div className="max-h-[180px] overflow-y-auto bg-surface border border-white/10 rounded-lg p-4">
              <EditorContent editor={editor} />
            </div>
          </div>

          <div className="flex justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveDraft}
                className="btn btn-secondary bg-accent2/50"
                disabled={!hasUnsavedChanges}
              >
                Save Draft
              </button>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || rating === null || !editor?.getText().trim()}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Posting...' : 'Post Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}