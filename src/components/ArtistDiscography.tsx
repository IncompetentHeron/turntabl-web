import { useState } from 'react'; // Import useState
import { Link } from 'react-router-dom';
import { format, isValid, parseISO } from 'date-fns';
import { generateSlug } from '../lib/spotify';
import { IoGridOutline, IoListOutline } from 'react-icons/io5'; // Import icons

interface Album {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  coverUrl: string;
  release_date: string;
  album_type: 'album' | 'single' | 'compilation';
  spotifyUrl?: string;
}

interface ArtistDiscographyProps {
  albums: Album[];
}

// Helper function to safely get the year from a releaseDate string
function getReleaseYear(dateString: string): string {
  if (!dateString) return 'N/A';

  const parsedDate = parseISO(dateString);
  if (isValid(parsedDate)) {
    return format(parsedDate, 'yyyy');
  }

  if (/^\d{4}$/.test(dateString)) {
    return dateString;
  }

  return 'N/A';
}

export default function ArtistDiscography({ albums }: ArtistDiscographyProps) {
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // New state for view mode

  const categoryOrder = ['Albums', 'Singles', 'Compilations', 'Other Releases'];
  
  const uniqueAlbumsMap = new Map<string, Album>();
  albums.forEach(album => {
    const key = `${album.name}-${album.release_date}`;
    if (!uniqueAlbumsMap.has(key)) {
      uniqueAlbumsMap.set(key, album);
    }
  });
  const uniqueAlbums = Array.from(uniqueAlbumsMap.values());

  const sortedAlbums = [...uniqueAlbums].sort((a, b) =>
    new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
  );

  const albumsByType = uniqueAlbums.reduce((acc, album) => {
    let typeCategory: string;
    if (album.album_type === 'album') {
      typeCategory = 'Albums';
    } else if (album.album_type === 'single') { 
      typeCategory = 'Singles';
    } else if (album.album_type === 'compilation') { 
      typeCategory = 'Compilations'; 
    } else {
      typeCategory = 'Other Releases';
    }

    if (!acc[typeCategory]) acc[typeCategory] = [];
    acc[typeCategory].push(album);
    return acc;
  }, {} as Record<string, Album[]>);

  Object.keys(albumsByType).forEach(type => {
    if (albumsByType[type]) { // Ensure the array exists before sorting
      albumsByType[type].sort((a, b) =>
        new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
      );
    }
  });

  const getDisplayLimit = () => {
    const isMobile = window.innerWidth < 768;
    return isMobile ? 6 : 8;
  };

  const displayLimit = getDisplayLimit();
  const totalAlbums = uniqueAlbums.length;
  const shouldShowButton = totalAlbums > displayLimit;

  const getAlbumsToDisplayCompact = () => {
    let condensedDisplay: Album[] = [];
    const mainAlbums = sortedAlbums.filter(album => album.album_type === 'album');
    const otherReleases = sortedAlbums.filter(album => album.album_type === 'single' || album.album_type === 'compilation');
    condensedDisplay = mainAlbums.slice(0, displayLimit);
    if (condensedDisplay.length < displayLimit) {
      const remainingSpace = displayLimit - condensedDisplay.length;
      condensedDisplay = condensedDisplay.concat(otherReleases.slice(0, remainingSpace));
    }
    return condensedDisplay;
  };

  const displayAlbumsCompact = getAlbumsToDisplayCompact();

  return (
    <section>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4"> 
        <h2 className="text-xl lg:text-2xl font-bold mb-2">Discography</h2>
        <div className="flex items-center gap-2"> {/* Container for buttons */}
          {shouldShowButton && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="btn btn-secondary text-sm"
            >
              {showAll ? 'Show Less' : `Show All (${totalAlbums})`}
            </button>
          )}
          {showAll && ( // Only show view mode toggle when expanded
            <div className="flex items-center bg-surface rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
                }`}
              >
                <IoGridOutline size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
                }`}
              >
                <IoListOutline size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

{showAll ? (
        // Expanded view with groupings, now iterating over categoryOrder
        categoryOrder.map(type => {
          const typeAlbums = albumsByType[type];
          return (
            typeAlbums && typeAlbums.length > 0 && ( // Check if albums exist for this type
              <div key={type} className="sm:mb-8">
                <h3 className="text-lg sm:text-xl font-semibold mb-4">{type}</h3>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                    {typeAlbums.map((album) => (
                      <Link
                        key={album.id}
                        to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
                        className="group overflow-hidden hover:bg-white/5 transition-colors"
                      >
                        <div className="aspect-square">
                          <img
                            src={album.coverUrl}
                            alt={album.name}
                            className="w-full h-full object-cover rounded flex-shrink-0"
                          />
                        </div>
                        <div className="p-1 sm:p-2">
                          <h4 className="font-medium text-xs sm:text-base mb-1 group-hover:text-accent transition-colors line-clamp-2">
                            {album.name}
                          </h4>
                          <div className="flex items-center justify-between text-xs text-secondary">
                            <span className="hidden sm:block capitalize">{album.album_type}</span>
                            <span>{getReleaseYear(album.release_date)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {typeAlbums.map((album) => (
                      <Link
                        key={album.id}
                        to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
                        className="flex items-center gap-4 p-2 sm:p-3 bg-surface rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <img
                          src={album.coverUrl}
                          alt={album.name}
                          className="w-16 h-16 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{album.name}</h4>
                          <p className="text-secondary text-sm truncate">{album.artist}</p>
                          <div className="flex items-center gap-2 text-xs text-secondary">
                            <span className="capitalize">{album.album_type}</span>
                            <span>•</span>
                            <span>{getReleaseYear(album.release_date)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          );
        })
      ) : (
        // Compact view without groupings (remains grid)
        displayAlbumsCompact.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {displayAlbumsCompact.map((album) => (
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
                    <span className="capitalize">{album.album_type}</span>
                    <span>{getReleaseYear(album.release_date)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-secondary">
            No albums found for this artist
          </div>
        )
      )}
    </section>
  );
}