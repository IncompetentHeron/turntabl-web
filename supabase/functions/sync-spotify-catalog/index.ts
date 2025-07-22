import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import axios from 'npm:axios';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables for Spotify or Supabase.');
  throw new Error('Missing required environment variables. Please ensure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are set.');
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

// --- Spotify API Call Wrapper with Retry Logic ---
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second base delay

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
        throw error; // Re-throw other errors immediately
      }
    }
  }
  throw new Error(`Failed after ${MAX_RETRIES} retries for endpoint: ${endpoint}`);
}

// --- Interfaces for Spotify Data ---
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

interface SpotifyArtistData {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  popularity: number;
  external_urls: { spotify: string };
}

// --- Supabase Upsert Functions ---
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

async function upsertArtistsToSupabase(artists: SpotifyArtistData[]) {
  if (artists.length === 0) return;
  const artistsToUpsert = artists.map(artist => ({
    id: artist.id,
    name: artist.name,
    image_url: artist.images[0]?.url || 'https://via.placeholder.com/300',
    spotify_url: artist.external_urls?.spotify,
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

// --- Spotify Data Fetching Functions ---
async function fetchNewReleases(limit: number = 50): Promise<SpotifyAlbumData[]> {
  const data = await spotifyApiCall<any>(`/browse/new-releases?country=US&limit=${limit}`);
  return data.albums.items;
}

async function searchArtists(query: string, limit: number = 20): Promise<SpotifyArtistData[]> {
  const data = await spotifyApiCall<any>(`/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`);
  return data.artists.items;
}

async function fetchArtistAlbums(artistId: string): Promise<SpotifyAlbumData[]> {
  let allAlbums: SpotifyAlbumData[] = [];
  let offset = 0;
  const limit = 50; // Max limit per request for artist albums endpoint

  console.log(`Fetching basic album list for artist ID: ${artistId}`);
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
  console.log(`Fetched ${allAlbums.length} basic albums for artist ID: ${artistId}`);
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

// --- Supabase Query for Albums Needing Update ---
async function albumNeedsUpdate(albumId: string): Promise<boolean> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data, error } = await supabaseAdmin
    .from('albums')
    .select('updated_at')
    .eq('id', albumId)
    .single();

  if (error && error.code === 'PGRST116') { // No row found (album doesn't exist)
    return true;
  }
  if (error) {
    console.error('Error checking album update status:', error.message);
    return false; // If there's an error, assume it doesn't need update to prevent infinite loops
  }

  // Album exists, check if updated_at is older than 14 days
  return new Date(data.updated_at) < fourteenDaysAgo;
}

async function fetchAlbumsNeedingPopularityRefresh(limit: number = 100): Promise<string[]> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data, error } = await supabaseAdmin
    .from('albums')
    .select('id')
    .lt('updated_at', fourteenDaysAgo.toISOString()) // Select albums updated more than 14 days ago
    .order('updated_at', { ascending: true }) // Order by oldest update first
    .limit(limit);

  if (error) {
    console.error('Error fetching albums for popularity refresh:', error.message);
    return [];
  }
  return data.map(album => album.id);
}

async function fetchAlbumPopularityBatch(albumIds: string[]): Promise<SpotifyAlbumData[]> {
  if (albumIds.length === 0) return [];
  const idsString = albumIds.join(',');
  try {
    const data = await spotifyApiCall<any>(`/albums?ids=${idsString}`);
    return data.albums.filter(Boolean); // Filter out any nulls if Spotify returns them
  } catch (error) {
    console.error('Error fetching album popularity batch:', error.message);
    return [];
  }
}

// --- Main Handler ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting sync-spotify-catalog function execution...');

    // Phase 1: Sync New Releases
    console.log('Phase 1: Syncing New Releases...');
    const newReleaseAlbumsBasic = await fetchNewReleases(50); // Get basic info for new releases
    let newReleasesProcessed = 0;
    for (const albumBasic of newReleaseAlbumsBasic) {
      if (await albumNeedsUpdate(albumBasic.id)) {
        const fullAlbumDetails = await getSpotifyAlbumDetails(albumBasic.id);
        if (fullAlbumDetails) {
          await upsertAlbumsToSupabase([fullAlbumDetails]);
          newReleasesProcessed++;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between individual album checks
    }
    console.log(`Phase 1: Synced ${newReleasesProcessed} new/updated release albums.`);

    // Phase 2: Discover and Sync New Artists & Their Discographies (Controlled Expansion)
    console.log('Phase 2: Discovering and Syncing New Artists & Discographies...');
    const seedArtistGenres = ['pop', 'rock', 'hip hop', 'jazz', 'electronic', 'country', 'r&b', 'metal', 'indie', 'classical'];
    const randomGenre = seedArtistGenres[Math.floor(Math.random() * seedArtistGenres.length)];
    console.log(`  Targeting artists in genre: "${randomGenre}"`);

    const artistsToDiscover = await searchArtists(randomGenre, 2); // Discover 2 artists in this genre
    let newAlbumsFromArtistsProcessed = 0;
    for (const artist of artistsToDiscover) {
      try {
        await upsertArtistsToSupabase([artist]); // Add/update the artist
        const artistAlbumsBasic = await fetchArtistAlbums(artist.id); // Get basic album info for artist
        for (const albumBasic of artistAlbumsBasic) {
          if (await albumNeedsUpdate(albumBasic.id)) {
            const fullAlbumDetails = await getSpotifyAlbumDetails(albumBasic.id);
            if (fullAlbumDetails) {
              await upsertAlbumsToSupabase([fullAlbumDetails]);
              newAlbumsFromArtistsProcessed++;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between individual album checks
        }
        console.log(`  Processed discography for artist: ${artist.name}`);
      } catch (artistProcessError) {
        console.warn(`  Error processing artist ${artist.name} (${artist.id}):`, artistProcessError.message);
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between artist processing
    }
    console.log(`Phase 2: Discovered ${artistsToDiscover.length} artists and synced ${newAlbumsFromArtistsProcessed} new/updated albums from their discographies.`);


    // Phase 3: Refresh Existing Album Popularity (Rolling Weekly Update)
    console.log('Phase 3: Refreshing Popularity for Existing Albums...');
    const albumsToRefreshPopularity = await fetchAlbumsNeedingPopularityRefresh(100); // Get 100 albums to update per run

    const batchSize = 20; // Spotify's /albums endpoint limit is 50, but 20 is safer for general API limits
    let refreshedAlbumsCount = 0;

    for (let i = 0; i < albumsToRefreshPopularity.length; i += batchSize) {
      const batchIds = albumsToRefreshPopularity.slice(i, i + batchSize);
      const popularities = await fetchAlbumPopularityBatch(batchIds);
      await upsertAlbumsToSupabase(popularities); // Upsert to update popularity and updated_at
      refreshedAlbumsCount += popularities.length;
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between batches
    }
    console.log(`Phase 3: Refreshed popularity for ${refreshedAlbumsCount} existing albums.`);

    return new Response(
      JSON.stringify({
        message: 'Spotify catalog sync completed successfully',
        newReleasesProcessed: newReleasesProcessed,
        artistsDiscovered: artistsToDiscover.length,
        newAlbumsFromArtistsProcessed: newAlbumsFromArtistsProcessed,
        existingAlbumsPopularityRefreshed: refreshedAlbumsCount,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in sync-spotify-catalog function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to sync Spotify catalog',
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
