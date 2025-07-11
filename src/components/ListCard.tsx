import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IoMusicalNotes, IoHeart, IoHeartOutline } from 'react-icons/io5';
import { toggleListLike } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { generateSlug } from '../lib/spotify';
import Avatar from './Avatar';
import type { List } from '../lib/supabase';

interface ListCardProps {
  list: List;
  showLikeButton?: boolean;
}

export default function ListCard({ list, showLikeButton = true }: ListCardProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [isLiking, setIsLiking] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => toggleListLike(list.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userLists'] });
      queryClient.invalidateQueries({ queryKey: ['trendingLists'] });
      queryClient.invalidateQueries({ queryKey: ['list', list.id] });
    },
  });

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user || isLiking || list.id === 'liked-albums-list') return;
    
    try {
      setIsLiking(true);
      await likeMutation.mutateAsync();
    } catch (error) {
      console.error('Error toggling list like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  // Get cover images from list items (both albums and artists)
  const coverImages = list.list_items?.slice(0, 10).map(item => {
    if (item.album_id && item.album) {
      return item.album.coverUrl;
    } else if (item.artist_id && item.artist) {
      return item.artist.imageUrl;
    }
    return null;
  }).filter(Boolean) || [];

  return (
    <Link
      to={`/lists/${list.id}`}
      className="block bg-surface rounded-lg overflow-hidden hover:bg-surface2 transition-colors"
    >
      <div className="p-4 flex flex-col gap-4">
        {/* Album/Artist covers with tighter stacking */}
        <div className="flex flex-row overflow-x-auto"> 
          {coverImages.map((url, index) => (
            <div
              key={index}
              className="group flex-shrink-0 w-24"
            >
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {coverImages.length === 0 && (
            <div className="w-20 h-20 bg-surface2 rounded flex items-center justify-center">
              <IoMusicalNotes className="text-secondary text-2xl" />
            </div>
          )}
        </div>
        
        {/* List content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="font-bold md:text-lg line-clamp-2 mb-1">{list.title}</h3>
            {list.description && (
              <p className="text-secondary text-xs sm:text-sm line-clamp-2 mb-2">{list.description}</p>
            )}
          </div>
          
          {/* Creator and stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar
                url={list.profile?.avatar_url || null}
                name={list.profile?.display_name || list.profile?.username || ''}
                size="sm"
              />
              <span className="text-sm">
                {list.profile?.display_name || list.profile?.username}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <IoMusicalNotes className="text-2xl sm:text-3xl" />
                <span>{list.list_items?.length || 0}</span>
              </div>
              {showLikeButton && list.id !== 'liked-albums-list' && (
                <button
                  onClick={handleLike}
                  disabled={isLiking || !user}
                  className="flex items-center gap-1 hover:text-accent2 transition-colors disabled:opacity-50"
                >
                  {list.is_liked ? (
                    <IoHeart className="text-2xl sm:text-3xl text-accent2" />
                  ) : (
                    <IoHeartOutline className="text-2xl sm:text-3xl" />
                  )}
                  <span>{list.like_count || 0}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}