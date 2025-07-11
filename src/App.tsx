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
import ListDetails from './pages/ListDetails';
import AuthModal from './components/Auth';

const queryClient = new QueryClient();

function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState<'sign_in' | 'sign_up'>('sign_in');

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout 
          onShowAuth={(view: 'sign_in' | 'sign_up') => {
            setAuthView(view);
            setShowAuthModal(true);
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/album/:slug" element={<Album />} />
            <Route path="/artist/:id" element={<Artist />} />
            <Route path="/search" element={<Search />} />
            <Route path="/search/albums" element={<SearchAlbums />} />
            <Route path="/search/artists" element={<SearchArtists />} />
            <Route path="/search/users" element={<SearchUsers />} />
            <Route path="/user/:id" element={<Profile />} />
            <Route path="/lists" element={<GlobalLists />} />
            <Route path="/lists/:id" element={<ListDetails />} />
            <Route path="/albums" element={<GlobalAlbums />} />
            <Route path="/reviews" element={<GlobalReviews />} />
            <Route path="/users" element={<AllUsersPage />} />
          </Routes>
        </Layout>

        {showAuthModal && (
          <AuthModal 
            onClose={() => setShowAuthModal(false)} 
            defaultView={authView}
          />
        )}
      </Router>
    </QueryClientProvider>
  );
}

export default App;