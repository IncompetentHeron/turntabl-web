import { useState } from 'react';
import { supabase } from '../lib/supabase';
import ProfileSetup from './ProfileSetup';

const MAX_USERNAME_LENGTH = 30;

interface SignUpModalProps {
  onClose: () => void;
  onLoginClick?: () => void;
}

export default function SignUpModal({ onClose, onLoginClick }: SignUpModalProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setUsernameError(null);
    setPasswordError(null);

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Check if username is taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        setUsernameError('This username is already taken');
        setIsLoading(false);
        return;
      }

      // Try to sign up
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        // Handle specific error cases
        if (signUpError.message.includes('already registered')) {
          setEmailError('An account with this email already exists');
        } else if (signUpError.message.includes('password')) {
          setPasswordError(signUpError.message);
        } else {
          throw signUpError;
        }
        return;
      }

      // Sign out immediately after signup to prevent auto-login
      await supabase.auth.signOut();
      setShowProfileSetup(true);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div       
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-surface p-6 rounded-lg w-full max-w-md max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {showProfileSetup ? 'Complete Your Profile' : 'Join Turntabl'}
          </h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            ✕
          </button>
        </div>

        {showProfileSetup ? (
          <div className="max-h-[70vh] overflow-y-auto">
            <ProfileSetup
              email={email}
              isEmailVerified={isEmailVerified}
              onEmailVerified={() => setIsEmailVerified(true)}
              onComplete={onClose}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-white"
                required
              />
              {emailError && (
                <div className="mt-2">
                  <p className="text-red-500 text-sm">{emailError}</p>
                  {emailError.includes('already exists') && (
                    <button
                      type="button"
                      onClick={onLoginClick}
                      className="text-accent hover:text-accent/80 text-sm"
                    >
                      Log in instead →
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.slice(0, MAX_USERNAME_LENGTH));
                  setUsernameError(null);
                }}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-white"
                required
                maxLength={MAX_USERNAME_LENGTH}
              />
              <p className="text-xs text-secondary mt-1">
                {username.length}/{MAX_USERNAME_LENGTH} characters
              </p>
              {usernameError && (
                <p className="text-red-500 text-sm mt-1">{usernameError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError(null);
                }}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-white"
                required
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-1">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}