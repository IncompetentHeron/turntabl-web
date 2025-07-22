import axios from 'axios';

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;

interface SpotifyAlbum {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  releaseDate: string;
  type: 'album' | 'single' | 'compilation';
  tracks: SpotifyTrack[];
  popularity?: number;
  spotifyUrl?: string;
}

interface SpotifyArtist {
  id: string;
  name: string;
  imageUrl: string;
  genres: string[];
  albums: SpotifyAlbum[];
  spotifyUrl?: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  duration: number;
  trackNumber: number;
}

interface SearchResults {
  albums: SpotifyAlbum[];
  artists: SpotifyArtist[];
}

let accessToken: string | null = null;
let tokenExpirationTime: number | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function getAccessToken(): Promise<string> {
  if (accessToken && tokenExpirationTime && Date.now() < tokenExpirationTime) {
    return accessToken;
  }

  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
    }
  );

  accessToken = response.data.access_token;
  tokenExpirationTime = Date.now() + (response.data.expires_in * 1000);
  return accessToken;
}

// MODIFIED: Add currentRetry as a parameter with a default value
async function spotifyApiCall<T>(endpoint: string, currentRetry: number = 0): Promise<T> {
  try {
    const token = await getAccessToken();
    const response = await axios.get(`${SPOTIFY_API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    // No need to reset a global retryCount here
    return response.data;
  } catch (error: any) {
    // Use the local currentRetry for the condition and increment
    if (error.response?.status === 429 && currentRetry < MAX_RETRIES) {
      const nextRetryCount = currentRetry + 1; // Increment for the next attempt
      const delay = error.response.headers['retry-after']
        ? parseInt(error.response.headers['retry-after']) * 1000
        : RETRY_DELAY * nextRetryCount; // Use nextRetryCount for delay calculation

      console.warn(`Rate limit hit for ${endpoint}. Retrying after ${delay / 1000} seconds... (Attempt ${nextRetryCount}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Recursively call with the incremented retry count
      return spotifyApiCall(endpoint, nextRetryCount);
    }
    // Re-throw the error if it's not a 429 or if retries are exhausted
    throw error;
  }
}

function transformSpotifyAlbum(spotifyData: any): SpotifyAlbum {
  return {
    id: spotifyData.id,
    name: spotifyData.name,
    artist: spotifyData.artists[0].name,
    artistId: spotifyData.artists[0].id,
    coverUrl: spotifyData.images[0]?.url || 'https://via.placeholder.com/300',
    releaseDate: spotifyData.release_date,
    type: spotifyData.album_type,
    popularity: spotifyData.popularity,
    spotifyUrl: spotifyData.external_urls?.spotify,
    tracks: spotifyData.tracks?.items.map((track: any) => ({
      id: track.id,
      name: track.name,
      duration: Math.floor(track.duration_ms / 1000),
      trackNumber: track.track_number,
    })) || [],
  };
}

function transformSpotifyArtist(spotifyData: any): SpotifyArtist {
  return {
    id: spotifyData.id,
    name: spotifyData.name,
    imageUrl: spotifyData.images[0]?.url || 'https://via.placeholder.com/300',
    genres: spotifyData.genres || [],
    spotifyUrl: spotifyData.external_urls?.spotify, // <--- ADD THIS LINE
    albums: [], // This was intentionally left empty as per previous recommendations
  };
}

export function generateSlug(name: string, id: string): string {
  return `${name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-${id}`;
}

export async function searchSpotify(query: string): Promise<SearchResults> {
  if (!query) return { albums: [], artists: [] };

  try {
    const data = await spotifyApiCall<any>(
      `/search?q=${encodeURIComponent(query)}&type=album,artist&limit=20`
    );

    return {
      albums: data.albums.items.map(transformSpotifyAlbum),
      artists: data.artists.items.map(transformSpotifyArtist),
    };
  } catch (error) {
    console.error('Error searching Spotify:', error);
    return { albums: [], artists: [] };
  }
}

export async function getAlbum(id: string): Promise<SpotifyAlbum | null> {
  try {
    const albumData = await spotifyApiCall<any>(`/albums/${id}`);
    return transformSpotifyAlbum(albumData);
  } catch (error) {
    console.error('Error fetching album:', error);
    return null;
  }
}

// MODIFIED: Added optional fetchPopularity parameter
export async function getArtistAlbums(id: string, fetchPopularity: boolean = false): Promise<SpotifyAlbum[]> {
  try {
    let allAlbums: SpotifyAlbum[] = [];
    let offset = 0;
    const limit = 50; // Max limit per request for artist albums endpoint

    while (true) {
      const albumsData = await spotifyApiCall<any>(
        `/artists/${id}/albums?include_groups=album,single,compilation&limit=${limit}&offset=${offset}`
      );

      let transformedAlbums: SpotifyAlbum[] = [];

      if (fetchPopularity) {
        // Fetch full details for each album to get popularity
        const albumDetailsPromises = albumsData.items.map(async (album: any) => {
          try {
            const detailedAlbumData = await spotifyApiCall<any>(`/albums/${album.id}`);
            return transformSpotifyAlbum(detailedAlbumData);
          } catch (detailError) {
            console.warn(`Could not fetch details for album ${album.id}:`, detailError);
            return null; // Return null for failed fetches
          }
        });
        transformedAlbums = (await Promise.all(albumDetailsPromises)).filter(Boolean); // Filter out nulls
      } else {
        // Only transform basic album data if popularity is not needed
        transformedAlbums = albumsData.items.map(transformSpotifyAlbum);
      }

      allAlbums = allAlbums.concat(transformedAlbums);

      if (albumsData.next) {
        offset += limit;
      } else {
        break;
      }
    }

    return allAlbums;
  } catch (error) {
    console.error('Error fetching artist albums:', error);
    return [];
  }
}

export async function getArtist(id: string): Promise<SpotifyArtist | null> {
  try {
    // Only fetch artist profile data - no albums, no additional API calls
    const artistData = await spotifyApiCall<any>(`/artists/${id}`);
    const artist = transformSpotifyArtist(artistData);
    // Albums will be fetched separately from Supabase after sync-artist runs
    artist.albums = [];
    return artist;
  } catch (error) {
    console.error('Error fetching artist:', error);
    return null;
  }
}

export async function getNewReleases(): Promise<SpotifyAlbum[]> {
  try {
    const data = await spotifyApiCall<any>(
      '/browse/new-releases?country=US&limit=50'
    );

    const albums = data.albums.items
      .map(transformSpotifyAlbum)
      .sort((a: SpotifyAlbum, b: SpotifyAlbum) =>
        (b.popularity || 0) - (a.popularity || 0)
      );

    return albums.slice(0, 3);
  } catch (error) {
    console.error('Error fetching new releases:', error);
    return [];
  }
}


export async function getArtistProfile(id: string): Promise<SpotifyArtist | null> {
  try {
    const artistData = await spotifyApiCall<any>(`/artists/${id}`);
    return transformSpotifyArtist(artistData);
  } catch (error) {
    console.error('Error fetching artist profile:', error);
    return null;
  }
}