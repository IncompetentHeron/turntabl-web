CREATE OR REPLACE FUNCTION public.create_comment_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  comment_owner_id uuid;
  like_count int;
BEGIN
  -- Get the owner of the comment
  SELECT user_id INTO comment_owner_id FROM public.review_comments WHERE id = NEW.comment_id;

  -- Count current likes for this comment
  SELECT COUNT(*) INTO like_count FROM public.comment_likes WHERE comment_id = NEW.comment_id;

  -- Only create notification if like count is within the threshold and not self-liking
  IF like_count <= 5 AND NEW.user_id != comment_owner_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, reference_type, reference_id)
    VALUES (comment_owner_id, 'comment_like', NEW.user_id, 'comment', NEW.comment_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment likes
CREATE TRIGGER create_comment_like_notification_trigger
AFTER INSERT ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION create_comment_like_notification();
