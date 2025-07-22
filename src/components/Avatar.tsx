import { useMemo } from 'react';

interface AvatarProps {
  url: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  height?: number;
  className?: string;
}

export default function Avatar({ url, name, size = 'md', height, className = '' }: AvatarProps) {
  console.log('Avatar component loading URL:', url);
  
  const dimensions = useMemo(() => {
    if (height) {
      return `w-auto h-[${height}px]`;
    }
    switch (size) {
      case 'sm': return 'w-8 h-8 text-sm';
      case 'lg': return 'w-24 h-24 text-3xl';
      default: return 'w-12 h-12 text-xl';
    }
  }, [size, height]);

  // Ensure name is a non-empty string before accessing it
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div className={`rounded-full overflow-hidden bg-accent flex-shrink-0 ${dimensions} ${className}`}>
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-bold">
          {initial}
        </div>
      )}
    </div>
  );
}