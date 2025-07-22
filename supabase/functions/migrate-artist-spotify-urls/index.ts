// supabase/functions/migrate-artist-spotify-urls/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import axios from 'npm:axios';

// CORS headers (standard for Edge Functions)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Environment variables
const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Validate environment variables
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables for Spotify or Supabase.');
  throw new Error('Missing required environment variables. Please ensure Spotify and Supabase keys are set.');
}

// Supabase Admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Spotify Access Token management
let accessToken: string | null = null;
let tokenExpirationTime: number | null = null;

async function getSpotifyAccessToken(): Promise<string> {
  if (accessToken && tokenExpirationTime && Date.now() < tokenExpirationTime) {
    return accessToken;
  }

  console.log('Fetching new Spotify access token...');
  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      },
    }
  );

  accessToken = response.data.access_token;
  tokenExpirationTime = Date.now() + (response.data.expires_in * 1000);
  console.log('Spotify access token obtained successfully.');
  return accessToken;
}

// Spotify API Call Wrapper with Retry Logic
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function spotifyApiCall<T>(endpoint: string): Promise<T> {
  let currentRetry = 0;
  while (currentRetry <= MAX_RETRIES) {
    try {
      const token = await getSpotifyAccessToken();
      const response = await axios.get(`https://api.spotify.com/v1${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY_MS * (currentRetry + 1);
        console.warn(`Rate limit hit. Retrying after ${delay / 1000} seconds... (Attempt ${currentRetry + 1}/${MAX_RETRIES}) for endpoint: ${endpoint}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        currentRetry++;
      } else {
        console.error(`Error in spotifyApiCall for ${endpoint}:`, error.message);
        throw error;
      }
    }
  }
  throw new Error(`Failed after ${MAX_RETRIES} retries for endpoint: ${endpoint}`);
}

// Spotify Artist Data Interface (simplified for what's needed for upsert)
interface SpotifyArtistData {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  external_urls: { spotify: string };
}

// Function to fetch artist profile from Spotify
async function getSpotifyArtistProfile(artistId: string): Promise<SpotifyArtistData | null> {
  try {
    const artistData = await spotifyApiCall<any>(`/artists/${artistId}`);
    return artistData;
  } catch (error) {
    console.error(`Error fetching artist ${artistId} from Spotify:`, error.message);
    return null;
  }
}

// Function to upsert artists to Supabase
async function upsertArtistsToSupabase(artists: SpotifyArtistData[]) {
  if (artists.length === 0) return;
  const artistsToUpsert = artists.map(artist => ({
    id: artist.id,
    name: artist.name,
    image_url: artist.images[0]?.url || null, // Use null if no image
    spotify_url: artist.external_urls?.spotify || null, // Use null if no spotify_url
    genres: artist.genres || [],
    updated_at: new Date().toISOString(),
  }));

  console.log(`Upserting ${artistsToUpsert.length} artists into Supabase...`);
  const { data, error } = await supabaseAdmin
    .from('artists')
    .upsert(artistsToUpsert, { onConflict: 'id' });

  if (error) {
    console.error('Error upserting artists:', error);
    throw error;
  }
  console.log('Artists upserted successfully.');
  return data;
}

// Main handler for the Edge Function
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting migrate-artist-spotify-urls function execution...');

    let offset = 0;
    const limit = 100; // Fetch artists from Supabase in batches
    let totalArtistsProcessed = 0;
    let hasMoreArtists = true;

    while (hasMoreArtists) {
      // Fetch artist IDs from Supabase
      const { data: supabaseArtists, error: fetchError } = await supabaseAdmin
        .from('artists')
        .select('id')
        .range(offset, offset + limit - 1);

      if (fetchError) {
        console.error('Error fetching artists from Supabase:', fetchError.message);
        throw fetchError;
      }

      if (!supabaseArtists || supabaseArtists.length === 0) {
        hasMoreArtists = false;
        break;
      }

      console.log(`Processing batch of ${supabaseArtists.length} artists (offset: ${offset})...`);

      const spotifyFetchPromises = supabaseArtists.map(artist => getSpotifyArtistProfile(artist.id));
      const spotifyArtistData = (await Promise.all(spotifyFetchPromises)).filter(Boolean); // Filter out nulls (failed fetches)

      if (spotifyArtistData.length > 0) {
        await upsertArtistsToSupabase(spotifyArtistData);
        totalArtistsProcessed += spotifyArtistData.length;
      }

      offset += limit;
      // Add a delay to respect Spotify API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay per batch
    }

    console.log(`Migration complete. Total artists processed: ${totalArtistsProcessed}`);

    return new Response(
      JSON.stringify({
        message: 'Artist Spotify URLs migration completed successfully',
        totalArtistsProcessed: totalArtistsProcessed,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in migrate-artist-spotify-urls function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to migrate artist Spotify URLs',
        details: error.response?.data || null,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
