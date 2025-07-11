// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types
// Types
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  pronouns: string | null;
  bio: string | null;
  avatar_url: string | null;
  last_username_change: string | null;
  created_at: string;
  updated_at: string;
  follower_count: number;
  following_count: number;
  is_private: boolean;
  is_following?: boolean;
  is_followed_by_user?: boolean;
  followers_count?: number;
  review_count?: number;
}

export interface Review {
  id: string;
  user_id: string;
  album_id: string;
  content: string;
  rating: number;
  listened_at: string;
  visibility: string;
  created_at: string;
  updated_at: string;
  is_relisten: boolean;
  like_count?: number;
  is_liked?: boolean;
  profile?: Profile;
  album?: {
    id: string;
    name: string;
    artist: string;
    artist_id: string;
    cover_url: string;
    release_date: string; // Added release_date
    album_type: string;
    spotify_url?: string;
    coverUrl?: string;
  };
  review_comments?: ReviewComment[];
}

export interface ReviewComment {
  id: string;
  user_id: string;
  review_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  like_count?: number;
  is_liked?: boolean;
  profile?: Profile;
}

export interface List {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_ranked: boolean;
  created_at: string;
  updated_at: string;
  like_count?: number;
  is_liked?: boolean;
  profile?: Profile;
  list_items?: ListItem[];
}

export interface ListItem {
  id: string;
  list_id: string;
  album_id: string | null;
  artist_id: string | null;
  rank: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  album?: {
    id: string;
    name: string;
    artist: string;
    artist_id: string;
    cover_url: string;
    release_date: string;
    album_type: string;
    spotify_url?: string;
    coverUrl?: string;
  };
  artist?: {
    id: string;
    name: string;
    image_url: string;
    spotify_url?: string;
    genres: string[];
    imageUrl?: string;
    spotifyUrl?: string;
  };
}

export interface Listen {
  id: string;
  user_id: string;
  album_id: string;
  listened_at: string;
  note: string | null;
  created_at: string;
  album?: {
    id: string;
    name: string;
    artist: string;
    cover_url: string;
  };
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  artist_id: string;
  cover_url: string;
  release_date: string;
  album_type: string;
  spotify_url?: string;
  created_at?: string;
  updated_at?: string;
  review_count?: number;
  average_rating?: number;
  weighted_average_rating?: number;
  coverUrl?: string;
  popularity?: number; 
  spotify_popularity?: number;
}

// Auth functions
export async function signUp(email: string, password: string, username: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Profile functions
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      is_following:follows!follows_following_id_fkey(follower_id),
      is_followed_by_user:follows!follows_follower_id_fkey(following_id)
    `)
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    ...data,
    is_following: currentUserId ? data.is_following?.some((f: any) => f.follower_id === currentUserId) : false,
    is_followed_by_user: currentUserId ? data.is_followed_by_user?.some((f: any) => f.following_id === currentUserId) : false,
  };
}

export async function updateProfile(profile: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(profile)
    .eq('id', profile.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfilePrivacy(userId: string, isPrivate: boolean) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_private: isPrivate })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function searchUsers(query: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function getAllUsers(page: number = 1, limit: number = 20): Promise<Profile[]> {
  const offset = (page - 1) * limit;
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('follower_count', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

// Follow functions
export async function toggleFollow(userId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: existingFollow } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', session.user.id)
    .eq('following_id', userId)
    .single();

  if (existingFollow) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: session.user.id,
        following_id: userId,
      });
    if (error) throw error;
  }
}

export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower:profiles!follows_follower_id_fkey(*)
    `)
    .eq('following_id', userId);

  if (error) throw error;
  return data?.map(item => item.follower) || [];
}

export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      following:profiles!follows_following_id_fkey(*)
    `)
    .eq('follower_id', userId);

  if (error) throw error;
  return data?.map(item => item.following) || [];
}

// Review functions
export async function createReview(review: {
  user_id: string;
  album_id: string;
  content: string;
  rating: number;
  listened_at: string;
  visibility: string;
  is_relisten: boolean;
}) {
  const { data, error } = await supabase
    .from('reviews')
    .insert(review)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserReviews(userId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      profile:profiles(*),
      album:albums(*),
      review_comments(
        *,
        profile:profiles(*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data?.map(review => ({
    ...review,
    album: review.album ? {
      ...review.album,
      coverUrl: review.album.cover_url
    } : null
  })) || [];
}

export async function getAlbumReviews(albumId: string): Promise<Review[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      profile:profiles(*),
      review_comments(
        *,
        profile:profiles(*)
      ),
      review_likes(user_id)
    `)
    .eq('album_id', albumId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(review => ({
    ...review,
    like_count: review.review_likes?.length || 0,
    is_liked: currentUserId ? review.review_likes?.some((like: any) => like.user_id === currentUserId) : false,
  })) || [];
}

