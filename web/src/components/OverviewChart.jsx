import { effect } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { machine } from '../services/ApiService.js';
import {
  applyChartTheme,
  chartOptions,
  line,
  niceAxis,
  phaseLine,
  secondsAxis,
  secondsStep,
  valueAxis,
} from '../utils/chartTheme.js';
import { ChartComponent } from './Chart.jsx';

// The live chart. It appends each reading to the lines it already holds and never rebuilds them.
// A shot grows from 0 s at the left edge and what is drawn stays where it is; between shots the
// last minute is a strip on the clock that moves on a quarter of a minute at a time.

const STRIP = 60; // seconds of readings between shots
const STRIP_STEP = 15; // how far the strip moves on when a reading passes its right edge
const SHOT = 30; // the shortest time axis of a shot
const SHOT_STEP = 15; // what a longer plan, or a shot that runs on, adds to it

// ── The shot on the machine ────────────────────────────────────────────────────────────────
// Tracked for as long as this module is loaded, so the chart can come and go (Simple mounts it
// with the shot) and still draw the whole shot. Times are the browser's clock, in ms.
let shot = null; // { start, end, phases: [{ at, name }] }

// Kept for callers of the earlier chart: forgets the shot, and the chart returns to the strip.
export const clearPhaseTransitions = () => {
  shot = null;
};

function trackShot(status) {
  const process = status.process;
  // A flush is a brew process too, but not a shot.
  const brewing = process && !process.u && (process.s === 'brew' || process.s === 'infusion');
  if (!brewing || !status.timestamp) {
    shot = null;
    return;
  }
  if (!process.a) {
    // Finished: the shot keeps its place until the process is cleared.
    if (shot && shot.end == null) shot.end = shot.start + (process.e || 0);
    return;
  }
  const now = status.timestamp.getTime();
  const elapsed = process.e || 0;
  if (!shot || shot.end != null || now - elapsed - shot.start > 2000) {
    shot = { start: now - elapsed, end: null, phases: [] };
  }
  if (process.l && shot.phases[shot.phases.length - 1]?.name !== process.l) {
    // The first phase starts with the shot. Met in the middle, its start is unknown: no line.
    const at = shot.phases.length ? (now - shot.start) / 1000 : elapsed < 2000 ? 0 : null;
    shot.phases.push({ at, name: process.l });
  }
}

effect(() => trackShot(machine.value.status));

// ── One chart ──────────────────────────────────────────────────────────────────────────────

const LINES = [
  { name: 'Pressure', series: 'pressure', axis: 'y1', field: 'currentPressure' },
  { name: 'Flow', series: 'flow', axis: 'y1', field: 'currentFlow' },
  { name: 'Temp', series: 'temperature', axis: 'y', field: 'currentTemperature' },
  { name: 'Weight', series: 'weight', axis: 'y2', field: 'currentWeight' },
  { series: 'pressure', axis: 'y1', field: 'targetPressure', kind: 'target' },
  { series: 'temperature', axis: 'y', field: 'targetTemperature', kind: 'target' },
  { series: 'weight', axis: 'y2', field: 'activeTargetWeight', kind: 'target' },
];

const hasWeight = status => !!(status.volumetricAvailable && status.brewTarget);

const shotTick = (value, index) => (index ? value : `${value} s`);

// One formatter per clock: the locale's own, 12-hour and 24-hour.
const clocks = {};
function clockFor(hour12) {
  const key = hour12 == null ? 'locale' : hour12 ? 'h12' : 'h23';
  clocks[key] ??= new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
    ...(hour12 == null ? {} : { hourCycle: key }),
  });
  return clocks[key];
}
// 9:41 on the minute and :15 between, so the strip reads like a clock. `hour12` is the machine's
// clock setting: false reads 21:41, true 9:41, and left out the browser's locale decides.
function clockTick(ms, hour12) {
  const date = new Date(ms);
  if (date.getSeconds()) return `:${String(date.getSeconds()).padStart(2, '0')}`;
  const parts = clockFor(hour12).formatToParts(date);
  const part = type => parts.find(p => p.type === type)?.value;
  return `${part('hour')}:${part('minute')}`;
}

