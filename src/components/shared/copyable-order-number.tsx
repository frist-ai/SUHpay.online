'use client';

import { useState, useCallback } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyableOrderNumberProps {
  orderNumber: string;
  className?: string;
  prefix?: string;
  size?: 'sm' | 'md';
}

export function CopyableOrderNumber({
  orderNumber,
  className,
  prefix = '#',
  size = 'sm',
}: CopyableOrderNumberProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers / Telegram WebKit
      const textarea = document.createElement('textarea');
      textarea.value = orderNumber;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [orderNumber]);

  if (copied) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-mono text-green-600 dark:text-green-400 cursor-default',
          size === 'sm' && 'text-[13px]',
          size === 'md' && 'text-sm',
          className
        )}
      >
        <Check className="h-3 w-3" />
        Скопировано
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      className={cn(
        'inline-flex items-center font-mono font-medium cursor-pointer select-none active:opacity-60 transition-opacity',
        size === 'sm' && 'text-[13px]',
        size === 'md' && 'text-sm',
        className
      )}
      onClick={handleCopy}
      onTouchEnd={handleCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleCopy(e as unknown as React.MouseEvent);
        }
      }}
    >
      {prefix}{orderNumber}
    </span>
  );
}
