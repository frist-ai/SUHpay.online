// Swipe navigation disabled — Telegram MiniApp uses platform swipe-back gesture.
// This hook is kept as a no-op for backward compatibility.
export function useSwipeNavigation() {
  return {
    handleTouchStart: () => {},
    handleTouchMove: () => {},
    handleTouchEnd: () => {},
  };
}
