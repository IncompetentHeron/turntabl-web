import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import axios from 'npm:axios';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SPOTIFY_CLIENT_ID = Deno.env.get('VITE_SPOTIFY_CLIENT_ID'); // Use VITE_ prefix if that's how it's set in your .env
const SPOTIFY_CLIENT_SECRET = Deno.env.get('VITE_SPOTIFY_CLIENT_SECRET'); // Use VITE_ prefix
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables for Spotify or Supabase.');
  throw new Error('Missing required environment variables. Please ensure Spotify and Supabase keys are set.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

interface SpotifyAlbumData {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  images: { url: string }[];
  release_date: string;
  album_type: 'album' | 'single' | 'compilation';
  popularity?: number;
  external_urls: { spotify: string };
  tracks?: { items: { id: string; name: string; duration_ms: number; track_number: number }[] };
}

async function upsertAlbumsToSupabase(albums: SpotifyAlbumData[]) {
  if (albums.length === 0) return;
  const albumsToUpsert = albums.map(album => ({
    id: album.id,
    name: album.name,
    artist: album.artists[0]?.name || 'Unknown Artist',
    artist_id: album.artists[0]?.id || 'unknown',
    cover_url: album.images[0]?.url || 'https://via.placeholder.com/300',
    release_date: album.release_date,
    album_type: album.album_type,
    popularity: album.popularity || 0,
    spotify_url: album.external_urls?.spotify,
    // Map Spotify track format to your Supabase Track interface
    tracks: album.tracks?.items.map(track => ({
      id: track.id,
      name: track.name,
      duration: Math.floor(track.duration_ms / 1000), // Convert ms to seconds
      trackNumber: track.track_number,
    })),
    updated_at: new Date().toISOString(),
  }));

  console.log(`Upserting ${albumsToUpsert.length} albums into Supabase...`);
  const { data, error } = await supabaseAdmin
    .from('albums')
    .upsert(albumsToUpsert, { onConflict: 'id' });

  if (error) {
    console.error('Error upserting albums:', error);
    throw error;
  }
  console.log('Albums upserted successfully.');
  return data;
}

async function getSpotifyAlbumDetails(albumId: string): Promise<SpotifyAlbumData | null> {
  try {
    const data = await spotifyApiCall<any>(`/albums/${albumId}`);
    return data;
  } catch (error) {
    console.warn(`Could not fetch full details for album ${albumId}:`, error.message);
    return null;
  }
}

async function fetchAlbumsMissingTracks(limit: number = 100): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('albums')
    .select('id')
    .is('tracks', null) // Find albums where the tracks column is NULL
    .limit(limit);

  if (error) {
    console.error('Error fetching albums missing tracks from Supabase:', error.message);
    return [];
  }
  return data.map(album => album.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting migrate-album-tracks function execution...');

    let totalPopulated = 0;
    let hasMore = true;
    const BATCH_FETCH_LIMIT = 100; // How many album IDs to fetch from Supabase at once
    const SPOTIFY_BATCH_SIZE = 20; // How many album details to fetch from Spotify at once

    while (hasMore) {
      const albumsToPopulateTracks = await fetchAlbumsMissingTracks(BATCH_FETCH_LIMIT);
      if (albumsToPopulateTracks.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Found ${albumsToPopulateTracks.length} albums missing track data.`);

      for (let i = 0; i < albumsToPopulateTracks.length; i += SPOTIFY_BATCH_SIZE) {
        const batchIds = albumsToPopulateTracks.slice(i, i + SPOTIFY_BATCH_SIZE);
        console.log(`  Fetching details for batch of ${batchIds.length} albums from Spotify.`);
        
        const fullAlbumDetailsPromises = batchIds.map(id => getSpotifyAlbumDetails(id));
        const fullAlbumDetails = (await Promise.all(fullAlbumDetailsPromises)).filter(Boolean);

        if (fullAlbumDetails.length > 0) {
          await upsertAlbumsToSupabase(fullAlbumDetails);
          totalPopulated += fullAlbumDetails.length;
          console.log(`  Successfully updated ${fullAlbumDetails.length} albums in Supabase.`);
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between Spotify batches
      }
      console.log(`Current total populated: ${totalPopulated}`);
      // Add a larger delay between Supabase fetches to avoid hammering the DB
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`Migration complete. Total albums populated with track data: ${totalPopulated}`);

    return new Response(
      JSON.stringify({
        message: 'Album track data migration completed successfully',
        totalAlbumsPopulated: totalPopulated,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in migrate-album-tracks function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to migrate album track data',
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
