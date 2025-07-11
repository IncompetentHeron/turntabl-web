import { ReactNode, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Home from '../pages/Home';

interface LayoutProps {
  children: ReactNode;
  onShowAuth: (view: 'sign_in' | 'sign_up') => void;
}

export default function Layout({ children, onShowAuth }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [showSearchBarDropdown, setShowSearchBarDropdown] = useState(false);

  const searchBarInputRef = useRef<HTMLInputElement>(null);
  
  const handleFocusSearch = () => {
    setShowSearchBarDropdown(true);
  };

  const handleCloseSearchBarDropdown = () => {
    setShowSearchBarDropdown(false);
  };

  const handleSearchSubmit = (searchQuery: string) => {
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    setShowSearchBarDropdown(false);
  };

   // Effect to handle clicks outside the search bar and dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the search bar
      const target = event.target as Node;
      const searchBar = document.querySelector('.search-bar-container');
      const searchDropdown = document.querySelector('.search-dropdown');
      
      if (searchBar && !searchBar.contains(target) && 
          searchDropdown && !searchDropdown.contains(target)) {
        setShowSearchBarDropdown(false);
      }
    };

    // Add event listener when dropdown is shown
    if (showSearchBarDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Clean up event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchBarDropdown]);

  // Check if we're on the home page
  const isHomePage = location.pathname === '/';

  return (
    <div className="min-h-screen bg-background text-primary flex flex-col">
      <Header 
        onShowAuth={onShowAuth}
        query={query}
        setQuery={setQuery}
        onFocusSearch={handleFocusSearch}
        onSearchSubmit={handleSearchSubmit}
        showSearchBarDropdown={showSearchBarDropdown}
        onCloseSearchBarDropdown={handleCloseSearchBarDropdown}
      />

      <main className="container mx-auto px-4 pt-16 flex-grow">
        {isHomePage ? (
          <Home onShowAuth={onShowAuth} />
        ) : (
          children
        )}
      </main>
      <Footer />
    </div>
  );
}