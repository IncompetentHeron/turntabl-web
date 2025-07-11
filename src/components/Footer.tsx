import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-32 py-8 border-t border-accent2/20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <Link to="/" className="text-2xl font-serif font-bold">
              Turntabl
            </Link>
            <p className="mt-2 text-sm text-secondary">
              Your music, your reviews, your community.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex gap-6">
              <a
                href="https://twitter.com/turntabl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary hover:text-primary transition-colors"
              >
                Twitter
              </a>
              <a
                href="https://instagram.com/turntabl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary hover:text-primary transition-colors"
              >
                Instagram
              </a>
            </div>
            
            <p className="text-xs text-secondary text-center md:text-right">
              Powered by Spotify®. All music data and artwork is provided by Spotify.
              <br />
              Spotify is a trademark of Spotify AB.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}