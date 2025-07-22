CREATE OR REPLACE FUNCTION public.create_new_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  review_owner_id uuid;
BEGIN
  -- Check if it's a top-level comment (not a reply)
  IF NEW.parent_id IS NULL THEN
    -- Get the owner of the review
    SELECT user_id INTO review_owner_id FROM public.reviews WHERE id = NEW.review_id;

    -- Only create notification if not self-commenting
    IF NEW.user_id != review_owner_id THEN
      INSERT INTO public.notifications (user_id, type, actor_id, reference_type, reference_id)
      VALUES (review_owner_id, 'new_comment', NEW.user_id, 'review', NEW.review_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new comments
CREATE TRIGGER create_new_comment_notification_trigger
AFTER INSERT ON public.review_comments
FOR EACH ROW EXECUTE FUNCTION create_new_comment_notification();
