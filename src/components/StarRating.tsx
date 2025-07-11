import React from 'react';

interface StarRatingProps {
  rating: number; // 0-100
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className: string;
}

export default function StarRating({ rating, size = 'md', className = ' ' }: StarRatingProps) {
  let starTextSize = 'text-2xl';
  let containerWidth = 'w-[100px]';
  let containerHeight = 'h-6'; // Default for md (text-2xl)

  switch (size) {
    case 'xs':
      starTextSize = 'text-lg';
      containerWidth = 'w-[75px]';
      containerHeight = 'h-4'; // For text-xl
      break;
    case 'sm':
      starTextSize = 'text-xl';
      containerWidth = 'w-[83.5px]';
      containerHeight = 'h-5'; // For text-xl
      break;
    case 'lg':
      starTextSize = 'text-4xl';
      containerWidth = 'w-[150px]';
      containerHeight = 'h-10'; // For text-4xl
      break;
    case 'md':
    default:
      starTextSize = 'text-2xl';
      containerWidth = 'w-[99.6px]';
      containerHeight = 'h-6';
      break;
  }

  return (
    <div className={`relative ${containerWidth} ${containerHeight} ${className}`}>
      {/* Base star layer */}
      <div className={`absolute inset-0 flex items-center ${starTextSize} text-white/20`}>
        ★★★★★
      </div>
      
      {/* Filled star layer */}
      <div
        className={`absolute inset-0 flex items-center ${starTextSize} text-accent overflow-hidden`}
        style={{ width: `${rating}%` }}
      >
        ★★★★★
      </div>
    </div>
  );
}
