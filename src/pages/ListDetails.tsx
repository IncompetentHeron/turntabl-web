import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  rectIntersection,
  useSensors,
  TouchSensor, // Import TouchSensor
  MouseSensor, // Import MouseSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoTrashOutline,
  IoReorderThreeOutline,
  IoPencil,
  IoShareOutline,
  IoAdd,
  IoEllipsisHorizontal,
  IoClose,
  IoCheckmark,
  IoSearch,
  IoHeart,
  IoHeartOutline,
  IoAlbums, // Added for album tab icon
  IoPerson, // Added for artist tab icon
  IoMusicalNotes // Added for empty list placeholder
} from 'react-icons/io5';
import {
  getList,
  updateList,
  updateListItem,
  removeFromList, // This function's signature will be updated
  addToList,
  getUserLists,
  toggleListLike
} from '../lib/supabase';
import { searchSpotify, generateSlug } from '../lib/spotify';
import { useUser } from '../hooks/useUser';
import { useDebounce } from '../hooks/useDebounce';
import Avatar from '../components/Avatar';
import { format } from 'date-fns';

interface SortableItemProps {
  id: string; // This is the unique list_item ID
  index: number;
  item: any;
  isOwner: boolean;
  onRemove: (listItemId: string) => void; // Updated to pass listItemId
}

