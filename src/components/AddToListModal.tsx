import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserLists, createList, addToList } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { IoAdd } from 'react-icons/io5';

interface AddToListModalProps {
  albumId?: string;
  artistId?: string;
  onClose: () => void;
}

export default function AddToListModal({ albumId, artistId, onClose }: AddToListModalProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newList, setNewList] = useState({
    title: '',
    description: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Validate that either albumId or artistId is provided
  if (!albumId && !artistId) {
    throw new Error('Either albumId or artistId must be provided');
  }

  const { data: lists, isLoading } = useQuery({
    queryKey: ['userLists', user?.id],
    queryFn: () => getUserLists(user!.id),
    enabled: !!user,
  });

  const createListMutation = useMutation({
    mutationFn: (list: { user_id: string; title: string; description?: string }) =>
      createList(list),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userLists', user?.id] });
      setShowCreateForm(false);
      setNewList({ title: '', description: '' });
    },
  });

  const addToListMutation = useMutation({
    mutationFn: (listId: string) => {
      const payload: { list_id: string; album_id?: string; artist_id?: string } = {
        list_id: listId,
      };
      
      if (albumId) {
        payload.album_id = albumId;
      } else if (artistId) {
        payload.artist_id = artistId;
      }
      
      return addToList(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userLists', user?.id] });
      onClose();
    },
  });

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setError(null);
      await createListMutation.mutateAsync({
        user_id: user.id,
        ...newList,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddToList = async (listId: string) => {
    try {
      setError(null);
      await addToListMutation.mutateAsync(listId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const itemType = albumId ? 'album' : 'artist';

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-surface p-6 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Add {itemType} to List</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
          >
            ✕
          </button>
        </div>

        {showCreateForm ? (
          <form onSubmit={handleCreateList} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">List Title</label>
              <input
                type="text"
                value={newList.title}
                onChange={(e) => setNewList(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description (optional)</label>
              <textarea
                value={newList.description}
                onChange={(e) => setNewList(prev => ({ ...prev, description: e.target.value }))}
                className="w-full h-32 px-4 py-2 bg-surface border border-white/10 rounded-lg resize-none"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createListMutation.isPending}
              >
                {createListMutation.isPending ? 'Creating...' : 'Create List'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full p-4 border-2 border-dashed border-white/10 rounded-lg hover:border-white/20 transition-colors flex items-center justify-center gap-2"
            >
              <IoAdd className="text-xl" />
              Create New List
            </button>

            {isLoading ? (
              <p className="text-center text-secondary">Loading lists...</p>
            ) : lists && lists.length > 0 ? (
              <div className="space-y-2">
                {lists
                  .filter(list => list.id !== 'liked-albums-list') // Filter out virtual lists
                  .map((list) => {
                    const firstItemCover = list.list_items?.[0]?.album?.coverUrl || list.list_items?.[0]?.artist?.imageUrl;
                    return (
                      <button
                        key={list.id}
                        onClick={() => handleAddToList(list.id)}
                        disabled={addToListMutation.isPending}
                        className="w-full p-4 bg-surface hover:bg-white/5 transition-colors rounded-lg text-left flex items-center gap-4"
                      >
                        {firstItemCover && (
                          <img
                            src={firstItemCover}
                            alt={list.title}
                            className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                          />
                        )}
                        <div>
                          <h3 className="font-bold text-lg mb-1">{list.title}</h3>
                          {list.description && (
                            <p className="text-secondary text-sm">{list.description}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            ) : (
              <p className="text-center text-secondary">No lists yet</p>
            )}

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
