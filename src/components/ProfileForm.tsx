import { useState, useEffect } from 'react';
import { useUser } from '../hooks/useUser';
import { updateProfile } from '../lib/supabase';
import type { Profile } from '../lib/supabase';
import AvatarUpload from './AvatarUpload';
import { format, addDays } from 'date-fns';

const COMMON_PRONOUNS = [
  'he', 'him', 'his',
  'she', 'her', 'hers',
  'they', 'them', 'their',
  'ze', 'zir', 'zirs',
  'xe', 'xem', 'xyrs'
];

interface ProfileFormProps {
  profile: Profile;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ProfileForm({ profile, onSuccess, onCancel }: ProfileFormProps) {
  const { user } = useUser();
  const [formData, setFormData] = useState({
    username: profile.username || '',
    display_name: profile.display_name || '',
    pronouns: profile.pronouns ? profile.pronouns.split('/') : [],
    bio: profile.bio || '',
    avatar_url: profile.avatar_url,
  });
  const [pronounInput, setPronounInput] = useState('');
  const [filteredPronouns, setFilteredPronouns] = useState<string[]>([]);
  const [showPronounDropdown, setShowPronounDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const [bioLength, setBioLength] = useState(0);

  useEffect(() => {
    setBioLength(formData.bio.length);
  }, [formData.bio]);

  useEffect(() => {
    if (pronounInput) {
      setFilteredPronouns(
        COMMON_PRONOUNS.filter(p => 
          p.toLowerCase().includes(pronounInput.toLowerCase()) &&
          !formData.pronouns.includes(p)
        )
      );
      setShowPronounDropdown(true);
    } else {
      setShowPronounDropdown(false);
    }
  }, [pronounInput, formData.pronouns]);

  const handlePronounAdd = (pronoun: string) => {
    if (formData.pronouns.length >= 4) {
      setError(prev => ({ ...prev, pronouns: 'Maximum 4 pronouns allowed' }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      pronouns: [...prev.pronouns, pronoun]
    }));
    setPronounInput('');
    setShowPronounDropdown(false);
  };

  const handlePronounRemove = (index: number) => {
    setFormData(prev => ({
      ...prev,
      pronouns: prev.pronouns.filter((_, i) => i !== index)
    }));
  };

  const canChangeUsername = () => {
    if (!profile.last_username_change) return true;
    const nextChangeDate = addDays(new Date(profile.last_username_change), 7);
    return new Date() >= nextChangeDate;
  };

  const getNextUsernameChangeDate = () => {
    if (!profile.last_username_change) return null;
    return addDays(new Date(profile.last_username_change), 7);
  };

  const validateDisplayName = (value: string) => {
    if (value.length > 50) return 'Display name must be less than 50 characters';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError({});

    try {
      if (!canChangeUsername() && formData.username !== profile.username) {
        const nextDate = getNextUsernameChangeDate();
        throw new Error(`Username cannot be changed until ${format(nextDate!, 'MMM d, yyyy')}`);
      }

      const displayNameError = validateDisplayName(formData.display_name);
      if (displayNameError) {
        throw new Error(displayNameError);
      }

      await updateProfile({
        id: user.id,
        ...formData,
        pronouns: formData.pronouns.join('/'),
      });
      onSuccess();
    } catch (err: any) {
      setError(prev => ({ ...prev, submit: err.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarUpload = (url: string | null) => {
    setFormData(prev => ({ ...prev, avatar_url: url }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-center">
        <AvatarUpload
          currentUrl={formData.avatar_url}
          onUpload={handleAvatarUpload}
          size="lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Username</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
          className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
          required
          pattern="[a-zA-Z0-9]+"
          title="Username can only contain letters and numbers"
          maxLength={30}
          aria-describedby="username-info"
          disabled={!canChangeUsername()}
        />
        <div id="username-info" className="mt-2 text-sm space-y-1">
          <p className="text-secondary">{formData.username.length}/30 characters</p>
          {profile.last_username_change && (
            <p className="text-secondary">
              Last changed: {format(new Date(profile.last_username_change), 'MMM d, yyyy')}
            </p>
          )}
          {!canChangeUsername() && (
            <p className="text-secondary">
              Next change available: {format(getNextUsernameChangeDate()!, 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Display Name</label>
        <input
          type="text"
          value={formData.display_name}
          onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
          className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
          maxLength={50}
        />
        <p className="text-secondary text-sm mt-1">
          {formData.display_name.length}/50 characters
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Pronouns</label>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.pronouns.map((pronoun, index) => (
              <span
                key={index}
                className="bg-surface px-2 py-1 rounded-full text-sm flex items-center gap-1"
              >
                {pronoun}
                <button
                  type="button"
                  onClick={() => handlePronounRemove(index)}
                  className="text-secondary hover:text-primary"
                  aria-label={`Remove ${pronoun}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={pronounInput}
              onChange={(e) => setPronounInput(e.target.value)}
              className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg"
              placeholder="Type to add pronouns"
              aria-label="Add pronouns"
              disabled={formData.pronouns.length >= 4}
            />
            {showPronounDropdown && filteredPronouns.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-surface border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredPronouns.map((pronoun) => (
                  <li key={pronoun}>
                    <button
                      type="button"
                      onClick={() => handlePronounAdd(pronoun)}
                      className="w-full px-4 py-2 text-left hover:bg-white/5"
                    >
                      {pronoun}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error.pronouns && (
            <p className="text-red-500 text-sm">{error.pronouns}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Bio</label>
        <div className="relative">
          <textarea
            value={formData.bio}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 150) {
                setFormData(prev => ({ ...prev, bio: value }));
                setBioLength(value.length);
              }
            }}
            className="w-full h-32 px-4 py-2 bg-surface border border-white/10 rounded-lg resize-none break-words hyphens-auto"
            style={{ minHeight: '96px' }}
            maxLength={150}
            aria-describedby="bio-counter"
          />
          <div
            id="bio-counter"
            className="absolute bottom-2 right-2 text-sm text-secondary"
          >
            {bioLength}/150 characters
          </div>
        </div>
      </div>

      {error.submit && (
        <div className="text-red-500 text-sm" role="alert">{error.submit}</div>
      )}

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-secondary hover:text-primary transition-colors"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}