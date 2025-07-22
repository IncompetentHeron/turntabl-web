import { useQuery } from '@tanstack/react-query';
import { useUser } from '../hooks/useUser';
import { getNewReleases } from '../lib/spotify';
import AlbumCarousel from '../components/AlbumCarousel';
import PopularAlbums from '../components/PopularAlbums';
import PopularReviews from '../components/PopularReviews';
import RecentlyReviewed from '../components/RecentlyReviewed';
import TrendingLists from '../components/TrendingLists';
import HallOfFame from '../components/HallOfFame';
import CommunityReviews from '../components/CommunityReviews';
import CommunityPopularAlbums from '../components/CommunityPopularAlbums';
import { ToastOptions } from '../hooks/useToast'; // Import ToastOptions

interface HomeProps {
  onShowAuth: (view: 'sign_in' | 'sign_up') => void;
  showToast: (options: ToastOptions) => void; // Add showToast prop
}

export default function Home({ onShowAuth, showToast }: HomeProps) {
  const { user } = useUser();

  return (
    <div className="space-y-12">
      <AlbumCarousel />
 
      <section className="text-center">
        <h2 className="text-xl sm:text-2xl md:text-4xl mb-3 font-serif">Show them why your taste is <strong>better</strong></h2>
        <h1 className="text-xl text-secondary">
          Review, track, and share your favourite music with Turntabl
        </h1>
      </section>
      {user ? (
        <>
          <CommunityReviews />
        </>
      ) : (
        <section className="text-center">
          <button
            onClick={() => onShowAuth('sign_up')}
            className="btn btn-primary text-lg px-8"
          >
            Join Turntabl For Free
          </button>
        </section>
      )}

      <PopularAlbums />
      <PopularReviews />
      <TrendingLists />
      <RecentlyReviewed />
    </div>
  );
}
