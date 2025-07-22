import * as ToastRadix from '@radix-ui/react-toast';
import React from 'react';

interface ToastProps {
  title: string;
  description?: string;
  duration?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function Toast({ title, description, duration = 3000, open, onOpenChange }: ToastProps) {
  return (
    <ToastRadix.Root
      className="bg-surface rounded-lg shadow-lg p-4 flex items-center justify-between data-[state=open]:animate-slideIn data-[state=closed]:animate-hide data-[swipe=end]:animate-swipeOut data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]"
      duration={duration}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-1">
        <ToastRadix.Title className="text-primary font-bold text-sm">
          {title}
        </ToastRadix.Title>
        {description && (
          <ToastRadix.Description className="text-secondary text-xs">
            {description}
          </ToastRadix.Description>
        )}
      </div>
      <ToastRadix.Close className="text-secondary hover:text-primary ml-4">
        ✕
      </ToastRadix.Close>
    </ToastRadix.Root>
  );
}
