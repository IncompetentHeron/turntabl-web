import { getArtistProfile } from '../lib/spotify';

export async function resyncArtistDiscography(artistId: string) {
  try {
    console.log(`Attempting to re-sync artist: ${artistId}`);
    // Fetch the artist's current profile data from Spotify
    const spotifyArtistData = await getArtistProfile(artistId);

    if (!spotifyArtistData) {
      console.error(`Artist ${artistId} not found on Spotify. Cannot re-sync.`);
      return;
    }

    // Call the sync-artist Edge Function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-artist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ artist: spotifyArtistData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error re-syncing artist ${artistId}:`, response.status, errorText);
      throw new Error(`Failed to re-sync artist ${artistId}: ${errorText}`);
    }

    console.log(`Successfully re-synced artist ${artistId}. You may need to refresh the page.`);
  } catch (error) {
    console.error(`An unexpected error occurred while trying to re-sync artist ${artistId}:`, error);
  }
}
