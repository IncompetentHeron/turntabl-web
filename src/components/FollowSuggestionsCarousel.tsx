import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFollowSuggestions, dismissSuggestion } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import SuggestedProfileCard from './SuggestedProfileCard';

export default function FollowSuggestionsCarousel() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['followSuggestions', user?.id],
    queryFn: () => getFollowSuggestions(10), // Fetch up to 10 for the carousel
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
      <section>
        <h2 className="text-2xl font-bold mb-4">Suggestions for You</h2>
        <div className="text-center py-8">
          <p className="text-secondary">Loading suggestions...</p>
        </div>
      </section>
    );
  }

  if (!user || suggestions.length === 0) {
    return null; // Don't show if no user or no suggestions
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Suggestions for You</h2>
        <Link
          to="/suggestions"
          className="text-accent hover:text-accent/80 transition-colors"
        >
          See All
        </Link>
      </div>
      <div className="flex overflow-x-auto space-x-4 pb-4">
        {suggestions.map((profile) => (
          <div key={profile.id} className="flex-shrink-0 w-64">
            <SuggestedProfileCard profile={profile} onDismiss={handleDismiss} />
          </div>
        ))}
      </div>
    </section>
  );
}