// Consolidated function for fetching reviews with various filters and sorting
export async function getReviewsWithFilters({
  sortBy = 'newest',
  page = 1,
  limit = 20,
  albumId = null,
  artistId = null,
  userId = null,
  followedByUserId = null,
  releaseYear = null,
  releaseDecade = null,
}: {
  sortBy?: 'newest' | 'oldest' | 'popular' | 'top_rated' | 'lowest_rated';
  page?: number;
  limit?: number;
  albumId?: string | null;
  artistId?: string | null;
  userId?: string | null;
  followedByUserId?: string | null;
  releaseYear?: number | null;
  releaseDecade?: number | null;
}): Promise<Review[]> {
  const { data, error } = await supabase.rpc('get_filtered_reviews', {
    p_sort_by: sortBy,
    p_page: page,
    p_limit: limit,
    p_album_id: albumId,
    p_artist_id: artistId,
    p_user_id: userId,
    p_followed_by_user_id: followedByUserId,
    p_release_year: releaseYear,
    p_release_decade: releaseDecade,
  });

  if (error) {
    console.error('Error fetching filtered reviews:', error);
    throw error;
  }

  return data.map((review: any) => ({
    ...review,
    album: review.album ? {
      ...review.album,
      coverUrl: review.album.cover_url,
    } : null,
    profile: review.profile ? {
      ...review.profile,
    } : null,
    review_comments: review.review_comments ? review.review_comments.map((comment: any) => ({
      ...comment,
      profile: comment.profile ? {
        ...comment.profile,
      } : null,
    })) : [],
  }));
}

export async function deleteReview(reviewId: string) {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) throw error;
}

export async function toggleReviewLike(reviewId: string, userId: string) {
  const { data: existingLike } = await supabase
    .from('review_likes')
    .select('id')
    .eq('review_id', reviewId)
    .eq('user_id', userId)
    .single();

  if (existingLike) {
    const { error } = await supabase
      .from('review_likes')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('review_likes')
      .insert({
        review_id: reviewId,
        user_id: userId,
      });
    if (error) throw error;
  }
}

