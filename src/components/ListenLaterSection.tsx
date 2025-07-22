// src/components/ListenLaterSection.tsx
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { generateSlug } from '../lib/spotify';
import { useUser } from '../hooks/useUser';
import type { Listen } from '../lib/supabase';

interface ListenLaterSectionProps {
  listenLater: Listen[];
}

export default function ListenLaterSection({ listenLater }: ListenLaterSectionProps) {
  const { user } = useUser(); // Use useUser hook to get user for conditional rendering

  if (!user) {
    // This component should ideally only be rendered if user is logged in,
    // but adding a fallback just in case.
    return null;
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg md:text-xl lg:text-2xl font-bold">Listen Later</h3>
        <Link
          to="/listen-later"
          className="btn btn-secondary text-sm md:text-base lg:text-lg hover:text-accent2 transition-colors"
        >
          See all
        </Link>
      </div>
      {listenLater.length > 0 ? (
        <div className="flex flex-row overflow-x-auto lg:grid grid-cols-5 gap-4">
          {listenLater.slice(0, 10).map((listen) => (
            <Link
              key={listen.album_id}
              to={`/album/${generateSlug(`${listen.album?.artist} ${listen.album?.name}`, listen.album_id)}`}
              className="group flex-shrink-0 w-24 md:w-32 lg:w-auto mb-3"
            >
              <div className="aspect-square mb-3">
                <img
                  src={listen.album?.cover_url}
                  alt={listen.album?.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <h3 className="text-xs md:text-base lg:text-lg group-hover:text-accent transition-colors line-clamp-1">
                {listen.album?.name}
              </h3>
              <p className="text-secondary text-xs md:text-sm lg:text-base line-clamp-1">
                {listen.album?.artist}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-surface rounded-lg">
          <p className="text-secondary">No albums in your Listen Later list yet.</p>
        </div>
      )}
    </section>
  );
}
