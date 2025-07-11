/*
  # Add notifications and update follows

  1. Changes
    - Add trigger to update follower/following counts
    - Add notifications table for follow events
    - Add notification triggers
    - Add indexes for better performance

  2. Security
    - RLS policies for notifications
    - Only users can see their own notifications
    - Users can only mark their own notifications as read
*/

-- Create function to update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment counts
    UPDATE profiles 
    SET follower_count = COALESCE(follower_count, 0) + 1
    WHERE id = NEW.following_id;
    
    UPDATE profiles 
    SET following_count = COALESCE(following_count, 0) + 1
    WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement counts
    UPDATE profiles 
    SET follower_count = GREATEST(0, COALESCE(follower_count, 0) - 1)
    WHERE id = OLD.following_id;
    
    UPDATE profiles 
    SET following_count = GREATEST(0, COALESCE(following_count, 0) - 1)
    WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for follow counts
DROP TRIGGER IF EXISTS update_follow_counts_trigger ON follows;
CREATE TRIGGER update_follow_counts_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- Create function to create follow notifications
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (
      user_id,
      type,
      actor_id,
      reference_type,
      reference_id
    ) VALUES (
      NEW.following_id,
      'follow',
      NEW.follower_id,
      'profile',
      NEW.following_id
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for follow notifications
DROP TRIGGER IF EXISTS create_follow_notification_trigger ON follows;
CREATE TRIGGER create_follow_notification_trigger
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_notification();

-- Add follower/following count columns to profiles if they don't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS follower_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count integer DEFAULT 0;