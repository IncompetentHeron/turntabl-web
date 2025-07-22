import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { generateSlug } from '../lib/spotify';
import type { Listen } from '../lib/supabase';

interface ListenGridViewProps {
  listens: Listen[];
}

export default function ListenGridView({ listens }: ListenGridViewProps) {
  if (listens.length === 0) {
    return (
      <div className="text-center py-8 text-secondary">
        No listens recorded yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
      {listens.map((listen) => (
        <Link
          key={listen.id}
          to={`/album/${generateSlug(`${listen.album?.artist} ${listen.album?.name}`, listen.album_id)}`}
          className="group"
        >
          <div className="aspect-square mb-2">
            <img
              src={listen.album?.cover_url}
              alt={listen.album?.name}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
          <h3 className="font-medium group-hover:text-accent transition-colors line-clamp-1">
            {listen.album?.name}
          </h3>
          <p className="text-secondary text-sm line-clamp-1">{listen.album?.artist}</p>
          <p className="text-secondary text-xs mt-1">
            {format(new Date(listen.listened_at), 'd MMM, yyyy')}
          </p>
        </Link>
      ))}
    </div>
  );
}
