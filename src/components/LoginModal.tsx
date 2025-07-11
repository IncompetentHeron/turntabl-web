import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface LoginModalProps {
  onClose: () => void;
  onSignUpClick: () => void;
}

export default function LoginModal({ onClose, onSignUpClick }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (useMagicLink) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
        });
        if (error) throw error;
        // Show success message
        alert('Check your email for the login link!');
        onClose();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            setShowSignUpPrompt(true);
            throw new Error('Invalid email or password');
          }
          throw signInError;
        }
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      alert('Check your email for password reset instructions');
    } catch (err: any) {
      setError(err.message);
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
          <h2 className="text-2xl font-bold">Welcome Back</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setShowSignUpPrompt(false);
              }}
              className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-white"
              required
            />
            {showSignUpPrompt && (
              <div className="mt-2">
                <p className="text-secondary text-sm">No account found with this email.</p>
                <button
                  type="button"
                  onClick={onSignUpClick}
                  className="text-accent hover:text-accent/80 text-sm"
                >
                  Create an account →
                </button>
              </div>
            )}
          </div>

          {!useMagicLink && (
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-white"
                required={!useMagicLink}
              />
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : (useMagicLink ? 'Send Magic Link' : 'Log In')}
          </button>

          <button
            type="button"
            onClick={() => setUseMagicLink(!useMagicLink)}
            className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-white hover:bg-white/5"
          >
            {useMagicLink ? 'Use Password' : 'Use Magic Link'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResetPassword}
              className="text-accent hover:text-accent/80 text-sm"
            >
              Forgot your password?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}