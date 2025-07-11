import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IoSettingsOutline, IoLogOutOutline, IoTrashOutline, IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import { supabase, updateProfilePrivacy } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import type { Profile } from '../lib/supabase';

interface ProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onEditClick: () => void;
  profile: Profile;
}

export default function ProfileMenu({ isOpen, onClose, onEditClick, profile }: ProfileMenuProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrivacyConfirm, setShowPrivacyConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const privacyMutation = useMutation({
    mutationFn: (isPrivate: boolean) => updateProfilePrivacy(profile.id, isPrivate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
      setShowPrivacyConfirm(false);
      onClose();
    },
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setIsLoggingOut(false);
      onClose();
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete account');

      await supabase.auth.signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setError(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrivacyToggle = () => {
    setShowPrivacyConfirm(true);
  };

  const confirmPrivacyChange = async () => {
    try {
      await privacyMutation.mutateAsync(!profile.is_private);
    } catch (error) {
      console.error('Error updating privacy:', error);
    }
  };

  if (!isOpen) return null;

  if (showPrivacyConfirm) {
    return (
      <div className="absolute right-0 mt-2 w-80 bg-surface rounded-lg shadow-lg border border-white/10 p-4 z-50">
        <h3 className="text-lg font-bold mb-2">
          Switch to {profile.is_private ? 'Public' : 'Private'}?
        </h3>
        <p className="text-secondary mb-4 text-sm">
          {profile.is_private 
            ? 'Your profile and content will be visible to everyone.'
            : 'Your profile and content will only be visible to your followers.'
          }
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setShowPrivacyConfirm(false);
              setError(null);
            }}
            className="px-3 py-1 text-secondary hover:text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmPrivacyChange}
            disabled={privacyMutation.isPending}
            className="px-3 py-1 bg-accent hover:bg-accent/90 text-white rounded"
          >
            {privacyMutation.isPending ? 'Updating...' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  }

  if (showDeleteConfirm) {
    return (
      <div className="absolute right-0 mt-2 w-72 bg-surface rounded-lg shadow-lg border border-white/10 p-4 z-50">
        <h3 className="text-lg font-bold mb-2">Delete Account</h3>
        <p className="text-secondary mb-4">
          This action cannot be undone. All your data will be permanently deleted.
        </p>
        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setShowDeleteConfirm(false);
              setError(null);
            }}
            className="px-3 py-1 text-secondary hover:text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
          >
            {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 mt-2 w-48 bg-surface rounded-lg shadow-lg border border-white/10 py-1 z-50">
      <button
        onClick={() => {
          onEditClick();
          onClose();
        }}
        className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-white/5"
      >
        <IoSettingsOutline className="text-lg" />
        Edit Profile
      </button>
      <button
        onClick={handlePrivacyToggle}
        className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-white/5"
      >
        {profile.is_private ? (
          <IoEyeOutline className="text-lg" />
        ) : (
          <IoEyeOffOutline className="text-lg" />
        )}
        Switch to {profile.is_private ? 'Public' : 'Private'}
      </button>
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-white/5 text-red-500"
      >
        <IoLogOutOutline className="text-lg" />
        {isLoggingOut ? 'Logging out...' : 'Log out'}
      </button>
      <hr className="border-white/10 my-1" />
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-white/5 text-red-500"
      >
        <IoTrashOutline className="text-lg" />
        Delete Account
      </button>
    </div>
  );
}