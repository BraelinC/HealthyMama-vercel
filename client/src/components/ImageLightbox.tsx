import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoadError(false);
    try {
      // Debug: Lightbox opened
      // eslint-disable-next-line no-console
      console.log('🔍 [ImageLightbox] open:', open, 'src:', src);
    } catch {}
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ zIndex: 2147483647 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2147483647]"
    >
      <div className="absolute inset-0" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[95vw] max-h-[90vh]"
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/90 hover:text-white text-sm"
        >
          Close ✕
        </button>
        {loadError ? (
          <div className="flex items-center justify-center text-white/90 bg-gray-900/40 rounded p-6 min-w-[200px] min-h-[120px]">
            Unable to load image
          </div>
        ) : (
          <img
            src={src}
            alt={alt || 'Preview'}
            onError={() => setLoadError(true)}
            className="object-contain max-w-[95vw] max-h-[90vh] rounded shadow-2xl"
          />
        )}
      </div>
    </div>,
    document.body
  );
}

