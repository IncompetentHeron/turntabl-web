CREATE OR REPLACE FUNCTION public.create_review_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  review_owner_id uuid;
  like_count int;
BEGIN
  -- Get the owner of the review
  SELECT user_id INTO review_owner_id FROM public.reviews WHERE id = NEW.review_id;

  -- Count current likes for this review
  SELECT COUNT(*) INTO like_count FROM public.review_likes WHERE review_id = NEW.review_id;

  -- Only create notification if like count is within the threshold and not self-liking
  IF like_count <= 50 AND NEW.user_id != review_owner_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, reference_type, reference_id)
    VALUES (review_owner_id, 'review_like', NEW.user_id, 'review', NEW.review_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for review likes
CREATE TRIGGER create_review_like_notification_trigger
AFTER INSERT ON public.review_likes
FOR EACH ROW EXECUTE FUNCTION create_review_like_notification();
