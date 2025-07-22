import React, { useState, useEffect } from 'react';
import Toast from '../components/Toast';

export interface ToastOptions { // Export ToastOptions
  title: string;
  description?: string;
  duration?: number;
}

export function useToast() {
  const [toastProps, setToastProps] = useState<ToastOptions | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (toastProps) {
      setOpen(true);
    }
  }, [toastProps]);

  const showToast = (options: ToastOptions) => {
    setToastProps(options);
  };

  const renderToast = () => {
    if (!toastProps) return null;
    return (
      <Toast
        title={toastProps.title}
        description={toastProps.description}
        duration={toastProps.duration}
        open={open}
        onOpenChange={setOpen}
      />
    );
  };

  return { showToast, renderToast };
}
