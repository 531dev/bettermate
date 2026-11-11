import PropTypes from 'prop-types';
import { Icon } from '../../../components/Icon.jsx';
import { gaugeColor } from './gaugeScales.js';
import { PRESSURE_SCALE_MAX, TEMP_SCALE_MAX } from './machineView.js';

// The machine's own round display, at phone size: scales on the rim, one reading in the middle.
const CENTER = 120;
const RADIUS = 106;

// Degrees clockwise from the right. Each arc starts at its low end, at the bottom.
const ARCS = {
  left: { start: 110, sweep: 140 },
  right: { start: 70, sweep: -140 },
  full: { start: 120, sweep: 300 },
};

const point = (degrees, radius = RADIUS) => {
  const angle = (degrees * Math.PI) / 180;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
};

const arcPath = (from, to) => {
  const [x0, y0] = point(from);
  const [x1, y1] = point(to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const clockwise = to > from ? 1 : 0;
  return `M${x0} ${y0}A${RADIUS} ${RADIUS} 0 ${large} ${clockwise} ${x1} ${y1}`;
};

// SVG cannot run a gradient along an arc, so the scale is drawn as short colored segments.
function segments({ start, sweep }, scale) {
  const count = Math.round(Math.abs(sweep) / 5);
  const overlap = Math.sign(sweep) * 0.5;
  return Array.from({ length: count }, (_, i) => ({
    d: arcPath(
      start + (sweep * i) / count,
      start + (sweep * (i + 1)) / count + (i < count - 1 ? overlap : 0),
    ),
    color: gaugeColor(scale, (i + 0.5) / count),
  }));
}

const SCALE_ARCS = {
  temp: { left: segments(ARCS.left, 'temp'), full: segments(ARCS.full, 'temp') },
  pressure: { right: segments(ARCS.right, 'pressure') },
  fill: { full: segments(ARCS.full, 'fill') },
};

const fraction = (value, max) => Math.max(0, Math.min(1, (value ?? 0) / max));
const angleOf = ({ start, sweep }, position) => start + sweep * position;

// The whole scale, or as much of it as `position` has reached, over an empty track.
function Scale({ arc, parts, position }) {
  const shown = position == null ? parts : parts.slice(0, Math.ceil(parts.length * position));
  const [startX, startY] = point(arc.start);
  const [endX, endY] = point(arc.start + (arc.sweep * shown.length) / parts.length);
  return (
    <>
      {position != null && (
        <path className='bm-dial__track' d={arcPath(arc.start, arc.start + arc.sweep)} />
      )}
      {shown.length > 0 && <circle cx={startX} cy={startY} r='4' fill={shown[0].color} />}
      {shown.length > 0 && <circle cx={endX} cy={endY} r='4' fill={shown.at(-1).color} />}
      {shown.map(part => (
        <path key={part.d} className='bm-dial__segment' d={part.d} stroke={part.color} />
      ))}
    </>
  );
}

Scale.propTypes = {
  arc: PropTypes.object.isRequired,
  parts: PropTypes.array.isRequired,
  position: PropTypes.number,
};

function Mark({ arc, position }) {
  return (
    <line
      className='bm-dial__mark'
      x1={CENTER + RADIUS - 9}
      y1={CENTER}
      x2={CENTER + RADIUS + 9}
      y2={CENTER}
      style={{ transform: `rotate(${angleOf(arc, position)}deg)` }}
    />
  );
}

Mark.propTypes = {
  arc: PropTypes.object.isRequired,
  position: PropTypes.number.isRequired,
};

function Notch({ arc, position }) {
  const degrees = angleOf(arc, position);
  const [x0, y0] = point(degrees, RADIUS + 6);
  const [x1, y1] = point(degrees, RADIUS + 12);
  return <line className='bm-dial__notch' x1={x0} y1={y0} x2={x1} y2={y1} />;
}

Notch.propTypes = {
  arc: PropTypes.object.isRequired,
  position: PropTypes.number.isRequired,
};

function Rim({ ds, dial }) {
  const hasReading = ds.hasReading;
  const temp = fraction(ds.currentTemperature, TEMP_SCALE_MAX);
  const tempTarget = fraction(ds.targetTemperature, TEMP_SCALE_MAX);
  const showTarget = hasReading && !dial.asleep && ds.mode !== 0;

  if (dial.rim === 'progress') {
    return <Scale arc={ARCS.full} parts={SCALE_ARCS.fill.full} position={dial.progress ?? 0} />;
  }
  if (dial.rim === 'temp') {
    return (
      <>
        <Scale arc={ARCS.full} parts={SCALE_ARCS.temp.full} />
        {showTarget && <Notch arc={ARCS.full} position={tempTarget} />}
        {hasReading && <Mark arc={ARCS.full} position={temp} />}
      </>
    );
  }
  const pressure = fraction(ds.currentPressure, PRESSURE_SCALE_MAX);
  return (
    <>
      <Scale arc={ARCS.left} parts={SCALE_ARCS.temp.left} />
      <Scale arc={ARCS.right} parts={SCALE_ARCS.pressure.right} />
      {showTarget && <Notch arc={ARCS.left} position={tempTarget} />}
      {showTarget && ds.targetPressure > 0 && (
        <Notch arc={ARCS.right} position={fraction(ds.targetPressure, PRESSURE_SCALE_MAX)} />
      )}
      {hasReading && <Mark arc={ARCS.left} position={temp} />}
      {hasReading && <Mark arc={ARCS.right} position={pressure} />}
      <text className='bm-dial__scale-name' x={CENTER - 7} y='228' textAnchor='end'>
        °C
      </text>
      <text className='bm-dial__scale-name' x={CENTER + 7} y='228'>
        bar
      </text>
    </>
  );
}

Rim.propTypes = {
  ds: PropTypes.object.isRequired,
  dial: PropTypes.object.isRequired,
};

const stepButton = 'btn btn-circle btn-outline h-11 w-11 shrink-0 bg-[var(--surface-2)] p-0';

function Reading({ dial }) {
  return (
    <div className='bm-dial__reading'>
      {dial.reading}
      {dial.unit && <span className='bm-dial__unit'>{dial.unit}</span>}
    </div>
  );
}

Reading.propTypes = {
  dial: PropTypes.object.isRequired,
};

export function MachineDial({ ds, dial, className = '' }) {
  if (!dial) return null;
  const { stepper } = dial;

  return (
    <div
      role='group'
      aria-label='Live readings'
      data-rim={dial.rim}
      className={`bm-dial ${dial.asleep ? 'bm-dial--asleep' : ''} ${className}`}
    >
      <svg className='bm-dial__rim' viewBox='0 0 240 240' aria-hidden='true'>
        <Rim ds={ds} dial={dial} />
      </svg>
      <div className={`bm-dial__center ${stepper ? 'bm-dial__center--stepper' : ''}`}>
        {stepper ? (
          <div className='bm-dial__stepper'>
            <button
              type='button'
              className={stepButton}
              aria-label={`Decrease ${stepper.name} target`}
              onClick={stepper.onDecrease}
            >
              <Icon name='minus' />
            </button>
            <Reading dial={dial} />
            <button
              type='button'
              className={stepButton}
              aria-label={`Increase ${stepper.name} target`}
              onClick={stepper.onIncrease}
            >
              <Icon name='plus' />
            </button>
          </div>
        ) : (
          <Reading dial={dial} />
        )}
        {dial.label && <div className='bm-dial__label'>{dial.label}</div>}
        {dial.readings?.length > 0 && (
          <div className='bm-dial__readings'>
            {dial.readings.map(reading => (
              <span key={reading}>{reading}</span>
            ))}
          </div>
        )}
        {dial.detail && <div className='bm-dial__detail'>{dial.detail}</div>}
      </div>
    </div>
  );
}

MachineDial.propTypes = {
  ds: PropTypes.object.isRequired,
  dial: PropTypes.object,
  className: PropTypes.string,
};
