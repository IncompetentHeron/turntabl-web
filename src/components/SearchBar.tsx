import { useNavigate } from 'react-router-dom';

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onFocusSearch: () => void;
  onSearchSubmit: (query: string) => void;
}

export default function SearchBar({ query, setQuery, onFocusSearch, onSearchSubmit }: SearchBarProps) {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) {
      onSearchSubmit(query);
    }
  };

  return (
    <div className="relative w-full search-bar-container">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={onFocusSearch}
          className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-primary placeholder:text-white/40"
          placeholder="Search albums and artists..."
        />
      </form>
    </div>
  );
}