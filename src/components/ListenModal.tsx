import { useState } from 'react';
import { format } from 'date-fns';
import { useUser } from '../hooks/useUser';
import { createListen } from '../lib/supabase';

interface ListenModalProps {
  albumId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ListenModal({ albumId, onClose, onSuccess }: ListenModalProps) {
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await createListen({
        user_id: user.id,
        album_id: albumId,
        listened_at: new Date(selectedDate).toISOString(),
        note: note.trim() || null,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface p-6 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Log Listen</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-32 px-4 py-2 bg-surface border border-white/10 rounded-lg resize-none"
              placeholder="Add a note about your listening experience..."
            />
          </div>

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Listen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}