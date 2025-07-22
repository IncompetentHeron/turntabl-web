CREATE OR REPLACE FUNCTION public.create_reply_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  parent_comment_owner_id uuid;
BEGIN
  -- Check if it's a reply (has a parent_id)
  IF NEW.parent_id IS NOT NULL THEN
    -- Get the owner of the parent comment
    SELECT user_id INTO parent_comment_owner_id FROM public.review_comments WHERE id = NEW.parent_id;

    -- Only create notification if not self-replying
    IF NEW.user_id != parent_comment_owner_id THEN
      INSERT INTO public.notifications (user_id, type, actor_id, reference_type, reference_id)
      VALUES (parent_comment_owner_id, 'reply_comment', NEW.user_id, 'comment', NEW.parent_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment replies
CREATE TRIGGER create_reply_comment_notification_trigger
AFTER INSERT ON public.review_comments
FOR EACH ROW EXECUTE FUNCTION create_reply_comment_notification();
