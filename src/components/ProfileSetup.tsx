import { useState } from 'react';
import { useUser } from '../hooks/useUser';
import { updateProfile } from '../lib/supabase';
import AvatarUpload from './AvatarUpload';

interface ProfileSetupProps {
  email: string;
  username: string;
  onComplete: () => void;
}

export default function ProfileSetup({ email, username, onComplete }: ProfileSetupProps) {
  const { user } = useUser();
  const [formData, setFormData] = useState({
    username,
    display_name: username,
    pronouns: '',
    bio: '',
    avatar_url: null as string | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await updateProfile({
        ...formData,
        id: user.id,
      });
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Complete Your Profile</h2>
        <p className="text-secondary">Tell us a bit about yourself</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center mb-6">
          <AvatarUpload
            currentUrl={formData.avatar_url}
            onUpload={(url) => setFormData(prev => ({ ...prev, avatar_url: url }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Display Name</label>
          <input
            type="text"
            value={formData.display_name}
            onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
            className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Pronouns</label>
          <input
            type="text"
            value={formData.pronouns}
            onChange={(e) => setFormData(prev => ({ ...prev, pronouns: e.target.value }))}
            className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
            placeholder="e.g., they/them, she/her, he/him"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            className="w-full h-32 px-4 py-2 bg-surface border border-white/10 rounded-lg"
            placeholder="Tell us about yourself..."
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Complete Profile'}
        </button>
      </form>
    </div>
  );
}