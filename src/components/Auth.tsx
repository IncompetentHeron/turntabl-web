import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';

interface AuthModalProps {
  onClose: () => void;
  defaultView?: 'sign_in' | 'sign_up';
}

export default function AuthModal({ onClose, defaultView = 'sign_in' }: AuthModalProps) {
  const [view, setView] = useState(defaultView);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return null;
  };

  const validateUsername = useCallback((value: string) => {
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 30) return 'Username must be less than 30 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores';
    return null;
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError({});
    
    const emailError = validateEmail(email);
    if (emailError) {
      setError(prev => ({ ...prev, email: emailError }));
      return;
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(prev => ({ ...prev, username: usernameError }));
      return;
    }

    if (password !== confirmPassword) {
      setError(prev => ({ ...prev, password: 'Passwords do not match' }));
      return;
    }

    if (password.length < 6) {
      setError(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
      return;
    }

    setIsLoading(true);

    try {
      // Check if username is taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .single();

      if (existingUser) {
        setError(prev => ({ ...prev, username: 'Username is already taken' }));
        return;
      }

      // Sign up the user
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase()
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!user) throw new Error('Failed to create user');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: username.toLowerCase(),
          display_name: username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // Sign in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;

      onClose();
    } catch (err: any) {
      console.error('Error in handleSignUp:', err);
      setError(prev => ({ ...prev, general: err.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError({});

    const emailError = validateEmail(email);
    if (emailError) {
      setError(prev => ({ ...prev, email: emailError }));
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError(prev => ({ ...prev, password: 'Invalid email or password' }));
          return;
        }
        throw signInError;
      }

      onClose();
    } catch (err: any) {
      setError(prev => ({ ...prev, general: err.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError(prev => ({ ...prev, email: 'Please enter your email address' }));
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      setError(prev => ({ ...prev, email: emailError }));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      alert('Check your email for password reset instructions');
    } catch (err: any) {
      setError(prev => ({ ...prev, general: err.message }));
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
            {view === 'sign_in' ? 'Welcome Back' : 'Join Turntabl'}
          </h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            ✕
          </button>
        </div>

        <form onSubmit={view === 'sign_up' ? handleSignUp : handleSignIn} className="space-y-4">
          {view === 'sign_up' && (
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase();
                  setUsername(value);
                  const validationError = validateUsername(value);
                  setError(prev => validationError 
                    ? { ...prev, username: validationError }
                    : { ...prev, username: undefined }
                  );
                }}
                className={`w-full px-4 py-2 bg-surface border rounded-lg transition-colors ${
                  error.username ? 'border-red-500' : 'border-white/10'
                }`}
                required
                maxLength={30}
              />
              {error.username && (
                <p className="text-red-500 text-sm mt-1">{error.username}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                const validationError = validateEmail(e.target.value);
                setError(prev => validationError 
                  ? { ...prev, email: validationError }
                  : { ...prev, email: undefined }
                );
              }}
              className={`w-full px-4 py-2 bg-surface border rounded-lg transition-colors ${
                error.email ? 'border-red-500' : 'border-white/10'
              }`}
              required
            />
            {error.email && (
              <p className="text-red-500 text-sm mt-1">{error.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-2 bg-surface border rounded-lg transition-colors ${
                  error.password ? 'border-red-500' : 'border-white/10'
                }`}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
              >
                {showPassword ? <IoEyeOffOutline size={20} /> : <IoEyeOutline size={20} />}
              </button>
            </div>
            {error.password && (
              <p className="text-red-500 text-sm mt-1">{error.password}</p>
            )}
          </div>

          {view === 'sign_up' && (
            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-2 bg-surface border rounded-lg transition-colors ${
                    error.password ? 'border-red-500' : 'border-white/10'
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                >
                  {showConfirmPassword ? <IoEyeOffOutline size={20} /> : <IoEyeOutline size={20} />}
                </button>
              </div>
            </div>
          )}

          {error.general && (
            <p className="text-red-500 text-sm">{error.general}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading}
          >
            {isLoading
              ? 'Loading...'
              : view === 'sign_up'
              ? 'Create account'
              : 'Log in'}
          </button>

          <div className="flex justify-between text-sm">
            {view === 'sign_in' ? (
              <>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-accent hover:text-accent/80"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setView('sign_up')}
                  className="text-accent hover:text-accent/80"
                >
                  Create account
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setView('sign_in')}
                className="text-accent hover:text-accent/80"
              >
                Already have an account? Log in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}