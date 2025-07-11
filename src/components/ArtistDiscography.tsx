import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { generateSlug } from '../lib/spotify';

interface Album {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  releaseDate: string;
  type: 'album' | 'single' | 'compilation'; // Added 'compilation'
  spotifyUrl?: string;
}

interface ArtistDiscographyProps {
  albums: Album[];
}

export default function ArtistDiscography({ albums }: ArtistDiscographyProps) {
  const [showAll, setShowAll] = useState(false);

  // Sort all albums by release date (newest first) for initial display
  const sortedAlbums = [...albums].sort((a, b) =>
    new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
  );

  // Group albums by type for expanded view
  const albumsByType = albums.reduce((acc, album) => {
    let typeCategory: string;
    if (album.type === 'album') {
      typeCategory = 'Albums';
    } else if (album.type === 'single' || album.type === 'compilation') { // Group singles and compilations
      typeCategory = 'Singles & EPs';
    } else {
      typeCategory = 'Other Releases'; // Fallback for any other unexpected types
    }

    if (!acc[typeCategory]) acc[typeCategory] = [];
    acc[typeCategory].push(album);
    return acc;
  }, {} as Record<string, Album[]>);

  // Sort albums within each type by release date (newest first)
  Object.keys(albumsByType).forEach(type => {
    albumsByType[type].sort((a, b) =>
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );
  });

  // Determine how many albums to show initially
  const getDisplayLimit = () => {
    // Check if mobile (you can adjust this breakpoint as needed)
    const isMobile = window.innerWidth < 768;
    return isMobile ? 6 : 8;
  };

  const displayLimit = getDisplayLimit();
  const totalAlbums = albums.length;
  const shouldShowButton = totalAlbums > displayLimit;

  // Get albums to display
  const getAlbumsToDisplay = () => {
    if (showAll) {
      return albumsByType;
    }

    // For initial view, prioritize 'album' type, then 'single'/'compilation' by recency
    const mainAlbums = sortedAlbums.filter(album => album.type === 'album');
    const otherReleases = sortedAlbums.filter(album => album.type === 'single' || album.type === 'compilation');

    let condensedDisplay: Album[] = [];

    // Add main albums up to the limit
    condensedDisplay = mainAlbums.slice(0, displayLimit);

    // If there's still space, add other releases
    if (condensedDisplay.length < displayLimit) {
      const remainingSpace = displayLimit - condensedDisplay.length;
      condensedDisplay = condensedDisplay.concat(otherReleases.slice(0, remainingSpace));
    }

    return condensedDisplay;
  };

  const displayAlbums = getAlbumsToDisplay();

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Discography</h2>
        {shouldShowButton && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="btn btn-secondary text-sm"
          >
            {showAll ? 'Show Less' : `Show All (${totalAlbums})`}
          </button>
        )}
      </div>

      {showAll ? (
        // Expanded view with groupings
        Object.entries(displayAlbums as Record<string, Album[]>).map(([type, typeAlbums]) => (
          typeAlbums.length > 0 && (
            <div key={type} className="mb-8">
              <h3 className="text-xl font-semibold mb-4">{type}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {typeAlbums.map((album) => (
                  <Link
                    key={album.id}
                    to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
                    className="group bg-surface rounded-lg overflow-hidden hover:bg-white/5 transition-colors"
                  >
                    <div className="aspect-square">
                      <img
                        src={album.coverUrl}
                        alt={album.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <h4 className="font-medium text-sm mb-1 group-hover:text-accent transition-colors line-clamp-2">
                        {album.name}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-secondary">
                        <span className="capitalize">{album.type}</span>
                        <span>{format(new Date(album.releaseDate), 'yyyy')}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        ))
      ) : (
        // Compact view without groupings
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(displayAlbums as Album[]).map((album) => (
            <Link
              key={album.id}
              to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
              className="group bg-surface rounded-lg overflow-hidden hover:bg-white/5 transition-colors"
            >
              <div className="aspect-square">
                <img
                  src={album.coverUrl}
                  alt={album.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <h4 className="font-medium text-sm mb-1 group-hover:text-accent transition-colors line-clamp-2">
                  {album.name}
                </h4>
                <div className="flex items-center justify-between text-xs text-secondary">
                  <span className="capitalize">{album.type}</span>
                  <span>{format(new Date(album.releaseDate), 'yyyy')}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {albums.length === 0 && (
        <div className="text-center py-8 text-secondary">
          No albums found for this artist
        </div>
      )}
    </section>
  );
}

