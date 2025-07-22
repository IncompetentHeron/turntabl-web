CREATE OR REPLACE FUNCTION public.create_list_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  list_owner_id uuid;
  like_count int;
BEGIN
  -- Get the owner of the list
  SELECT user_id INTO list_owner_id FROM public.lists WHERE id = NEW.list_id;

  -- Count current likes for this list
  SELECT COUNT(*) INTO like_count FROM public.list_likes WHERE list_id = NEW.list_id;

  -- Only create notification if like count is within the threshold and not self-liking
  IF like_count <= 50 AND NEW.user_id != list_owner_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, reference_type, reference_id)
    VALUES (list_owner_id, 'list_like', NEW.user_id, 'list', NEW.list_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for list likes
CREATE TRIGGER create_list_like_notification_trigger
AFTER INSERT ON public.list_likes
FOR EACH ROW EXECUTE FUNCTION create_list_like_notification();
