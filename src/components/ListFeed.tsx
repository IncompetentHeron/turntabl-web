import type { List } from '../lib/supabase';
import ListCard from './ListCard';

interface ListFeedProps {
  lists: List[];
}

export default function ListFeed({ lists }: ListFeedProps) {
  return (
    <div className="space-y-6">
      {lists.map((list) => (
        <ListCard key={list.id} list={list} />
      ))}
    </div>
  );
}