import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import axios from 'npm:axios';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Use correct environment variable names for Edge Functions
const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
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
  tracks?: { id: string; name: string; duration_ms: number; track_number: number }[];
}

interface SpotifyArtistData {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  popularity: number;
  external_urls: { spotify: string };
}

async function fetchArtistAlbumsFromSpotify(artistId: string): Promise<SpotifyAlbumData[]> {
  let allAlbums: SpotifyAlbumData[] = [];
  let offset = 0;
  const limit = 50; // Max limit per request for artist albums endpoint

  console.log(`Fetching all albums for artist ID: ${artistId} from Spotify.`);
  while (true) {
    const data = await spotifyApiCall<any>(
      `/artists/${artistId}/albums?include_groups=album,single,compilation&limit=${limit}&offset=${offset}`
    );
    allAlbums = allAlbums.concat(data.items);
    if (data.next) {
      offset += limit;
    } else {
      break;
    }
  }
  console.log(`Fetched ${allAlbums.length} albums for artist ID: ${artistId} from Spotify.`);
  return allAlbums;
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
    tracks: album.tracks?.items.map(track => ({ // Changed from album.tracks?.map to album.tracks?.items.map
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


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey
      });
      throw new Error('Missing required environment variables');
    }

    // Parse request body first to fail fast if invalid
    const { artist } = await req.json();

    if (!artist) {
      throw new Error('Missing artist data in request body');
    }

    // Validate required fields
    const requiredFields = ['id', 'name'];
    const missingFields = requiredFields.filter(field => !artist[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Test database connection
    const { error: testError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Database connection test failed:', testError);
      throw new Error('Database connection failed');
    }

    // Attempt to upsert artist
    const { data, error } = await supabaseAdmin
      .from('artists')
      .upsert({
        id: artist.id,
        name: artist.name,
        image_url: artist.imageUrl,
        spotify_url: artist.spotifyUrl,
        genres: artist.genres || [],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting artist:', error);
      throw error;
    }

    // After upserting the artist, fetch and upsert their albums
    console.log(`Fetching and syncing albums for artist: ${artist.name} (${artist.id})`);
    const spotifyAlbumsBasic = await fetchArtistAlbumsFromSpotify(artist.id); // This function needs to be copied/available

    // Fetch full details for each album (including tracks) and upsert
    const albumDetailsPromises = spotifyAlbumsBasic.map(albumBasic => getSpotifyAlbumDetails(albumBasic.id)); // This function needs to be copied/available
    const fullAlbums = (await Promise.all(albumDetailsPromises)).filter(Boolean);

    await upsertAlbumsToSupabase(fullAlbums); // This function needs to be copied/available
    console.log(`Successfully synced ${fullAlbums.length} albums for artist ${artist.name}.`);

    return new Response(
      JSON.stringify({
        message: 'Artist and discography synced successfully',
        data,
        albumsSynced: fullAlbums.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    );
  } catch (error) {
    console.error('Error in sync-artist function:', {
      message: error.message,
      details: error.details,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to sync artist',
        details: error.details || null
      }), 
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    );
  }
});