function SortableItem({ id, index, item, isOwner, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const [showMenu, setShowMenu] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Determine if this is an album or artist item
  const isAlbum = !!item.album_id;
  const isArtist = !!item.artist_id;

  const itemData = isAlbum ? item.album : item.artist;
  const itemName = itemData?.name;
  const itemArtist = isAlbum ? itemData?.artist : null;
  const itemImage = isAlbum ? itemData?.coverUrl : itemData?.imageUrl;
  const itemUrl = isAlbum
    ? `/album/${generateSlug(`${itemArtist} ${itemName}`, item.album_id)}`
    : `/artist/${generateSlug(itemName, item.artist_id)}`;
  const spotifyUrl = itemData?.spotifyUrl;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: 'none' }}
      className="group bg-surface/50 hover:bg-surface transition-colors duration-200 rounded-md"
    >
      <div className="flex items-center gap-3 p-2">
        {isOwner && (
          <button
            className="text-secondary cursor-grab transition-opacity"
            {...attributes}
            {...listeners}
          >
            <IoReorderThreeOutline size={24} />
          </button>
        )}

        <Link
          to={itemUrl}
          className="flex-shrink-0"
        >
          <img
            src={itemImage}
            alt={itemName}
            className={`w-12 h-12 sm:w-14 sm:h-14 object-cover ${isArtist ? 'rounded-full' : 'rounded'}`}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={itemUrl}
            className="text-sm sm:text-base font-medium hover:underline truncate block"
          >
            {itemName}
          </Link>
          {isAlbum && (
            <p className="text-secondary text-xs sm:text-sm truncate">
              {itemArtist}
            </p>
          )}
          {isArtist && (
            <p className="text-secondary text-xs sm:text-sm">
              Artist
            </p>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-secondary hover:text-primary transition-opacity"
          >
            <IoEllipsisHorizontal size={20} />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-surface2 rounded-lg shadow-xl z-50">
                <div className="py-1">
                  {spotifyUrl && (
                    <a
                      href={spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-2 text-sm hover:bg-white/5"
                    >
                      Open in Spotify
                    </a>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => {
                        onRemove(item.id); // Pass the unique list item ID
                        setShowMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-accent-500 hover:bg-white/5"
                    >
                      Remove from list
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ListDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
  });
  const [showAddItem, setShowAddItem] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [activeSearchTab, setActiveSearchTab] = useState<'albums' | 'artists'>('albums');
  const [isLiking, setIsLiking] = useState(false);

  // Configure dnd-kit sensors for better touch and scroll behavior
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      // Adjust touch activation constraints if needed
      activationConstraint: {
        delay: 100, 
        tolerance: 5,
      },
    }),
    useSensor(MouseSensor, {
      // Adjust mouse activation constraints if needed
      activationConstraint: {
        distance: 10, // Drag distance to activate drag
      },
    }),
  );

  // Check if this is a virtual list (like liked-albums-list)
  const isVirtualList = id === 'liked-albums-list';

  // Query for regular database lists
  const { data: regularList, isLoading: isLoadingRegular } = useQuery({
    queryKey: ['list', id],
    queryFn: () => getList(id!),
    enabled: !!id && !isVirtualList,
  });

  // Query for virtual lists (get user lists and filter)
  const { data: userLists, isLoading: isLoadingVirtual } = useQuery({
    queryKey: ['userLists', user?.id],
    queryFn: () => getUserLists(user!.id),
    enabled: !!user?.id && isVirtualList,
  });

  // Determine which list to use and loading state
  const list = isVirtualList
    ? userLists?.find(list => list.id === id)
    : regularList;
  const isLoading = isVirtualList ? isLoadingVirtual : isLoadingRegular;

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['search', debouncedSearchTerm, activeSearchTab],
    queryFn: () => searchSpotify(debouncedSearchTerm),
    enabled: !!debouncedSearchTerm && debouncedSearchTerm.length >= 2,
  });

  const likeMutation = useMutation({
    mutationFn: () => toggleListLike(list!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', id] });
      queryClient.invalidateQueries({ queryKey: ['userLists'] });
    },
  });

  useEffect(() => {
    if (list) {
      setEditForm({
        title: list.title,
        description: list.description || '',
      });
    }
  }, [list]);

  const updateListMutation = useMutation({
    mutationFn: (updates: { title: string; description: string }) =>
      updateList(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', id] });
      setIsEditing(false);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: (params: { listId: string; albumId?: string; artistId?: string; rank: number }) =>
      updateListItem(params.listId, params.albumId, params.artistId, { rank: params.rank }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', id] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (listItemId: string) => // Updated to accept listItemId
      removeFromList(listItemId), // Call removeFromList with listItemId
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', id] });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (params: { list_id: string; album_id?: string; artist_id?: string; rank?: number }) =>
      addToList(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', id] });
    },
  });

  const handleLike = async () => {
    if (!user || isLiking || !list || isVirtualList) return;

    try {
      setIsLiking(true);
      await likeMutation.mutateAsync();
    } catch (error) {
      console.error('Error toggling list like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (!active || !over || !list?.list_items) return;

    const oldIndex = list.list_items.findIndex(item => item.id === active.id);
    const newIndex = list.list_items.findIndex(item => item.id === over.id);

    if (oldIndex !== newIndex) {
      const newItems = arrayMove(list.list_items, oldIndex, newIndex);

      // Optimistically update the UI
      queryClient.setQueryData(['list', id], {
        ...list,
        list_items: newItems.map((item, index) => ({
          ...item,
          rank: index + 1
        }))
      });

      try {
        // Await all rank updates
        await Promise.all(
          newItems.map((item, index) =>
            updateItemMutation.mutateAsync({
              listId: list.id,
              albumId: item.album_id,
              artistId: item.artist_id,
              rank: index + 1,
            })
          )
        );

        // Explicitly refetch the list data after successful updates
        await queryClient.refetchQueries({ queryKey: ['list', id] });
      } catch (error) {
        // If the update fails, revert the cache
        console.error('Failed to update item ranks:', error);
        queryClient.setQueryData(['list', id], list);
      }
    }
  };

  const handleRemoveItem = async (listItemId: string) => { // Updated to accept listItemId
    if (!list) return;
    if (!confirm('Are you sure you want to remove this item from the list?')) return;

    await removeItemMutation.mutateAsync(listItemId); // Pass listItemId to mutation
  };

  const handleAddItem = async (itemId: string, itemType: 'album' | 'artist') => {
    if (!list) return;

    try {
      // First, sync the item to ensure it exists in our database
      const itemToSync = itemType === 'album'
        ? searchResults?.albums.find(a => a.id === itemId)
        : searchResults?.artists.find(a => a.id === itemId);

      if (!itemToSync) {
        throw new Error(`Item not found in search results: ${itemId}`);
      }

      const syncEndpoint = itemType === 'album' ? 'sync-album' : 'sync-artist';
      const syncPayload = itemType === 'album' ? { album: itemToSync } : { artist: itemToSync };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${syncEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(syncPayload),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync ${itemType}`);
      }

      // Now that the item is synced, add it to the list
      const payload: { list_id: string; album_id?: string; artist_id?: string; rank?: number } = {
        list_id: list.id,
        rank: (list?.list_items?.length || 0) + 1,
      };

      if (itemType === 'album') {
        payload.album_id = itemId;
      } else {
        payload.artist_id = itemId;
      }

      await addItemMutation.mutateAsync(payload);

      setAddedItems(prev => new Set(prev.add(itemId)));
    } catch (error) {
      console.error(`Error adding ${itemType} to list:`, error);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // TODO: Show toast notification
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!list) return;

    try {
      await updateListMutation.mutateAsync({
        title: editForm.title,
        description: editForm.description,
      });
    } catch (error) {
      console.error('Error updating list:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Loading list...</div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">List not found</div>
      </div>
    );
  }

  const isOwner = user?.id === list.user_id;

  // Get cover images from list items (both albums and artists)
  const coverImages = list.list_items?.slice(0, 4).map(item => {
    if (item.album_id && item.album) {
      return item.album.coverUrl;
    } else if (item.artist_id && item.artist) {
      return item.artist.imageUrl;
    }
    return null;
  }).filter(Boolean) || [];

  const coverSize = 192; // 48rem
  const coverOffset = 12; // 0.75rem

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:gap-8">
          {/* Album/Artist Covers */}
          <div
            className="relative mx-auto md:mx-0 mb-6 md:mb-0 flex-shrink-0"
            style={{
              width: coverSize + (coverImages.length - 1) * coverOffset,
              height: coverSize + (coverImages.length - 1) * coverOffset,
            }}
          >
            {coverImages.length > 0 ? (
              coverImages.map((url, i) => (
                <div
                  key={i}
                  className="absolute w-48 h-48"
                  style={{
                    transform: `translate(${i * coverOffset}px, ${i * coverOffset}px)`,
                    zIndex: coverImages.length - i,
                  }}
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover rounded-lg shadow-xl"
                  />
                </div>
              ))
            ) : (
              <div className="w-48 h-48 bg-surface rounded-lg flex items-center justify-center">
                <IoMusicalNotes className="text-secondary text-6xl" />
              </div>
            )}
          </div>

          {/* List Info */}
          <div className="flex-1 flex flex-col justify-end text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <h1
                className={`text-2xl md:text-3xl lg:text-4xl font-bold ${isOwner && !isVirtualList ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (isOwner && !isVirtualList) {
                    setIsEditing(true);
                  }
                }}
              >
                {list.title}
              </h1>
            </div>
            {list.description && (
              <p
                className={`text-sm md:text-md lg:text-lg text-secondary mb-4 ${isOwner && !isVirtualList ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (isOwner && !isVirtualList) {
                    setIsEditing(true);
                  }
                }}
              >
                {list.description}
              </p>
            )}

            <div className="flex items-center justify-center md:justify-start gap-4 mb-3 md:mb-6">
              <Link to={`/user/${list.user_id}`} className="flex items-center gap-2">
                <Avatar
                  url={list.profile?.avatar_url || null}
                  name={list.profile?.display_name || list.profile?.username || ''}
                  size="sm"
                />
                <span className="text-xs md:text-sm lg:text-base font-medium hover:text-accent transition-colors">
                  {list.profile?.display_name || list.profile?.username}
                </span>
              </Link>
              <span className="text-secondary">•</span>
              <span className="text-xs md:text-sm lg:text-base text-secondary">{list.list_items?.length || 0} items</span>
              <span className="text-secondary">•</span>
              <span className="text-xs md:text-sm lg:text-base text-secondary">
                {format(new Date(list.created_at), 'd MMMM, yyyy')}
              </span>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-4">
              {isOwner && !isVirtualList && (
                <button
                  onClick={() => setShowAddItem(true)}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <IoAdd size={24} />
                </button>
              )}
              {!isVirtualList && (
                <button
                  onClick={handleLike}
                  disabled={isLiking || !user}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {list.is_liked ? (
                    <IoHeart size={20} className="text-accent2" />
                  ) : (
                    <IoHeartOutline size={20} />
                  )}
                  <span>{list.like_count || 0}</span>
                </button>
              )}
              <button
                onClick={handleShare}
                className="btn btn-secondary text-sm flex items-center justify-center gap-2"
              >
                <IoShareOutline size={20} />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {list.list_items && list.list_items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={list.list_items.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {list.list_items.map((item, index) => (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  index={index}
                  item={item}
                  isOwner={isOwner && !isVirtualList}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-12 bg-surface rounded-lg">
          <p className="text-lg md:text-xl text-secondary mb-4">This list is empty</p>
          <Link to="/search" className="btn btn-primary">
            Browse Albums
          </Link>
        </div>
      )}

      {/* Edit List Modal */}
      {isEditing && !isVirtualList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold">Edit List</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-secondary hover:text-primary"
              >
                <IoClose size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateList} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full h-32 px-4 py-2 bg-surface border border-white/10 rounded-lg resize-none"
                  maxLength={250} // Added character limit
                />
                <p className="text-secondary text-sm mt-1">
                  {editForm.description.length}/250 characters
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateListMutation.isPending}
                >
                  {updateListMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && !isVirtualList && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddItem(false);
              setSearchTerm('');
              setAddedItems(new Set());
            }
          }}
        >
          <div className="bg-surface p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Add Item</h2>
              <button
                onClick={() => {
                  setShowAddItem(false);
                  setSearchTerm('');
                  setAddedItems(new Set());
                }}
                className="text-secondary hover:text-primary"
              >
                <IoClose size={24} />
              </button>
            </div>

            <div className="flex mb-4 border-b border-white/10">
              <button
                onClick={() => setActiveSearchTab('albums')}
                className={`flex-1 py-2 text-center font-medium transition-colors ${
                  activeSearchTab === 'albums'
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-secondary hover:text-primary'
                } flex items-center justify-center gap-2`}
              >
                <IoAlbums size={20} /> Albums
              </button>
              <button
                onClick={() => setActiveSearchTab('artists')}
                className={`flex-1 py-2 text-center font-medium transition-colors ${
                  activeSearchTab === 'artists'
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-secondary hover:text-primary'
                } flex items-center justify-center gap-2`}
              >
                <IoPerson size={20} /> Artists
              </button>
            </div>

            <div className="relative mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search for ${activeSearchTab}...`}
                className="w-full pl-10 pr-4 py-2 bg-surface border border-white/10 rounded-lg"
              />
              <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={20} />
            </div>

            <div className="space-y-4">
              {isSearching ? (
                <div className="text-center py-8">
                  <p className="text-secondary">Searching...</p>
                </div>
              ) : (activeSearchTab === 'albums' && searchResults?.albums && searchResults.albums.length > 0) ? (
                searchResults.albums.map((album) => (
                  <div
                    key={album.id}
                    className="flex items-center gap-4 p-4 bg-surface/50 rounded-lg"
                  >
                    <img
                      src={album.coverUrl}
                      alt={album.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{album.name}</h3>
                      <p className="text-secondary text-sm truncate">{album.artist}</p>
                    </div>
                    <motion.button
                      onClick={() => handleAddItem(album.id, 'album')}
                      disabled={addedItems.has(album.id)}
                      className="text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                      whileTap={{ scale: 0.95 }}
                    >
                      <AnimatePresence mode="wait">
                        {addedItems.has(album.id) ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.1 }}
                          >
                            <IoCheckmark size={24} />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="add"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.1 }}
                          >
                            <IoAdd size={24} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </div>
                ))
              ) : (activeSearchTab === 'artists' && searchResults?.artists && searchResults.artists.length > 0) ? (
                searchResults.artists.map((artist) => (
                  <div
                    key={artist.id}
                    className="flex items-center gap-4 p-4 bg-surface/50 rounded-lg"
                  >
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="w-16 h-16 object-cover rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{artist.name}</h3>
                      <p className="text-secondary text-sm">Artist</p>
                    </div>
                    <motion.button
                      onClick={() => handleAddItem(artist.id, 'artist')}
                      disabled={addedItems.has(artist.id)}
                      className="text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                      whileTap={{ scale: 0.95 }}
                    >
                      <AnimatePresence mode="wait">
                        {addedItems.has(artist.id) ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.1 }}
                          >
                            <IoCheckmark size={24} />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="add"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.1 }}
                          >
                            <IoAdd size={24} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </div>
                ))
              ) : searchTerm.length >= 2 ? (
                <div className="text-center py-8">
                  <p className="text-secondary">No {activeSearchTab} found</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-secondary">Start typing to search for {activeSearchTab}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListDetails;
