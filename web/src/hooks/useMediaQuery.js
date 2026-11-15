/* global globalThis */
import { useEffect, useState } from 'preact/hooks';

/**
 * Whether a media query matches, kept current: `useMediaQuery('(max-width: 599.98px)')`.
 * For what CSS cannot do alone, such as a page that renders different parts on a phone.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => globalThis.window?.matchMedia?.(query).matches || false,
  );

  useEffect(() => {
    const mediaQuery = globalThis.window?.matchMedia?.(query);
    if (!mediaQuery) return undefined;

    const handleChange = event => setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, [query]);

  return matches;
}
