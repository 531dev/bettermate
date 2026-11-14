import { SegmentBar } from '../../../../components/SegmentBar.jsx';

// Segments of the scrubber's track: enough to read as a scale at a phone's width.
const SCRUBBER_SEGMENTS = 48;

/**
 * The phone's way to read a chart: drag along the track under it and the readings above follow.
 * The track is a row of segments lit up to the scrubbed time. An unseen native range sits over
 * it for the keyboard and for assistive technology.
 */
export function MobileChartScrubber({
  active = false,
  ariaLabel,
  insets = { left: 0, right: 0 },
  max,
  min = 0,
  onInput,
  onPointerUpdate,
  scrubberRef,
  value,
  variant,
}) {
  const handlePointerDown = event => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onPointerUpdate(event);
  };

  const handlePointerMove = event => {
    if (event.buttons !== 1 && event.pointerType !== 'touch') return;
    onPointerUpdate(event);
  };

  const span = Number(max) - Number(min);
  const fraction = active && span > 0 ? (Number(value) - Number(min)) / span : 0;

  return (
    <div
      ref={scrubberRef}
      className={[
        'shot-chart-mobile-scrubber',
        variant === 'compare' && 'shot-chart-mobile-scrubber--compare',
        active && 'shot-chart-mobile-scrubber--active',
      ]
        .filter(Boolean)
        .join(' ')}
      data-variant={variant}
      style={{
        marginLeft: `${insets.left}px`,
        marginRight: `${insets.right}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <SegmentBar
        value={fraction}
        total={SCRUBBER_SEGMENTS}
        className='shot-chart-mobile-scrubber__track'
      />
      <div className='shot-chart-mobile-scrubber__hint' aria-hidden='true'>
        Swipe
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step='0.1'
        value={value}
        className='shot-chart-mobile-scrubber__range'
        aria-label={ariaLabel}
        onInput={onInput}
      />
      <span className='shot-chart-mobile-scrubber__focus' aria-hidden='true' />
    </div>
  );
}
