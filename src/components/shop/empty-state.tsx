'use client';

import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: 'cart' | 'orders' | 'favorites' | 'search' | 'default';
  title: string;
  description: string;
  secondaryText?: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

// Animated SVG illustrations for each empty state type
function CartIllustration() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
      {/* Cart body */}
      <motion.path
        d="M25 35h10l8 40h45l7-30H42"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand/60"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
      />
      {/* Wheels */}
      <motion.circle
        cx="48" cy="88" r="6"
        stroke="currentColor"
        strokeWidth="3"
        className="text-brand/40"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: 0.8, type: 'spring' }}
      />
      <motion.circle
        cx="78" cy="88" r="6"
        stroke="currentColor"
        strokeWidth="3"
        className="text-brand/40"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: 1.0, type: 'spring' }}
      />
      {/* Floating items */}
      <motion.rect
        x="55" y="18" width="14" height="14" rx="3"
        stroke="currentColor"
        strokeWidth="2"
        className="text-brand/30"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: [0, -4, 0], opacity: 1 }}
        transition={{ y: { duration: 2, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.4, delay: 1.2 } }}
      />
      <motion.rect
        x="75" y="12" width="10" height="10" rx="2"
        stroke="currentColor"
        strokeWidth="2"
        className="text-brand/20"
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: [0, -6, 0], opacity: 1 }}
        transition={{ y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }, opacity: { duration: 0.4, delay: 1.4 } }}
      />
      {/* Plus sign hint */}
      <motion.line
        x1="68" y1="22" x2="68" y2="28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-brand/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: 2 }}
      />
      <motion.line
        x1="65" y1="25" x2="71" y2="25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-brand/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: 2 }}
      />
    </svg>
  );
}

function OrdersIllustration() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
      {/* Box body */}
      <motion.path
        d="M25 45 L60 30 L95 45 L95 80 L60 95 L25 80 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        className="text-brand/60"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
      />
      {/* Box top flap */}
      <motion.path
        d="M25 45 L60 60 L95 45"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        className="text-brand/40"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.9, ease: 'easeOut' }}
      />
      {/* Center seam */}
      <motion.line
        x1="60" y1="60" x2="60" y2="95"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-brand/30"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 1.3, ease: 'easeOut' }}
      />
      {/* Dashed delivery trail */}
      <motion.path
        d="M10 50 Q 15 35, 25 45"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 4"
        strokeLinecap="round"
        className="text-brand/20"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0, 1, 0.5] }}
        transition={{ pathLength: { duration: 1, delay: 1.5 }, opacity: { duration: 2, delay: 1.5, repeat: Infinity } }}
      />
    </svg>
  );
}

function FavoritesIllustration() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
      {/* Main heart */}
      <motion.path
        d="M60 90 C 20 65, 10 40, 35 30 C 48 24, 58 32, 60 40 C 62 32, 72 24, 85 30 C 110 40, 100 65, 60 90Z"
        stroke="currentColor"
        strokeWidth="3"
        className="text-brand/60"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
      />
      {/* Heart fill animation */}
      <motion.path
        d="M60 90 C 20 65, 10 40, 35 30 C 48 24, 58 32, 60 40 C 62 32, 72 24, 85 30 C 110 40, 100 65, 60 90Z"
        fill="currentColor"
        className="text-brand/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.15, 0.08] }}
        transition={{ duration: 2, delay: 1, repeat: Infinity, repeatType: 'reverse' }}
      />
      {/* Sparkle 1 */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, delay: 1.5, repeat: Infinity, repeatDelay: 2 }}
      >
        <line x1="95" y1="20" x2="95" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand/40" />
        <line x1="91" y1="24" x2="99" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand/40" />
      </motion.g>
      {/* Sparkle 2 */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, delay: 2.5, repeat: Infinity, repeatDelay: 2 }}
      >
        <line x1="25" y1="22" x2="25" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand/30" />
        <line x1="22" y1="25" x2="28" y2="25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand/30" />
      </motion.g>
      {/* Small floating hearts */}
      <motion.path
        d="M88 12 C 85 8, 80 10, 83 14 C 80 10, 85 8, 88 12Z"
        fill="currentColor"
        className="text-brand/20"
        animate={{ y: [0, -5, 0], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
      {/* Magnifying glass circle */}
      <motion.circle
        cx="52" cy="52" r="25"
        stroke="currentColor"
        strokeWidth="3.5"
        className="text-brand/60"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
      />
      {/* Handle */}
      <motion.line
        x1="70" y1="70" x2="95" y2="95"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="text-brand/40"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.9, ease: 'easeOut' }}
      />
      {/* Question mark inside */}
      <motion.path
        d="M48 42 C 48 36, 58 34, 58 42 C 58 48, 50 48, 50 54"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-brand/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.5] }}
        transition={{ duration: 2, delay: 1.3, repeat: Infinity, repeatType: 'reverse' }}
      />
      <motion.circle
        cx="50" cy="60" r="2"
        fill="currentColor"
        className="text-brand/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.5] }}
        transition={{ duration: 2, delay: 1.5, repeat: Infinity, repeatType: 'reverse' }}
      />
      {/* Floating dots */}
      <motion.circle cx="30" cy="35" r="2" fill="currentColor" className="text-brand/15"
        animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.circle cx="38" cy="25" r="1.5" fill="currentColor" className="text-brand/10"
        animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
    </svg>
  );
}

const illustrationMap: Record<string, React.FC> = {
  cart: CartIllustration,
  orders: OrdersIllustration,
  favorites: FavoritesIllustration,
  search: SearchIllustration,
  default: OrdersIllustration,
};

export function EmptyState({ 
  icon = 'default', 
  title, 
  description, 
  secondaryText,
  buttonText = 'Перейти в каталог',
  onButtonClick 
}: EmptyStateProps) {
  const Illustration = illustrationMap[icon] || illustrationMap.default;

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full p-4 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Animated SVG illustration */}
      <motion.div
        className="w-28 h-28 mb-4 text-brand"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
      >
        <Illustration />
      </motion.div>

      {/* Title */}
      <motion.h2
        className="text-xl font-bold mb-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        {title}
      </motion.h2>

      {/* Description */}
      <motion.p
        className="text-muted-foreground mb-1.5 max-w-xs text-sm leading-relaxed"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.4 }}
      >
        {description}
      </motion.p>

      {/* Secondary text */}
      {secondaryText && (
        <motion.p
          className="text-muted-foreground/60 mb-5 max-w-xs text-xs leading-relaxed"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.5 }}
        >
          {secondaryText}
        </motion.p>
      )}

      {/* CTA button with gradient */}
      {onButtonClick && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6, type: 'spring', stiffness: 180 }}
        >
          <Button
            onClick={onButtonClick}
            className="bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 text-brand-foreground shadow-lg shadow-brand/20 hover:shadow-brand/30 active:scale-[0.97] transition-all px-6 py-2.5 rounded-xl font-semibold"
            size="lg"
          >
            <ShoppingBag className="h-4.5 w-4.5 mr-2" />
            {buttonText}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
