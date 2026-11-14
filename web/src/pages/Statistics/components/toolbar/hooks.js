/* global globalThis */

// Custom hooks for StatisticsToolbar: search sync, collapse behaviour and popover state
import { useEffect, useRef, useState } from 'preact/hooks';
import { isToolbarFloatingPanelOpen, isToolbarFloatingPanelTarget } from './helpers';

export function useAdvancedSearchSync({
  query,
  parseErrorsLength,
  parseWarningsLength,
  showAdvancedSearch,
  setShowAdvancedSearch,
  setShowDslSelectionPreview,
}) {
  useEffect(() => {
    if (query || parseErrorsLength > 0 || parseWarningsLength > 0) {
      setShowAdvancedSearch(true);
    }
  }, [query, parseErrorsLength, parseWarningsLength, setShowAdvancedSearch]);

  useEffect(() => {
    if (!showAdvancedSearch) {
      setShowDslSelectionPreview(false);
    }
  }, [showAdvancedSearch, setShowDslSelectionPreview]);

  useEffect(() => {
    if (!String(query || '').trim()) {
      setShowDslSelectionPreview(false);
    }
  }, [query, setShowDslSelectionPreview]);
}

export function useDslPreviewOutsideDismiss({
  shouldShowDslSelectionPreview,
  isToolbarExpanded,
  dslInputRef,
  setShowDslSelectionPreview,
}) {
  useEffect(() => {
    if (!shouldShowDslSelectionPreview || !isToolbarExpanded) return;

    const handlePointerDown = event => {
      const inputNode = dslInputRef.current;
      if (!inputNode) return;
      if (inputNode.contains(event.target)) return;
      setShowDslSelectionPreview(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [shouldShowDslSelectionPreview, isToolbarExpanded, dslInputRef, setShowDslSelectionPreview]);
}

// Once statistics are built the toolbar folds into its summary row. It unfolds on demand and
// folds again on a press outside it or on Escape. The popovers it opens close with their
// controls: they unmount when the toolbar folds and close themselves while it is busy.
export function useToolbarCollapseBehavior({
  isToolbarExpanded,
  shouldCollapseToolbar,
  isCollapsedStripExpanded,
  toolbarContainerRef,
  setShowDslSelectionPreview,
  setIsCollapsedStripExpanded,
}) {
  useEffect(() => {
    if (isToolbarExpanded) return;
    setShowDslSelectionPreview(false);
  }, [isToolbarExpanded, setShowDslSelectionPreview]);

  useEffect(() => {
    if (!shouldCollapseToolbar) {
      setIsCollapsedStripExpanded(false);
    }
  }, [shouldCollapseToolbar, setIsCollapsedStripExpanded]);

  useEffect(() => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;

    const handlePointerDown = event => {
      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;
      if (toolbarNode.contains(event.target)) return;
      if (isToolbarFloatingPanelTarget(event.target)) return;
      setIsCollapsedStripExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setIsCollapsedStripExpanded,
  ]);

  useEffect(() => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;

    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;

      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;

      // Escape closes the innermost layer first: an open popover or sheet takes this press.
      if (isToolbarFloatingPanelOpen(globalThis.document)) return;

      const eventTarget = event.target instanceof Element ? event.target : null;
      const activeElement = globalThis.document?.activeElement;
      const isToolbarFocused =
        (eventTarget && toolbarNode.contains(eventTarget)) ||
        (activeElement instanceof Element && toolbarNode.contains(activeElement));

      if (!isToolbarFocused) return;

      event.preventDefault();
      setIsCollapsedStripExpanded(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setIsCollapsedStripExpanded,
  ]);
}

// The state of one popover of the toolbar: its anchor, and a panel that closes when its control
// is disabled (the toolbar is busy).
export function usePopoverState(disabled = false) {
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return {
    anchor,
    open: open && !disabled,
    toggle: () => setOpen(value => !value),
    close: () => setOpen(false),
  };
}

// Moves focus to the element marked `data-autofocus` inside `containerRef` once a popover has
// opened. The panel is placed a frame or two after it mounts and cannot take focus before that.
export function useFocusOnOpen(open, containerRef, enabled = true) {
  useEffect(() => {
    if (!open || !enabled) return undefined;
    const view = globalThis.window;
    if (!view?.requestAnimationFrame) return undefined;

    let frame = 0;
    let attempts = 0;
    const tryFocus = () => {
      const target = containerRef.current?.querySelector?.('[data-autofocus]');
      if (target && view.getComputedStyle(target).visibility !== 'hidden') {
        target.focus({ preventScroll: true });
        return;
      }
      attempts += 1;
      if (attempts < 12) frame = view.requestAnimationFrame(tryFocus);
    };
    frame = view.requestAnimationFrame(tryFocus);
    return () => view.cancelAnimationFrame(frame);
  }, [open, enabled, containerRef]);
}

// Whether a media query matches, kept current.
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