// Comment functions
export async function createComment(comment: {
  user_id: string;
  review_id: string;
  content: string;
  parent_id?: string;
}) {
  const { data, error } = await supabase
    .from('review_comments')
    .insert(comment)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleCommentLike(commentId: string, userId: string) {
  const { data: existingLike } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .single();

  if (existingLike) {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('comment_likes')
      .insert({
        comment_id: commentId,
        user_id: userId,
      });
    if (error) throw error;
  }
}

// List functions
export async function createList(list: {
  user_id: string;
  title: string;
  description?: string;
  is_ranked?: boolean;
}) {
  const { data, error } = await supabase
    .from('lists')
    .insert(list)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserLists(userId: string): Promise<List[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  // Get regular lists
  const { data: regularLists, error: regularError } = await supabase
    .from('lists')
    .select(`
      *,
      profile:profiles(*),
      list_items(
        *,
        album:albums(*),
        artist:artists(*)
      ),
      list_likes(user_id)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (regularError) throw regularError;

  // Get liked albums for virtual list
  const { data: likedAlbums, error: likedError } = await supabase
    .from('album_likes')
    .select(`
      album_id,
      created_at,
      album:albums(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (likedError) throw likedError;

  const lists = regularLists?.map(list => ({
    ...list,
    like_count: list.list_likes?.length || 0,
    is_liked: currentUserId ? list.list_likes?.some((like: any) => like.user_id === currentUserId) : false,
    list_items: list.list_items
      ?.map((item: any) => ({
        ...item,
        album: item.album ? {
          ...item.album,
          coverUrl: item.album.cover_url
        } : null,
        artist: item.artist ? {
          ...item.artist,
          imageUrl: item.artist.image_url,
          spotifyUrl: item.artist.spotify_url
        } : null
      }))
      .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0))
  })) || [];

  // Add virtual "Liked Albums" list if user has liked albums
  if (likedAlbums && likedAlbums.length > 0) {
    const likedAlbumsList: List = {
      id: 'liked-albums-list',
      user_id: userId,
      title: 'Liked Albums',
      description: 'Albums you\'ve liked',
      is_ranked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      like_count: 0,
      is_liked: false,
      profile: regularLists?.[0]?.profile,
      list_items: likedAlbums.map((like, index) => ({
        id: `liked-${like.album_id}`,
        list_id: 'liked-albums-list',
        album_id: like.album_id,
        artist_id: null,
        rank: index + 1,
        note: null,
        created_at: like.created_at,
        updated_at: like.created_at,
        album: like.album ? {
          ...like.album,
          coverUrl: like.album.cover_url
        } : null,
        artist: null
      }))
    };
    lists.unshift(likedAlbumsList);
  }

  return lists;
}

export async function getAllPublicLists(page: number = 1, limit: number = 20): Promise<List[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;
  const offset = (page - 1) * limit;

  const { data, error } = await supabase
    .from('lists')
    .select(`
      *,
      profile:profiles(*),
      list_items(
        *,
        album:albums(*),
        artist:artists(*)
      ),
      list_likes(user_id)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return data?.map(list => ({
    ...list,
    like_count: list.list_likes?.length || 0,
    is_liked: currentUserId ? list.list_likes?.some((like: any) => like.user_id === currentUserId) : false,
    list_items: list.list_items
      ?.map((item: any) => ({
        ...item,
        album: item.album ? {
          ...item.album,
          coverUrl: item.album.cover_url
        } : null,
        artist: item.artist ? {
          ...item.artist,
          imageUrl: item.artist.image_url,
          spotifyUrl: item.artist.spotify_url
        } : null
      }))
      .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0))
  })) || [];
}

// New function for filtered lists
export async function getFilteredLists({
  sortBy = 'newest',
  page = 1,
  limit = 20,
  titleQuery = null,
  descriptionQuery = null,
  userId = null,
  followedByUserId = null,
  albumId = null,
  artistId = null,
}: {
  sortBy?: 'newest' | 'oldest' | 'popular';
  page?: number;
  limit?: number;
  titleQuery?: string | null;
  descriptionQuery?: string | null;
  userId?: string | null;
  followedByUserId?: string | null;
  albumId?: string | null;
  artistId?: string | null;
}): Promise<List[]> {
  const { data, error } = await supabase.rpc('get_filtered_lists', {
    p_sort_by: sortBy,
    p_page: page,
    p_limit: limit,
    p_title_query: titleQuery,
    p_description_query: descriptionQuery,
    p_user_id: userId,
    p_followed_by_user_id: followedByUserId,
    p_album_id: albumId,
    p_artist_id: artistId,
  });

  if (error) {
    console.error('Error fetching filtered lists:', error);
    throw error;
  }

  return data.map((list: any) => ({
    ...list,
    profile: list.profile ? {
      ...list.profile,
    } : null,
    list_items: list.list_items ? list.list_items.map((item: any) => ({
      ...item,
      album: item.album ? {
        ...item.album,
        coverUrl: item.album.cover_url,
      } : null,
      artist: item.artist ? {
        ...item.artist,
        imageUrl: item.artist.image_url,
        spotifyUrl: item.artist.spotify_url,
      } : null,
    })) : [],
  }));
}

export async function getList(listId: string): Promise<List | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  const { data, error } = await supabase
    .from('lists')
    .select(`
      *,
      profile:profiles(*),
      list_items(
        *,
        album:albums(*),
        artist:artists(*)
      ),
      list_likes(user_id)
    `)
    .eq('id', listId)
    .single();

  if (error) throw error;

  return {
    ...data,
    like_count: data.list_likes?.length || 0,
    is_liked: currentUserId ? data.list_likes?.some((like: any) => like.user_id === currentUserId) : false,
    list_items: data.list_items
      ?.map((item: any) => ({
        ...item,
        album: item.album ? {
          ...item.album,
          coverUrl: item.album.cover_url
        } : null,
        artist: item.artist ? {
          ...item.artist,
          imageUrl: item.artist.image_url,
          spotifyUrl: item.artist.spotify_url
        } : null
      }))
      .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0))
  };
}

export async function updateList(listId: string, updates: { title: string; description: string }) {
  const { data, error } = await supabase
    .from('lists')
    .update(updates)
    .eq('id', listId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateListItem(
  listId: string,
  albumId?: string,
  artistId?: string,
  updates: { rank?: number; note?: string }
) {
  let query = supabase
    .from('list_items')
    .update(updates)
    .eq('list_id', listId);

  if (albumId) {
    query = query.eq('album_id', albumId);
  } else if (artistId) {
    query = query.eq('artist_id', artistId);
  }

  const { data, error } = await query.select().single();

  if (error) throw error;
  return data;
}

export async function addToList(params: {
  list_id: string;
  album_id?: string;
  artist_id?: string;
  rank?: number;
  note?: string;
}) {
  const { data, error } = await supabase
    .from('list_items')
    .insert(params)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeFromList(listItemId: string) {
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('id', listItemId);

  if (error) throw error;
}

export async function toggleListLike(listId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: existingLike } = await supabase
    .from('list_likes')
    .select('id')
    .eq('list_id', listId)
    .eq('user_id', session.user.id)
    .single();

  if (existingLike) {
    const { error } = await supabase
      .from('list_likes')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', session.user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('list_likes')
      .insert({
        list_id: listId,
        user_id: session.user.id,
      });
    if (error) throw error;
  }
}

// Album functions
export async function getFilteredAlbums({
  sortBy = 'newest',
  page = 1,
  limit = 20,
  artistId = null,
  releaseYear = null,
  releaseDecade = null,
  isNewRelease = false,
  albumType = null,
}: {
  sortBy?: 'newest' | 'popular_all_time' | 'popular_this_week' | 'top_rated' | 'lowest_rated';
  page?: number;
  limit?: number;
  artistId?: string | null;
  releaseYear?: number | null;
  releaseDecade?: number | null;
  isNewRelease?: boolean;
  albumType?: string | null;
}): Promise<Album[]> {
  const { data, error } = await supabase.rpc('get_filtered_albums', {
    p_sort_by: sortBy,
    p_page: page,
    p_limit: limit,
    p_artist_id: artistId,
    p_release_year: releaseYear,
    p_release_decade: releaseDecade,
    p_is_new_release: isNewRelease,
    p_album_type: albumType,
  });

  if (error) {
    console.error('Error fetching filtered albums:', error);
    throw error;
  }

  return data.map((album: any) => ({
    ...album,
    coverUrl: album.cover_url, // Map cover_url to coverUrl for consistency
  }));
}

export async function getAlbumLikes(albumId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  const { data, error } = await supabase
    .from('album_likes')
    .select('user_id')
    .eq('album_id', albumId);

  if (error) throw error;

  return {
    count: data?.length || 0,
    isLiked: currentUserId ? data?.some(like => like.user_id === currentUserId) : false,
  };
}

export async function getAlbumStats(albumId: string) {
  const [reviewsResult, listsResult, listensResult] = await Promise.all([
    supabase
      .from('reviews')
      .select('rating')
      .eq('album_id', albumId),
    supabase
      .from('list_items')
      .select('id')
      .eq('album_id', albumId),
    supabase
      .from('listens')
      .select('id')
      .eq('album_id', albumId)
  ]);

  const reviews = reviewsResult.data || [];
  const lists = listsResult.data || [];
  const listens = listensResult.data || [];

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  return {
    reviewCount: reviews.length,
    listCount: lists.length,
    listenCount: listens.length,
    averageRating: Math.round(averageRating * 10) / 10,
  };
}

export async function toggleAlbumLike(albumId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: existingLike } = await supabase
    .from('album_likes')
    .select('id')
    .eq('album_id', albumId)
    .eq('user_id', session.user.id)
    .single();

  if (existingLike) {
    const { error } = await supabase
      .from('album_likes')
      .delete()
      .eq('album_id', albumId)
      .eq('user_id', session.user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('album_likes')
      .insert({
        album_id: albumId,
        user_id: session.user.id,
      });
    if (error) throw error;
  }
}

// Artist functions
export async function getArtistStats(artistId: string) {
  const [reviewsResult, listsResult, listensResult] = await Promise.all([
    supabase
      .from('reviews')
      .select('rating, album:albums!inner(artist_id)')
      .eq('album.artist_id', artistId),
    supabase
      .from('list_items')
      .select('id')
      .eq('artist_id', artistId),
    supabase
      .from('listens')
      .select('id, album:albums!inner(artist_id)')
      .eq('album.artist_id', artistId)
  ]);

  const reviews = reviewsResult.data || [];
  const lists = listsResult.data || [];
  const listens = listensResult.data || [];

  return {
    reviewCount: reviews.length,
    listCount: lists.length,
    listenCount: listens.length,
  };
}

export async function getArtistReviewsAggregate(artistId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      album:albums!inner(artist_id)
    `)
    .eq('album.artist_id', artistId);

  if (error) throw error;
  return data || [];
}

export async function getTopReviewsByArtist(artistId: string, limit: number = 10): Promise<Review[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      profile:profiles(*),
      album:albums!inner(artist_id, *),
      review_comments(
        *,
        profile:profiles(*)
      ),
      review_likes(user_id)
    `)
    .eq('album.artist_id', artistId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data?.map(review => ({
    ...review,
    album: review.album ? {
      ...review.album,
      coverUrl: review.album.cover_url
    } : null,
    like_count: review.review_likes?.length || 0,
    is_liked: currentUserId ? review.review_likes?.some((like: any) => like.user_id === currentUserId) : false,
  })) || [];
}

export async function getTopListsIncludingArtist(artistId: string, limit: number = 5): Promise<List[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  const { data, error } = await supabase
    .from('lists')
    .select(`
      *,
      profile:profiles(*),
      list_items!inner(
        *,
        album:albums(*),
        artist:artists(*)
      ),
      list_likes(user_id)
    `)
    .eq('list_items.artist_id', artistId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data?.map(list => ({
    ...list,
    like_count: list.list_likes?.length || 0,
    is_liked: currentUserId ? list.list_likes?.some((like: any) => like.user_id === currentUserId) : false,
    list_items: list.list_items
      ?.map((item: any) => ({
        ...item,
        album: item.album ? {
          ...item.album,
          coverUrl: item.album.cover_url
        } : null,
        artist: item.artist ? {
          ...item.artist,
          imageUrl: item.artist.image_url,
          spotifyUrl: item.artist.spotify_url
        } : null
      }))
      .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0))
  })) || [];
}

// Listen functions
export async function createListen(listen: {
  user_id: string;
  album_id: string;
  listened_at: string;
  note?: string | null;
}) {
  const { data, error } = await supabase
    .from('listens')
    .insert(listen)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserListens(userId: string) {
  const [listensResult, listenLaterResult] = await Promise.all([
    supabase
      .from('listens')
      .select(`
        *,
        album:albums(*)
      `)
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .limit(20),
    supabase
      .from('listen_later')
      .select(`
        *,
        album:albums(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  ]);

  return {
    listens: listensResult.data?.map(listen => ({
      ...listen,
      album: listen.album ? {
        ...listen.album,
        cover_url: listen.album.cover_url
      } : null
    })) || [],
    listenLater: listenLaterResult.data?.map(listen => ({
      ...listen,
      album: listen.album ? {
        ...listen.album,
        cover_url: listen.album.cover_url
      } : null
    })) || []
  };
}

export async function getLastListen(userId: string, albumId: string) {
  const { data, error } = await supabase
    .from('listens')
    .select('listened_at')
    .eq('user_id', userId)
    .eq('album_id', albumId)
    .order('listened_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function toggleListenLater(albumId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('listen_later')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('album_id', albumId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('listen_later')
      .delete()
      .eq('user_id', session.user.id)
      .eq('album_id', albumId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('listen_later')
      .insert({
        user_id: session.user.id,
        album_id: albumId,
      });
    if (error) throw error;
  }
}

export async function isInListenLater(albumId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  const { data } = await supabase
    .from('listen_later')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('album_id', albumId)
    .maybeSingle();

  return !!data;
}

// Notification functions
export async function getNotifications() {
  const { data: { session } = {} } = await supabase.auth.getSession(); // Destructure with default empty object
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      actor:profiles!notifications_actor_id_fkey(*)
    `)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function getUnreadNotificationCount() {
  const { data: { session } = {} } = await supabase.auth.getSession(); // Destructure with default empty object
  if (!session?.user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

export async function markNotificationsAsRead(notificationIds: string[]) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds);

  if (error) throw error;
}

export async function createMention(mention: {
  review_id: string;
  mentioned_user_id: string;
}) {
  const { data, error } = await supabase
    .from('mentions')
    .insert(mention)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Review draft functions
export async function saveReviewDraft(draft: {
  user_id: string;
  album_id: string;
  content?: string;
  rating?: number | null;
  listened_at: string;
  is_relisten: boolean;
  like_album: boolean;
}) {
  const { data, error } = await supabase
    .from('review_drafts')
    .upsert(draft, {
      onConflict: 'user_id,album_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getReviewDraft(albumId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('review_drafts')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('album_id', albumId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function deleteReviewDraft(albumId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('review_drafts')
    .delete()
    .eq('user_id', session.user.id)
    .eq('album_id', albumId);

  if (error) throw error;
}