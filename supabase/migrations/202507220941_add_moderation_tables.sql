-- Add moderation_status to reviews table
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

-- Add moderation_status to review_comments table
ALTER TABLE public.review_comments
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

-- Create moderation_reports table
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_content_type TEXT NOT NULL, -- 'review' or 'comment'
  reported_content_id uuid NOT NULL,   -- ID of the review or comment
  reason TEXT,
  created_at timestamptz DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' -- 'pending', 'resolved', 'dismissed'
);

-- Enable RLS on moderation_reports table
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can insert reports
CREATE POLICY "Authenticated users can report content"
  ON public.moderation_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by_user_id);

-- RLS Policy: Admins/Moderators can view all reports (assuming a 'moderator' role or similar)
-- For now, we'll allow authenticated users to view their own reports and no one else.
-- You would typically create a separate role for moderators and grant them full access.
CREATE POLICY "Users can view their own reports"
  ON public.moderation_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reported_by_user_id);

-- RLS Policy: Admins/Moderators can update reports
-- This policy is for a future admin panel. For now, no one can update.
-- You would typically add: TO service_role; or TO role 'moderator';
-- CREATE POLICY "Admins can update moderation reports"
--   ON public.moderation_reports
--   FOR UPDATE
--   TO service_role -- Or a specific 'moderator' role
--   USING (true);

-- Update RLS policies for reviews to hide moderated content from general users
-- Existing policy: "Reviews are viewable based on profile privacy"
-- Modify it to also check moderation_status
DROP POLICY IF EXISTS "Reviews are viewable based on profile privacy" ON public.reviews;
CREATE POLICY "Reviews are viewable based on profile privacy and moderation status"
  ON public.reviews
  FOR SELECT
  TO public
  USING (
    (auth.uid() = user_id) OR -- Owner can always see
    (moderation_status = 'approved') OR -- Approved content is public
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = reviews.user_id AND p.is_private = FALSE AND moderation_status = 'approved')) OR -- Public profiles with approved content
    (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = reviews.user_id)) -- Followers can see
  );

-- Update RLS policies for review_comments to hide moderated content from general users
-- Existing policy: "Comments are viewable by everyone"
-- Modify it to also check moderation_status
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.review_comments;
CREATE POLICY "Comments are viewable based on moderation status"
  ON public.review_comments
  FOR SELECT
  TO public
  USING (
    (auth.uid() = user_id) OR -- Owner can always see
    (moderation_status = 'approved') OR -- Approved content is public
    (EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_comments.review_id AND r.moderation_status = 'approved')) -- Only show comments on approved reviews
  );

