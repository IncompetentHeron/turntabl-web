import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { generateSlug } from '../lib/spotify';
import type { Listen } from '../lib/supabase';

interface ListensFeedProps {
  listens: Listen[];
  listenLater: Listen[];
}

export default function ListensFeed({ listens, listenLater }: ListensFeedProps) {
  const [showListenLater, setShowListenLater] = useState(false);

  return (
    <div className="space-y-8">
      <div className="bg-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Listen Later</h3>
          <button
            onClick={() => setShowListenLater(!showListenLater)}
            className="text-accent hover:text-accent/80"
          >
            {showListenLater ? 'Show Less' : 'Show All'}
          </button>
        </div>
        
        {showListenLater ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {listenLater.map((listen) => (
              <Link
                key={listen.album_id}
                to={`/album/${generateSlug(`${listen.album?.artist} ${listen.album?.name}`, listen.album_id)}`}
                className="block group"
              >
                <img
                  src={listen.album?.cover_url}
                  alt={listen.album?.name}
                  className="w-full aspect-square object-cover rounded-lg mb-2"
                />
                <h4 className="font-medium group-hover:text-accent truncate">
                  {listen.album?.name}
                </h4>
                <p className="text-secondary text-sm truncate">
                  {listen.album?.artist}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {listenLater.map((listen) => (
              <Link
                key={listen.album_id}
                to={`/album/${generateSlug(`${listen.album?.artist} ${listen.album?.name}`, listen.album_id)}`}
                className="block flex-shrink-0 w-40 group"
              >
                <img
                  src={listen.album?.cover_url}
                  alt={listen.album?.name}
                  className="w-full aspect-square object-cover rounded-lg mb-2"
                />
                <h4 className="font-medium group-hover:text-accent truncate">
                  {listen.album?.name}
                </h4>
                <p className="text-secondary text-sm truncate">
                  {listen.album?.artist}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {listens.map((listen) => (
          <div key={listen.id} className="bg-surface p-4 rounded-lg flex gap-4">
            <Link
              to={`/album/${generateSlug(`${listen.album?.artist} ${listen.album?.name}`, listen.album_id)}`}
              className="flex-shrink-0"
            >
              <img
                src={listen.album?.cover_url}
                alt={listen.album?.name}
                className="w-16 h-16 object-cover rounded"
              />
            </Link>
            <div>
              <Link
                to={`/album/${generateSlug(`${listen.album?.artist} ${listen.album?.name}`, listen.album_id)}`}
                className="font-medium hover:text-accent"
              >
                {listen.album?.name}
              </Link>
              <p className="text-secondary">{listen.album?.artist}</p>
              <p className="text-sm text-secondary">
                Listened on {format(new Date(listen.listened_at), 'MMM d, yyyy')}
              </p>
              {listen.note && (
                <p className="mt-2 text-sm">{listen.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}