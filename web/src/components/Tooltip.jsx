import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';

// Hover waits this long; keyboard focus shows it at once.
const HOVER_DELAY_MS = 500;
const canHover = () => window.matchMedia('(hover: hover)').matches;

/**
 * The name of an icon-only control, shown on hover and on keyboard focus: two or three words, the
 * same as the control's aria-label. Never anything a person needs (touch screens have no hover).
 * It appears 500 ms after the pointer rests, at once on focus, and leaves on Escape, on a press,
 * and when pointer and focus leave; the pointer can move onto it. It renders in a portal and
 * flips or shifts to stay on screen. When it repeats the control's name it is hidden from
 * assistive technology.
 *   content    the label's text
 *   placement  'top' (default), 'bottom', 'left' or 'right'
 *   disabled   never show it
 */
export function Tooltip({ content, children, placement = 'top', disabled = false }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [actualPlacement, setActualPlacement] = useState(placement);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (disabled && isVisible) {
      setIsVisible(false);
    }
  }, [disabled, isVisible]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const onKey = event => event.key === 'Escape' && setIsVisible(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isVisible]);
  useEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current || disabled) return;

    const cleanup = autoUpdate(triggerRef.current, tooltipRef.current, () => {
      // The observers can fire once more as the tooltip is removed.
      if (!triggerRef.current || !tooltipRef.current) return;
      computePosition(triggerRef.current, tooltipRef.current, {
        placement,
        strategy: 'fixed',
        middleware: [
          offset(8), // 8px gap from trigger
          flip(), // Flip to opposite side if no space
          shift({ padding: 8 }), // Shift along axis to stay in viewport
        ],
      }).then(({ x, y, placement: finalPlacement }) => {
        setPosition(pos => {
          // Only update if changed to prevent render loops
          if (pos.x === x && pos.y === y) return pos;
          return { x, y };
        });
        setActualPlacement(finalPlacement);
      });
    });

    return cleanup;
  }, [disabled, isVisible, placement]);

  const showNow = useCallback(() => {
    clearTimeout(timer.current);
    if (!disabled) setIsVisible(true);
  }, [disabled]);
  const showSoon = useCallback(() => {
    clearTimeout(timer.current);
    if (!disabled && canHover()) timer.current = setTimeout(showNow, HOVER_DELAY_MS);
  }, [disabled, showNow]);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setIsVisible(false);
  }, []);
  // Leaving the control for the tooltip itself keeps it, so it can be read under magnification.
  const hideSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setIsVisible(false), 100);
  }, []);
  const repeatsName = () =>
    triggerRef.current?.querySelector('[aria-label]')?.getAttribute('aria-label') === content;

  const tooltip =
    isVisible &&
    createPortal(
      <div
        ref={tooltipRef}
        role='tooltip'
        aria-hidden={repeatsName() ? 'true' : undefined}
        className='bm-tooltip'
        onMouseEnter={() => clearTimeout(timer.current)}
        onMouseLeave={hide}
        data-placement={actualPlacement}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        {content}
      </div>,
      document.body,
    );

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={showSoon}
        onMouseLeave={hideSoon}
        onFocusIn={event => event.target.matches(':focus-visible') && showNow()}
        onFocusOut={hide}
        onPointerDown={hide}
        className='inline-flex'
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}
