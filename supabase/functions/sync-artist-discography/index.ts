import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import axios from 'npm:axios';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SPOTIFY_CLIENT_ID = Deno.env.get('VITE_SPOTIFY_CLIENT_ID'); // Assuming VITE_ prefix from frontend .env
const SPOTIFY_CLIENT_SECRET = Deno.env.get('VITE_SPOTIFY_CLIENT_SECRET'); // Assuming VITE_ prefix
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
    tracks: album.tracks?.map(track => ({
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
    const { artistId } = await req.json();

    if (!artistId) {
      throw new Error('Missing artistId in request body');
    }

    console.log(`Starting discography sync for artist ID: ${artistId}`);

    // Fetch all albums for the artist from Spotify
    const spotifyAlbums = await fetchArtistAlbumsFromSpotify(artistId);

    // For each album, fetch its full details (including tracks) and then upsert
    const albumsToUpsertPromises = spotifyAlbums.map(albumBasic => getSpotifyAlbumDetails(albumBasic.id));
    const fullAlbums = (await Promise.all(albumsToUpsertPromises)).filter(Boolean);

    await upsertAlbumsToSupabase(fullAlbums);

    console.log(`Discography sync completed for artist ID: ${artistId}. Total albums processed: ${fullAlbums.length}`);

    return new Response(
      JSON.stringify({
        message: `Discography for artist ${artistId} synced successfully.`,
        totalAlbumsProcessed: fullAlbums.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in sync-artist-discography function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to sync artist discography',
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

// Helper function to get full album details (including tracks)
async function getSpotifyAlbumDetails(albumId: string): Promise<SpotifyAlbumData | null> {
  try {
    const data = await spotifyApiCall<any>(`/albums/${albumId}`);
    return data;
  } catch (error) {
    console.warn(`Could not fetch full details for album ${albumId}:`, error.message);
    return null;
  }
}
