import { cx } from './cx.js';
import { SegmentBar } from './SegmentBar.jsx';
import { Tile } from './Tile.jsx';

/**
 * A reading: mono label, tabular numeral with its raised unit, then a segment bar. The order is fixed.
 *   label   the eyebrow above the numeral
 *   value   the numeral, already formatted; a missing value shows as a dash
 *   unit    'bar', '°C', 'g': the recipe raises it and sets it in uppercase
 *   target  shown as '/ target' after the numeral, only when a target exists
 *   bar     SegmentBar props: { value, target, tone, total }
 *   size    'sm' for a compact reading inside a Cell
 * Children follow the numeral, such as a line of `bm-data` facts.
 */
export function Stat({ label, value, unit, target, bar, size, className, children }) {
  return (
    <div className={cx('bm-stat', size === 'sm' && 'bm-stat--sm', className)}>
      {label && <span className='bm-eyebrow'>{label}</span>}
      <div className='bm-stat__row'>
        <span className='bm-stat__value'>{value ?? '—'}</span>
        {unit && <span className='bm-stat__unit'>{unit}</span>}
        {target != null && <span className='bm-stat__target'>/ {target}</span>}
      </div>
      {bar && <SegmentBar {...bar} />}
      {children}
    </div>
  );
}

/**
 * A Stat in its own tile.
 *   chip     one status Chip; the label then moves into the tile's head beside it
 *   heating  the heat ground, only while this boiler is heating (pass a HEATING Chip with it)
 * Everything else is passed to Stat.
 */
export function StatTile({ label, chip, heating = false, className, ...stat }) {
  return (
    <Tile
      tone={heating ? 'heat' : undefined}
      eyebrow={chip ? label : undefined}
      end={chip}
      className={className}
    >
      <Stat label={chip ? undefined : label} {...stat} />
    </Tile>
  );
}
