import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';

/**
 * Asks before unsaved edits are left behind. While `dirty`:
 *   - reloading or closing the tab raises the browser's own question;
 *   - a link inside the app waits in `pending` until `leave` or `stay` answers it.
 * Routing from code (the save itself) passes, and so does the browser's back button: the router
 * has already moved by the time anything hears of it.
 */
export function useUnsavedGuard(dirty) {
  const { route } = useLocation();
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!dirty) return undefined;

    const onBeforeUnload = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    // The same links the router follows. It listens on `window`, so stopping here, one step
    // earlier, holds the navigation back after the link's own handlers have run.
    const onClick = event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }
      const link = event.target.closest?.('a[href]');
      const href = link?.getAttribute('href');
      if (
        !link ||
        link.origin !== location.origin ||
        /^#/.test(href) ||
        !/^(_?self)?$/i.test(link.target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPending(link.href.replace(location.origin, ''));
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick);
    };
  }, [dirty]);

  return {
    pending,
    stay: () => setPending(null),
    leave: () => {
      setPending(null);
      route(pending);
    },
  };
}
