import { useEffect, useRef } from 'preact/hooks';

// The track's own padding, kept between its edge and a tab it brings into view.
const TRACK_PADDING = 3;

/**
 * The phases of a Pro profile as tabs: the one being edited is ink. When the phases outgrow the
 * row the track scrolls sideways and keeps the selected one in view. Only the track moves:
 * `scrollIntoView` would scroll the page to the tabs as well, every time the editor opens.
 *   phases          the profile's phases, named by number and name
 *   current         index of the phase being edited
 *   onSelect(index)
 */
export function PhaseTabs({ phases, current, onSelect }) {
  const track = useRef(null);

  useEffect(() => {
    const box = track.current?.getBoundingClientRect();
    const tab = track.current?.querySelector('[aria-selected="true"]')?.getBoundingClientRect();
    if (!box || !tab) return;
    if (tab.left < box.left) {
      track.current.scrollLeft += tab.left - box.left - TRACK_PADDING;
    } else if (tab.right > box.right) {
      track.current.scrollLeft += tab.right - box.right + TRACK_PADDING;
    }
  }, [current, phases.length]);

  return (
    <div
      ref={track}
      role='tablist'
      aria-label='Phases'
      className='bm-seg bm-seg--scroll self-start'
    >
      {phases.map((phase, index) => (
        <button
          key={index}
          type='button'
          role='tab'
          id={`tab-${index}`}
          aria-selected={index === current}
          aria-controls={`panel-${index}`}
          className='bm-seg__item'
          onClick={() => onSelect(index)}
        >
          {index + 1} {phase.name || 'Phase'}
        </button>
      ))}
    </div>
  );
}
