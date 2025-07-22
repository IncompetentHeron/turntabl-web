import { ReactNode, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Home from '../pages/Home';
import FeedbackButton from './FeedbackButton'; // Import FeedbackButton
import FeedbackModal from './FeedbackModal';   // Import FeedbackModal
import { useToast } from '../hooks/useToast'; // Import useToast

interface LayoutProps {
  children: ReactNode;
  onShowAuth: (view: 'sign_in' | 'sign_up') => void;
}

export default function Layout({ children, onShowAuth }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [showSearchBarDropdown, setShowSearchBarDropdown] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false); // New state for feedback modal
  const { showToast, renderToast } = useToast(); // Initialize useToast

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

  // Determine if any other modal is open (e.g., AuthModal)
  // You'll need to pass a prop from App.tsx to Layout.tsx if AuthModal state is managed higher up.
  // For now, assuming AuthModal is managed within App.tsx and not directly accessible here.
  // If AuthModal is managed in App.tsx, you'd need to pass a prop like `isAuthModalOpen` to Layout.
  const isAnyOtherModalOpen = false; // Placeholder: Update this based on your actual modal management

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
          <Home onShowAuth={onShowAuth} showToast={showToast} /> //* Pass showToast to Home *//
        ) : (
          children
        )}
      </main>
      <Footer />

      {/* Feedback Button */}
      <FeedbackButton 
        onClick={() => setShowFeedbackModal(true)} 
        isHidden={showFeedbackModal || isAnyOtherModalOpen} // Hide if feedback modal or any other modal is open
      />

      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={showFeedbackModal} 
        onClose={() => setShowFeedbackModal(false)} 
        showToast={showToast} 
      />
      {renderToast()} {/* Render the toast component globally here */}
    </div>
  );
}
