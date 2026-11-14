import { useMemo, useRef } from 'preact/hooks';
import {
  band,
  bandColor,
  chartOptions,
  DASHED,
  line,
  niceAxis,
  phaseLine,
  secondsAxis,
  valueAxis,
} from '../utils/chartTheme.js';
import { ChartComponent } from './Chart.jsx';

const POINT_INTERVAL = 0.1; // s

// Where a phase holds the other quantity, this one is only its limit: dashed like a target, and
// 2px like every line but the pressure a phase holds.
const limit = (ctx, value) => (ctx.p0.raw.target ? undefined : value);
const curve = (series, label, data) =>
  line(series, label, data, {
    segment: {
      borderDash: ctx => limit(ctx, DASHED.borderDash),
      borderCapStyle: ctx => limit(ctx, DASHED.borderCapStyle),
      borderWidth: ctx => limit(ctx, 2),
    },
  });

function easeLinear(t) {
  return t;
}
function easeIn(t) {
  return t * t;
}
function easeOut(t) {
  return 1.0 - (1.0 - t) * (1.0 - t);
}
function easeInOut(t) {
  return t < 0.5 ? 2.0 * t * t : 1.0 - 2.0 * (1.0 - t) * (1.0 - t);
}

function applyEasing(t, type) {
  if (t <= 0.0) return 0.0;
  if (t >= 1.0) return 1.0;
  switch (type) {
    case 'linear':
      return easeLinear(t);
    case 'ease-in':
      return easeIn(t);
    case 'ease-out':
      return easeOut(t);
    case 'ease-in-out':
      return easeInOut(t);
    case 'instant':
    default:
      return 1.0;
  }
}

function prepareData(phases, target) {
  if (!Array.isArray(phases) || phases.length === 0) {
    return [];
  }

  const data = [];
  let time = 0;
  let phaseTime = 0;
  let phaseIndex = 0;
  let currentPhase = phases[phaseIndex];
  let currentPressure = 0;
  let currentFlow = 0;
  let phaseStartFlow = 0;
  let phaseStartPressure = 0;
  let effectiveFlow = currentPhase.pump?.flow || 0;
  let effectivePressure = currentPhase.pump?.pressure || 0;

  do {
    currentPhase = phases[phaseIndex];
    const alpha = applyEasing(
      phaseTime / (currentPhase.transition?.duration || currentPhase.duration),
      currentPhase?.transition?.type || 'linear',
    );
    currentFlow =
      currentPhase.pump?.target === 'flow'
        ? phaseStartFlow + (effectiveFlow - phaseStartFlow) * alpha
        : currentPhase.pump?.flow || 0;
    currentPressure =
      currentPhase.pump?.target === 'pressure'
        ? phaseStartPressure + (effectivePressure - phaseStartPressure) * alpha
        : currentPhase.pump?.pressure || 0;
    data.push({
      x: time,
      y: target === 'pressure' ? currentPressure : currentFlow,
      target: currentPhase.pump?.target === target,
    });
    time += POINT_INTERVAL;
    phaseTime += POINT_INTERVAL;
    // Also true for a duration that is not a number yet, so a half-typed phase cannot hang the loop.
    if (!(phaseTime < currentPhase.duration)) {
      phaseTime = 0;
      phaseIndex++;
      if (phaseIndex < phases.length) {
        phaseStartFlow = currentFlow;
        phaseStartPressure = currentPressure;
        let nextPhase = phases[phaseIndex];
        effectiveFlow = nextPhase.pump?.flow === -1 ? currentFlow : nextPhase.pump?.flow || 0;
        effectivePressure =
          nextPhase.pump?.pressure === -1 ? currentPressure : nextPhase.pump?.pressure || 0;
      }
    }
  } while (phaseIndex < phases.length);

  return data;
}

function buildPhaseRanges(phases) {
  const ranges = [];
  let start = 0;
  for (const phase of phases) {
    const duration = Number.parseFloat(phase.duration);
    ranges.push({ start, end: start + duration });
    start += duration;
  }
  return ranges;
}

