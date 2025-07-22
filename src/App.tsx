import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Home from './pages/Home';
import Album from './pages/Album';
import Artist from './pages/Artist';
import Search from './pages/Search';
import SearchAlbums from './pages/SearchAlbums';
import SearchArtists from './pages/SearchArtists';
import SearchUsers from './pages/SearchUsers';
import Profile from './pages/Profile';
import GlobalLists from './pages/Lists';
import GlobalAlbums from './pages/Albums';
import GlobalReviews from './pages/Reviews';
import AllUsersPage from './pages/AllUsersPage';
import { ToastProvider, ToastViewport } from '@radix-ui/react-toast';
import ListDetails from './pages/ListDetails';
import AuthModal from './components/Auth';
import { useToast } from './hooks/useToast.tsx'; 
import ListenLater from './pages/ListenLater';
import FollowSuggestionsPage from './pages/FollowSuggestionsPage';

const queryClient = new QueryClient();

function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState<'sign_in' | 'sign_up'>('sign_in');
  const { showToast, renderToast } = useToast(); // Initialize useToast here

  const handleShowAuth = (view: 'sign_in' | 'sign_up') => {
    setAuthView(view);
    setShowAuthModal(true);
  };
  
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider swipeDirection="right">
        <Router>
          <Layout
            onShowAuth={handleShowAuth}
          >
            <Routes>
              <Route path="/" element={<Home onShowAuth={handleShowAuth} showToast={showToast} />} />
              <Route path="/album/:slug" element={<Album showToast={showToast} />} />
              <Route path="/artist/:id" element={<Artist showToast={showToast} />} />
              <Route path="/search" element={<Search />} />
              <Route path="/search/albums" element={<SearchAlbums />} />
              <Route path="/search/artists" element={<SearchArtists />} />
              <Route path="/search/users" element={<SearchUsers />} />
              <Route path="/user/:id" element={<Profile />} />
              <Route path="/lists" element={<GlobalLists />} />
              <Route path="/lists/:id" element={<ListDetails showToast={showToast} />} />
              <Route path="/albums" element={<GlobalAlbums />} />
              <Route path="/reviews" element={<GlobalReviews />} />
              <Route path="/users" element={<AllUsersPage />} />
              <Route path="/listen-later" element={<ListenLater />} />
              <Route path="/suggestions" element={<FollowSuggestionsPage />} />
            </Routes>
          </Layout>

          {showAuthModal && (
            <AuthModal onClose={() => setShowAuthModal(false)} defaultView={authView} />
          )}
        </Router>
        <ToastViewport className="[--viewport-padding:_25px] fixed bottom-0 right-0 flex flex-col p-[var(--viewport-padding)] gap-[10px] w-[390px] max-w-[100vw] m-0 list-none z-[2147483647] outline-none" />
        {renderToast()} {/* Render the toast component globally here */}
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
