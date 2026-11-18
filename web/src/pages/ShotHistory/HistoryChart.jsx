import { useMemo } from 'preact/hooks';
import { ChartComponent } from '../../components/Chart.jsx';
import {
  chartOptions,
  line,
  niceAxis,
  phaseLine,
  secondsAxis,
  valueAxis,
} from '../../utils/chartTheme.js';

const READINGS = ['ct', 'cp', 'fl', 'pf', 'v', 'vf'];
const TARGETS = ['tt', 'tp', 'tf'];

function getChartData(shot) {
  // One pass over the samples, straight into the { x, y } points the chart draws. A target of
  // zero is no target, and leaves a gap in its line.
  const points = Object.fromEntries([...READINGS, ...TARGETS].map(field => [field, []]));
  for (const sample of shot.samples) {
    const x = sample.t / 1000;
    for (const field of READINGS) points[field].push({ x, y: sample[field] });
    for (const field of TARGETS) {
      points[field].push({ x, y: sample[field] > 0 ? sample[field] : null });
    }
  }
  const range = (...fields) => {
    let low = Infinity;
    let high = -Infinity;
    for (const field of fields) {
      for (const { y } of points[field]) {
        if (y == null) continue;
        if (y < low) low = y;
        if (y > high) high = y;
      }
    }
    return [low, high];
  };
  // A reading that never leaves zero (no scale, no target) has no line and no place in the legend.
  const drawn = (field, series, label, options) =>
    points[field].some(point => point.y > 0) ? [line(series, label, points[field], options)] : [];

  const [coolest, hottest] = range('ct', 'tt');
  const [, highest] = range('cp', 'tp', 'fl', 'pf', 'tf', 'vf');
  const [, heaviest] = range('v');
  const last = shot.samples[shot.samples.length - 1];

  // Phase starts come from the header of v5+ files; older shots have none.
  const transitions = shot.version >= 5 && shot.phaseTransitions ? shot.phaseTransitions : [];
  const annotations = {};
  transitions.forEach((transition, index) => {
    // The sample's own time where the file has it; older files only count samples.
    const sample = shot.samples[transition.sampleIndex];
    const ms = sample ? sample.t : transition.sampleIndex * (shot.sampleInterval || 250);
    const at = index ? ms / 1000 : 0;
    const name = transition.phaseName || (index ? `Phase ${transition.phaseNumber + 1}` : '');
    annotations[`phase${index}`] = phaseLine(at, name);
  });

  const onRight = { yAxisID: 'y1' };
  return {
    type: 'line',
    data: {
      datasets: [
        ...drawn('cp', 'pressure', 'Pressure', onRight),
        ...drawn('fl', 'flow', 'Pump flow', onRight),
        ...drawn('pf', 'flow', 'Puck flow', { ...onRight, kind: 'estimate' }),
        ...drawn('ct', 'temperature', 'Temp', {}),
        ...drawn('v', 'weight', 'Weight', { yAxisID: 'y2' }),
        ...drawn('vf', 'weight', 'Weight flow', { ...onRight, kind: 'estimate', unit: 'g/s' }),
        ...drawn('tp', 'pressure', undefined, { ...onRight, kind: 'target' }),
        ...drawn('tf', 'flow', undefined, { ...onRight, kind: 'target' }),
        ...drawn('tt', 'temperature', undefined, { kind: 'target' }),
      ],
    },
    options: chartOptions({
      scales: {
        x: secondsAxis(0, last ? last.t / 1000 : 1),
        y: valueAxis(
          coolest <= hottest
            ? niceAxis(Math.max(0, Math.floor(coolest) - 2), Math.ceil(hottest) + 2)
            : niceAxis(80, 100),
          { format: value => `${Math.round(value)}°` },
        ),
        y1: valueAxis(niceAxis(0, Math.max(12, highest)), { position: 'right', grid: false }),
        y2: valueAxis(niceAxis(0, Math.max(10, heaviest)), { hidden: true }),
      },
      annotations,
    }),
  };
}

/** The readings of one recorded shot over its time. */
export function HistoryChart({ shot }) {
  // The list reloads when a note is saved; the chart only changes with the recording itself.
  const { samples, version, phaseTransitions, sampleInterval } = shot;
  const chartData = useMemo(
    () => getChartData({ samples, version, phaseTransitions, sampleInterval }),
    [samples, version, phaseTransitions, sampleInterval],
  );

  return (
    <ChartComponent
      plotClassName='h-56 flex-none sm:h-72'
      chartClassName='h-full w-full'
      data={chartData}
      label={`Shot ${shot.id}`}
    />
  );
}