function makeChartData(phases, selectedPhase, showLabels, onPhaseClick) {
  const ranges = buildPhaseRanges(phases);
  const duration = ranges.length ? ranges[ranges.length - 1].end : 0;
  const pressure = prepareData(phases, 'pressure');
  const flow = prepareData(phases, 'flow');
  // Bar and ml/s share the one axis, as they do on the shot charts.
  const top = [...pressure, ...flow].reduce((most, point) => Math.max(most, point.y), 12);

  const annotations = [];
  // The phase being edited, or the one the machine is in.
  if (selectedPhase !== null && ranges[selectedPhase]) {
    annotations.push(band(ranges[selectedPhase].start, ranges[selectedPhase].end));
  }
  phases.forEach((phase, i) => {
    annotations.push(phaseLine(ranges[i].start, phase.name || `Phase ${i + 1}`, showLabels));
  });
  // In the editor a phase is picked by pressing its stretch of the chart.
  if (onPhaseClick) {
    ranges.forEach(({ start, end }, i) => {
      annotations.push(
        // Inset a little, so the pointer on a boundary is over one phase only.
        band(start + 0.1, end - 0.1, {
          kind: 'hover',
          backgroundColor: 'transparent',
          enter({ element }) {
            element.options.backgroundColor = bandColor('hover');
            return true;
          },
          leave({ element }) {
            element.options.backgroundColor = 'transparent';
            return true;
          },
          click() {
            onPhaseClick(i);
            return true;
          },
        }),
      );
    });
  }

  const config = {
    type: 'line',
    data: { datasets: [curve('pressure', 'Pressure', pressure), curve('flow', 'Flow', flow)] },
    options: chartOptions({
      scales: {
        x: secondsAxis(0, duration || 1),
        y: valueAxis(niceAxis(0, top)),
      },
      annotations,
      ...(onPhaseClick && { events: ['mousemove', 'mouseout', 'click', 'touchstart'] }),
    }),
  };
  if (onPhaseClick) {
    config.options.plugins.annotation.interaction = { intersect: false, mode: 'x', axis: 'x' };
  }
  return config;
}

/**
 * The pressure and flow a profile asks for, over its phases.
 *   data             the profile; its `phases` are drawn
 *   className        the canvas: cap its height here (`max-h-36`), or size the plot with `style`
 *   style            the plot's box, such as `{ height: '128px' }`; the legend sits above it
 *   selectedPhase    index of the phase to mark with a band
 *   onPhaseClick(i)  makes the phases pressable, for the editor
 *   showPhaseLabels  false leaves the phase names off the lines; they are off under 520px anyway
 */
export function ExtendedProfileChart({
  data,
  className = 'max-h-36 w-full',
  selectedPhase = null,
  onPhaseClick = null,
  showPhaseLabels = true,
  style,
}) {
  const phases = Array.isArray(data?.phases) ? data.phases : [];
  const showLabels = showPhaseLabels && window.innerWidth >= 520;
  const pressable = !!onPhaseClick;
  const press = useRef(onPhaseClick);
  press.current = onPhaseClick;

  // Parents render often (every keystroke in the editor, every reading on the dashboard); the
  // chart only changes with the phases themselves.
  const shape = JSON.stringify(phases);
  const config = useMemo(
    () =>
      makeChartData(
        JSON.parse(shape),
        selectedPhase,
        showLabels,
        pressable ? index => press.current?.(index) : null,
      ),
    [shape, selectedPhase, showLabels, pressable],
  );

  return (
    <ChartComponent
      className='min-h-0 max-w-full flex-shrink flex-grow'
      plotClassName={style ? 'flex-none' : undefined}
      plotStyle={style}
      chartClassName={`${className}${pressable ? ' cursor-pointer' : ''}`}
      data={config}
      label='Pressure and flow over the phases of the profile'
    />
  );
}
