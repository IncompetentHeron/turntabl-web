/*
  # Initial Schema Setup

  1. Tables Created
    - profiles: User profile information
    - albums: Cached Spotify album data
    - follows: User follow relationships
    - reviews: Album reviews
    - review_likes: Review likes
    - review_comments: Review comments
    - comment_likes: Comment likes
    - lists: User-created lists
    - list_items: Items in lists
    - notifications: User notifications
    - listens: Album listen history
    - listen_later: Listen later queue
    - album_likes: Album likes

  2. Security
    - RLS enabled on all tables
    - Appropriate policies for viewing and managing data
    - Cascading deletes for related data

  3. Performance
    - Indexes on frequently queried columns
    - Computed columns for counts
    - Updated timestamp triggers
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  pronouns text,
  bio text,
  avatar_url text,
  original_avatar_url text,
  last_username_change timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Albums table (cache from Spotify)
CREATE TABLE IF NOT EXISTS albums (
  id text PRIMARY KEY,
  name text NOT NULL,
  artist text NOT NULL,
  artist_id text NOT NULL,
  cover_url text NOT NULL,
  release_date date NOT NULL,
  album_type text NOT NULL,
  spotify_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Albums are viewable by everyone"
  ON albums FOR SELECT
  USING (true);

-- Follows table (must be created before reviews for RLS policy)
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own follows"
  ON follows FOR ALL
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  album_id text REFERENCES albums(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 100),
  listened_at timestamptz NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public', 'private', 'followers')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone when public"
  ON reviews FOR SELECT
  USING (
    visibility = 'public' OR
    (visibility = 'followers' AND EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid()
      AND following_id = user_id
    )) OR
    auth.uid() = user_id
  );

CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Review likes table
CREATE TABLE IF NOT EXISTS review_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, review_id)
);

ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Review likes are viewable by everyone"
  ON review_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can toggle own review likes"
  ON review_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Review comments table
CREATE TABLE IF NOT EXISTS review_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES review_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone"
  ON review_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments"
  ON review_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON review_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON review_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Comment likes table
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  comment_id uuid REFERENCES review_comments(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment likes are viewable by everyone"
  ON comment_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can toggle own comment likes"
  ON comment_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  is_ranked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lists are viewable by everyone"
  ON lists FOR SELECT
  USING (true);

CREATE POLICY "Users can create lists"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists"
  ON lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists"
  ON lists FOR DELETE
  USING (auth.uid() = user_id);

-- List items table
CREATE TABLE IF NOT EXISTS list_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  album_id text REFERENCES albums(id) ON DELETE CASCADE NOT NULL,
  rank integer,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(list_id, album_id)
);

ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "List items are viewable by everyone"
  ON list_items FOR SELECT
  USING (true);

CREATE POLICY "Users can manage list items"
  ON list_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id
      AND lists.user_id = auth.uid()
    )
  );

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reference_type text NOT NULL,
  reference_id uuid NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark notifications as read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_read = true);

-- Listens table
CREATE TABLE IF NOT EXISTS listens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  album_id text REFERENCES albums(id) ON DELETE CASCADE NOT NULL,
  listened_at timestamptz NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE listens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listens are viewable by everyone"
  ON listens FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own listens"
  ON listens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Listen later table
CREATE TABLE IF NOT EXISTS listen_later (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  album_id text REFERENCES albums(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, album_id)
);

ALTER TABLE listen_later ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listen later items are viewable by everyone"
  ON listen_later FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own listen later items"
  ON listen_later FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Album likes table
CREATE TABLE IF NOT EXISTS album_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  album_id text REFERENCES albums(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, album_id)
);

ALTER TABLE album_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Album likes are viewable by everyone"
  ON album_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can toggle own album likes"
  ON album_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_album_id_idx ON reviews(album_id);
CREATE INDEX IF NOT EXISTS review_likes_review_id_idx ON review_likes(review_id);
CREATE INDEX IF NOT EXISTS review_comments_review_id_idx ON review_comments(review_id);
CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS list_items_list_id_idx ON list_items(list_id);
CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_id_idx ON follows(following_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS listens_user_id_idx ON listens(user_id);
CREATE INDEX IF NOT EXISTS listens_album_id_idx ON listens(album_id);
CREATE INDEX IF NOT EXISTS listen_later_user_id_idx ON listen_later(user_id);
CREATE INDEX IF NOT EXISTS album_likes_album_id_idx ON album_likes(album_id);

-- Create functions for computed columns
CREATE OR REPLACE FUNCTION get_review_like_count(review_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM review_likes
  WHERE review_likes.review_id = $1;
$$;

CREATE OR REPLACE FUNCTION get_review_comment_count(review_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM review_comments
  WHERE review_comments.review_id = $1;
$$;

CREATE OR REPLACE FUNCTION get_comment_like_count(comment_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM comment_likes
  WHERE comment_likes.comment_id = $1;
$$;

-- Create triggers to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_review_comments_updated_at
  BEFORE UPDATE ON review_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_list_items_updated_at
  BEFORE UPDATE ON list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();