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
  type: 'album' | 'single' | 'compilation'; // Added 'compilation'
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

async function spotifyApiCall<T>(endpoint: string): Promise<T> {
  try {
    const token = await getAccessToken();
    const response = await axios.get(`${SPOTIFY_API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    retryCount = 0;
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = error.response.headers['retry-after']
        ? parseInt(error.response.headers['retry-after']) * 1000
        : RETRY_DELAY * retryCount;

      await new Promise(resolve => setTimeout(resolve, delay));
      return spotifyApiCall(endpoint);
    }
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
    albums: [],
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

export async function getArtistAlbums(id: string): Promise<SpotifyAlbum[]> {
  try {
    let allAlbums: SpotifyAlbum[] = [];
    let offset = 0;
    const limit = 50; // Max limit per request

    while (true) {
      const albumsData = await spotifyApiCall<any>(
        `/artists/${id}/albums?include_groups=album,single,compilation&limit=${limit}&offset=${offset}`
      );

      const transformedAlbums = albumsData.items.map(transformSpotifyAlbum);
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
    const [artistData, albums] = await Promise.all([
      spotifyApiCall<any>(`/artists/${id}`),
      getArtistAlbums(id),
    ]);

    const artist = transformSpotifyArtist(artistData);
    artist.albums = albums;

    return artist;
  } catch (error) {
    console.error('Error fetching artist:', error);
    return null;
  }
}

export async function getSimilarArtists(id: string): Promise<SpotifyArtist[]> {
  try {
    const data = await spotifyApiCall<any>(`/artists/${id}/related-artists`);
    return data.artists.slice(0, 10).map(transformSpotifyArtist);
  } catch (error: any) {
    // Handle 404 errors gracefully - some artists may not have related artists
    if (error.response?.status === 404) {
      console.warn('No similar artists found for artist ID:', id);
      return [];
    }
    console.error('Error fetching similar artists:', error);
    return [];
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

export async function getAlbumRecommendations(seedAlbumId: string): Promise<SpotifyAlbum[]> {
  try {
    const albumData = await spotifyApiCall<any>(`/albums/${seedAlbumId}`);
    const artistId = albumData.artists[0]?.id;

    if (!artistId) {
      console.warn(`No artist found for album ID: ${seedAlbumId}`);
      return [];
    }

    const data = await spotifyApiCall<any>(
      `/recommendations?seed_artists=${artistId}&limit=10`
    );

    return data.tracks
      .map((track: any) => transformSpotifyAlbum(track.album)) // Recommendations return tracks, extract album info
      .filter((album: SpotifyAlbum) => album.id !== seedAlbumId)
      .filter((album: SpotifyAlbum, index: number, self: SpotifyAlbum[]) => // Deduplicate albums
        index === self.findIndex((a) => a.id === album.id)
      )
      .slice(0, 5); // Limit to top 5 unique similar albums
  } catch (error: any) {
    console.error('Error fetching album recommendations:', error);
    return [];
  }
}