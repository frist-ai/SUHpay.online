'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Banner } from '@/stores/shop-store';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface BannerCarouselProps {
  banners: Banner[];
  onBannerClick?: (banner: Banner) => void;
}

const AUTO_PLAY_INTERVAL = 5000;

export function BannerCarousel({ banners, onBannerClick }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  // ─── Auto-play with progress tracking ────────────────────────────────────
  useEffect(() => {
    if (banners.length <= 1) return;

    startTimeRef.current = Date.now();
    setProgress(0);

    const animateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(elapsed / AUTO_PLAY_INTERVAL, 1);
      setProgress(p);

      if (p >= 1) {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
        startTimeRef.current = Date.now();
        setProgress(0);
      }

      rafRef.current = requestAnimationFrame(animateProgress);
    };

    rafRef.current = requestAnimationFrame(animateProgress);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [banners.length, currentIndex]);

  // ─── Swipe hint: hide after 3 seconds ────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setShowSwipeHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // ─── Reset progress when index changes ────────────────────────────────────
  const resetProgress = useCallback(() => {
    startTimeRef.current = Date.now();
    setProgress(0);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    resetProgress();
  }, [banners.length, resetProgress]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
    resetProgress();
  }, [banners.length, resetProgress]);

  const goToIndex = useCallback((index: number) => {
    setCurrentIndex(index);
    resetProgress();
  }, [resetProgress]);

  // ─── Touch swipe handlers ────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
      // Hide swipe hint after first interaction
      setShowSwipeHint(false);
    }
  }, [goToNext, goToPrevious]);

  if (!banners.length) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      {/* Main banner */}
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {banners.map((banner, index) => (
          <Card
            key={banner.id}
            className="min-w-full cursor-pointer overflow-hidden border-0"
            onClick={() => onBannerClick?.(banner)}
          >
            <div className="relative aspect-[620/280] sm:aspect-[620/320]">
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://picsum.photos/620/280?random=${banner.id}`;
                }}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Glassmorphism text overlay */}
              <div className="absolute bottom-0 left-0 right-0">
                <div className="backdrop-blur-md bg-white/10 dark:bg-black/20 border-t border-white/10">
                  <div className="px-3 py-2 text-white">
                    <h3 className="text-lg sm:text-2xl font-bold drop-shadow-sm">{banner.title}</h3>
                    {banner.subtitle && (
                      <p className="text-sm sm:text-base opacity-90 drop-shadow-sm">{banner.subtitle}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Swipe indicator on first banner */}
              {index === 0 && showSwipeHint && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute top-1/2 right-4 -translate-y-1/2 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 text-white/90 text-xs font-medium pointer-events-none"
                >
                  <span>Свайпните</span>
                  <motion.div
                    animate={{ x: [0, 6, 0] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </motion.div>
                </motion.div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            aria-label="Предыдущий баннер"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 transition-colors shadow-md"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Следующий баннер"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 transition-colors shadow-md"
            onClick={goToNext}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Auto-play progress bar */}
      {banners.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <motion.div
            className="h-full bg-white/80"
            style={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
      )}

      {/* Pill-shaped dot indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
          {banners.map((_, index) => (
            <button
              key={index}
              aria-label={index === currentIndex ? `Баннер ${index + 1} (текущий)` : `Перейти к баннеру ${index + 1}`}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'bg-white w-6 shadow-sm'
                  : 'bg-white/40 w-2 hover:bg-white/60'
              )}
              onClick={() => goToIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
