import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getNewReleases, generateSlug } from '../lib/spotify';

export default function AlbumCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const { data: albums = [] } = useQuery({
    queryKey: ['newReleases'],
    queryFn: getNewReleases,
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((current) => (current + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  if (albums.length === 0) return null;

  return (
    <div className="relative h-[100px] sm:h-[150px] md:h-[350px] mb-10 md:mb-10">
      <div className="absolute inset-0 flex items-center justify-center perspective">
        {albums.map((album, index) => {
          const position = (index - currentIndex + 3) % 3;
          const isCenter = position === 0;
          const isLeft = position === 2;
          const isRight = position === 1;

          const baseClasses = `
            absolute transition-all duration-500 ease-in-out transform
            ${isCenter ? 'scale-100 z-30' : 'scale-75 z-20'}
          `;

          const transformStyle = {
            transform: `
              ${isLeft ? 'translate3d(-60%, 0, -100px) rotateY(30deg)' : ''}
              ${isRight ? 'translate3d(60%, 0, -100px) rotateY(-30deg)' : ''}
              ${isCenter ? 'translate3d(0, 0, 0) rotateY(0)' : ''}
              ${!isCenter ? 'scale(0.75)' : 'scale(1)'}
            `
          };

          return (
            <Link
              key={album.id}
              to={`/album/${generateSlug(`${album.artist} ${album.name}`, album.id)}`}
              className={baseClasses}
              style={transformStyle}
            >
              <div className={`relative ${isCenter ? 'shadow-2xl' : 'shadow-xl'}`}>
                <img
                  src={album.coverUrl}
                  alt={album.name}
                  className="w-[150px] h-[150px] sm:w-[250px] sm:h-[250px] md:w-[350px] md:h-[350px] rounded-lg"
                />
                <div className={`absolute inset-0 rounded-lg transition-all duration-300
                  ${isCenter ? 'bg-accent/10 group-hover:bg-accent/20' : 'bg-black/20'}
                `} />
                <div className="absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-black/80 w-full p-5 rounded-b-lg">
                    <h3 className="text-base sm:text-lg font-bold truncate">{album.name}</h3>
                    <p className="text-sm text-secondary truncate">{album.artist}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}