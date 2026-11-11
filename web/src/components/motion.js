import { useEffect, useState } from 'preact/hooks';

// The motion tokens of tokens.css, for the few things CSS cannot time by itself.
export function tokenMs(name, fallback) {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Keeps a sheet or menu mounted while it leaves. Render it while `mounted`, and give it `.is-open`
 * while `shown`: that arrives a frame after mounting, so the enter transition has a state to start
 * from, and unmounting waits for duration-fast, the time everything takes to leave.
 */
export function usePresence(open) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(
      () => setMounted(false),
      prefersReducedMotion() ? 0 : tokenMs('--duration-fast', 120),
    );
    return () => clearTimeout(timer);
  }, [open]);

  return { mounted, shown };
}
