import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';

/**
 * A short ink label for a control, shown on hover and focus. It renders in a portal and flips or
 * shifts to stay on screen.
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

  useEffect(() => {
    if (disabled && isVisible) {
      setIsVisible(false);
    }
  }, [disabled, isVisible]);

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

  const show = useCallback(() => {
    if (!disabled) setIsVisible(true);
  }, [disabled]);
  const hide = useCallback(() => setIsVisible(false), []);

  const tooltip =
    isVisible &&
    createPortal(
      <div
        ref={tooltipRef}
        role='tooltip'
        className='bm-tooltip'
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
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className='inline-flex'
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}