function createLiveChart(withWeight, clockSetting) {
  // `points` are the arrays the chart draws; a reading is pushed onto each and nothing else changes.
  const tracks = LINES.filter(track => withWeight || track.series !== 'weight').map(track => ({
    ...track,
    points: [],
  }));
  const config = {
    type: 'line',
    data: {
      datasets: tracks.map(({ series, name, points, kind, axis }) =>
        line(series, name, points, { kind, yAxisID: axis }),
      ),
    },
    options: chartOptions({
      scales: {
        x: secondsAxis(0, SHOT, shotTick),
        y: valueAxis(niceAxis(80, 100), { format: value => `${Math.round(value)}°` }),
        y1: valueAxis(niceAxis(0, 12), {
          position: 'right',
          grid: false,
          format: value => Math.round(value * 10) / 10,
        }),
        y2: valueAxis(niceAxis(0, 60), { hidden: true }),
      },
    }),
  };

  // What is on the chart now: which shot or the strip, its clock, and how far it has been read.
  const view = { key: null, origin: 0, read: 0, start: 0, phases: -1 };

  const extent = axis => {
    let low = Infinity;
    let high = -Infinity;
    for (const track of tracks) {
      if (track.axis !== axis) continue;
      for (const { y } of track.points) {
        if (y === null) continue;
        if (y < low) low = y;
        if (y > high) high = y;
      }
    }
    return [low, high];
  };

  /**
   * Brings the lines, the axes and the phase marks up to date with the machine, in the config the
   * chart reads. Returns whether anything changed, so the caller knows to draw: 'marks' when the
   * phase marks are new and still need their colors.
   */
  function sync({ status, history }) {
    trackShot(status);
    const latest = history[history.length - 1];
    if (!latest) return false;

    const key = shot ? shot.start : 'strip';
    const fresh = key !== view.key;
    if (fresh) {
      // A minute on the clock, so the strip's ticks fall on :00, :15, :30 and :45.
      const origin = shot ? shot.start : Math.floor(latest.timestamp / 60000) * 60000;
      Object.assign(view, { key, origin, read: 0, start: -Infinity, phases: -1 });
      for (const track of tracks) track.points.length = 0;
    }
    const seconds = timestamp => (timestamp - view.origin) / 1000;

    // The strip moves on when the newest reading has passed its right edge.
    let moved = false;
    if (!shot) {
      const start = Math.ceil((seconds(latest.timestamp) - STRIP) / STRIP_STEP) * STRIP_STEP;
      moved = start > view.start;
      if (moved) {
        view.start = start;
        for (const { points } of tracks) {
          // One reading before the edge stays, so the lines still reach it.
          let gone = 0;
          while (gone < points.length - 1 && points[gone + 1].x <= start) gone++;
          if (gone) points.splice(0, gone);
        }
      }
    }

    // Append what has arrived since the last reading drawn.
    const from = shot ? -0.25 : view.start - STRIP_STEP;
    const until = shot?.end != null ? shot.end + 250 : Infinity;
    let next = history.length;
    while (next > 0 && history[next - 1].timestamp > view.read) next--;
    let added = 0;
    for (; next < history.length; next++) {
      const entry = history[next];
      const x = seconds(entry.timestamp);
      if (x < from || entry.timestamp > until) continue;
      for (const track of tracks) {
        const y = entry[track.field] || 0;
        // A target of zero is no target: its line breaks there.
        track.points.push({ x, y: track.kind === 'target' && y <= 0 ? null : y });
      }
      added++;
    }
    view.read = latest.timestamp.getTime();

    const phases = shot ? shot.phases.length : 0;
    if (!added && !moved && !fresh && phases === view.phases) return false;

    // Chart.js swaps in its own merged `scales` when it builds and updates, so read them here.
    const { scales, plugins } = config.options;

    if (shot) {
      // From 0 s for as long as the profile plans, and longer in steps if the shot runs on. The
      // last second past a step only stretches the axis to the reading itself.
      const drawn = tracks[0].points;
      const reached = drawn.length ? drawn[drawn.length - 1].x : 0;
      const planned = Math.ceil((status.brewTargetDuration || 0) / SHOT_STEP) * SHOT_STEP;
      const steps = Math.ceil((reached - 1) / SHOT_STEP) * SHOT_STEP;
      const end = Math.max(SHOT, planned, steps);
      Object.assign(scales.x, { min: 0, max: Math.max(end, reached) });
      scales.x.ticks.stepSize = secondsStep(end);
      scales.x.ticks.callback = shotTick;
    } else {
      Object.assign(scales.x, { min: view.start, max: view.start + STRIP });
      scales.x.ticks.stepSize = STRIP_STEP;
      scales.x.ticks.callback = value =>
        clockTick(view.origin + value * 1000, clockSetting.current);
    }

    // The value axes hold everything on the chart, so they only change when a reading leaves them.
    const [coolest, hottest] = extent('y');
    if (coolest <= hottest)
      Object.assign(scales.y, niceAxis(Math.max(0, coolest - 2), hottest + 2));
    Object.assign(scales.y1, niceAxis(0, Math.max(12, extent('y1')[1])));
    if (scales.y2) Object.assign(scales.y2, niceAxis(0, Math.max(10, extent('y2')[1])));

    if (phases !== view.phases) {
      view.phases = phases;
      const marks = {};
      shot?.phases.forEach((phase, i) => {
        if (phase.at != null) marks[`phase${i}`] = phaseLine(phase.at, phase.name);
      });
      plugins.annotation.annotations = marks;
      return 'marks';
    }
    return true;
  }

  return { config, sync };
}

/**
 * The live chart of the machine's readings.
 *   hour12  the clock of the strip's ticks between shots: false for 24-hour, true for 12-hour;
 *           left out, the browser's locale decides
 */
export function OverviewChart({ hour12 }) {
  const [withWeight, setWithWeight] = useState(() => hasWeight(machine.peek().status));
  // Read by the tick callback each time it draws, so a changed setting needs no new chart.
  const clockSetting = useRef(hour12);
  clockSetting.current = hour12;
  const live = useMemo(() => {
    const created = createLiveChart(withWeight, clockSetting);
    created.sync(machine.peek());
    return created;
  }, [withWeight]);
  const chart = useRef(null);

  useEffect(() => {
    chart.current?.update('none');
  }, [hour12]);

  // Readings reach the chart here, without rendering this component again.
  useEffect(
    () =>
      effect(() => {
        const state = machine.value;
        const weight = hasWeight(state.status);
        if (weight !== withWeight) setWithWeight(weight);
        else {
          const changed = live.sync(state);
          if (!changed || !chart.current) return;
          if (changed === 'marks') applyChartTheme(live.config, chart.current.canvas);
          chart.current.update('none');
        }
      }),
    [live, withWeight],
  );

  return (
    <ChartComponent
      className='h-full min-h-0 w-full flex-1'
      chartClassName='h-full w-full'
      data={live.config}
      chartRef={chart}
      label='Live readings'
    />
  );
}
