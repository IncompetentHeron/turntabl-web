// supabase/functions/sync-popular-albums/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import axios from 'npm:axios'; // Using axios as it's already in the project

// Define CORS headers for local development and cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Retrieve Spotify API credentials from environment variables
// Note: For server-side functions, it's best practice to use direct environment variables
// without the VITE_ prefix, as these are sensitive secrets.
const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');

// Retrieve Supabase credentials from environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Validate that all required environment variables are set
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables for Spotify or Supabase.');
  // Throwing an error will prevent the function from deploying or running if secrets are missing
  throw new Error('Missing required environment variables. Please ensure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are set.');
}

// Initialize Supabase Admin client using the service role key
// This client bypasses Row Level Security and is used for backend operations.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Variables to store Spotify access token and its expiration time
let accessToken: string | null = null;
let tokenExpirationTime: number | null = null;

/**
 * Fetches a new Spotify access token using the Client Credentials Flow.
 * Caches the token and its expiration time to avoid unnecessary requests.
 */
async function getSpotifyAccessToken(): Promise<string> {
  // Return cached token if it's still valid
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
        // Encode client ID and secret for Basic Authorization
        Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      },
    }
  );

  // Store the new token and calculate its expiration time
  accessToken = response.data.access_token;
  tokenExpirationTime = Date.now() + (response.data.expires_in * 1000); // expires_in is in seconds

  console.log('Spotify access token obtained successfully.');
  return accessToken;
}

/**
 * Interface for the relevant Spotify album data.
 */
interface SpotifyAlbumData {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  images: { url: string }[];
  release_date: string;
  album_type: 'album' | 'single' | 'compilation';
  popularity: number; // Popularity score from Spotify (0-100)
  external_urls: { spotify: string };
}

/**
 * Fetches a list of popular new release albums from Spotify.
 * This endpoint provides albums with a 'popularity' score.
 */
async function fetchPopularAlbumsFromSpotify(limit: number = 50): Promise<SpotifyAlbumData[]> {
  const token = await getSpotifyAccessToken();
  console.log(`Fetching ${limit} new releases from Spotify...`);
  const response = await axios.get(
    `https://api.spotify.com/v1/browse/new-releases?country=US&limit=${limit}`, // 'US' country code for consistent results
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  console.log(`Successfully fetched ${response.data.albums.items.length} albums.`);
  return response.data.albums.items;
}

/**
 * Upserts (inserts or updates) album data into the Supabase 'albums' table.
 * Uses 'id' as the conflict target to update existing records.
 */
async function upsertAlbumsToSupabase(albums: SpotifyAlbumData[]) {
  // Map Spotify album data to your Supabase 'albums' table schema
  const albumsToUpsert = albums.map(album => ({
    id: album.id,
    name: album.name,
    artist: album.artists[0]?.name || 'Unknown Artist', // Take the first artist
    artist_id: album.artists[0]?.id || 'unknown', // Take the first artist's ID
    cover_url: album.images[0]?.url || 'https://via.placeholder.com/300', // Use the first image as cover
    release_date: album.release_date,
    album_type: album.album_type,
    popularity: album.popularity, // Store Spotify's popularity score
    spotify_url: album.external_urls?.spotify,
    updated_at: new Date().toISOString(), // Update timestamp
  }));

  console.log(`Upserting ${albumsToUpsert.length} albums into Supabase...`);
  const { data, error } = await supabaseAdmin
    .from('albums')
    .upsert(albumsToUpsert, { onConflict: 'id' }); // Use 'id' as the conflict key for upsert

  if (error) {
    console.error('Error upserting albums:', error);
    throw error;
  }
  console.log('Albums upserted successfully.');
  return data;
}

/**
 * Main Deno server handler for the Edge Function.
 * This function will be invoked when the Edge Function is called.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting sync-popular-albums function execution...');
    
    // Fetch popular albums from Spotify
    const spotifyAlbums = await fetchPopularAlbumsFromSpotify();
    
    // Upsert the fetched albums into the Supabase database
    await upsertAlbumsToSupabase(spotifyAlbums);

    // Return a success response
    return new Response(
      JSON.stringify({ message: 'Popular albums synced successfully', count: spotifyAlbums.length }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    // Log and return an error response if anything goes wrong
    console.error('Error in sync-popular-albums function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to sync popular albums',
        // Include more details from axios error if available
        details: error.response?.data || null 
      }),
      {
        status: 500, // Internal Server Error
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
