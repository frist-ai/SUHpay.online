'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Client error:', error);
  }, [error]);

  const [spinning, setSpinning] = useState(false);

  const handleRetry = () => {
    setSpinning(true);
    reset();
    setTimeout(() => setSpinning(false), 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Произошла ошибка</h1>
          <p className="text-muted-foreground text-sm mb-4">
            {error.message || 'Неизвестная ошибка'}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/70 font-mono">
              ID: {error.digest}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Button onClick={handleRetry} className="w-full">
            <RefreshCw className={cn("h-4 w-4 mr-2", spinning && "animate-spin")} />
            Попробовать снова
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.location.href = 'https://t.me/Suhpaybot?startapp=open'}
          >
            Открыть через Telegram
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg text-left">
            <p className="text-xs font-mono text-muted-foreground break-all">
              {error.stack}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
