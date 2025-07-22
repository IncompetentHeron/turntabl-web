import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFollowSuggestions, dismissSuggestion } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import SuggestedProfileCard from '../components/SuggestedProfileCard';
import { IoArrowBackOutline } from 'react-icons/io5';
import { Link } from 'react-router-dom';

export default function FollowSuggestionsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading, error } = useQuery({
    queryKey: ['followSuggestions', 'all', user?.id],
    queryFn: () => getFollowSuggestions(50), // Fetch more for the full page
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const dismissMutation = useMutation({
    mutationFn: dismissSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followSuggestions'] });
    },
  });

  const handleDismiss = async (profileId: string) => {
    await dismissMutation.mutateAsync(profileId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Loading suggestions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-secondary">Error loading suggestions.</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12 bg-surface rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Sign In to See Suggestions</h2>
        <p className="text-secondary mb-4">
          Log in or create an account to find new people to follow.
        </p>
        <Link to="/" className="btn btn-primary">
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="text-secondary hover:text-primary">
          <IoArrowBackOutline size={24} />
        </Link>
        <h1 className="text-3xl font-bold">Suggestions for You</h1>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((profile) => (
            <SuggestedProfileCard key={profile.id} profile={profile} onDismiss={handleDismiss} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-surface rounded-lg">
          <h2 className="text-2xl font-bold mb-2">No New Suggestions</h2>
          <p className="text-secondary mb-4">
            Check back later for more recommendations!
          </p>
        </div>
      )}
    </div>
  );
}
