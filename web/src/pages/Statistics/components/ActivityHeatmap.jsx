// GitHub-style activity heatmap: rolling 12-month view of daily shot counts with streak tracking
import { useState, useMemo, useRef, useEffect } from 'preact/hooks';
import { getDayStartLocalMs, getIsoWeekStartLocalMs, formatDateLocal } from '../utils/trendBuckets';
import { Tile } from '../../../components/Tile.jsx';
import '../statistics.css';

const DAY_LABELS = [
  { dow: 0, label: 'M' },
  { dow: 2, label: 'W' },
  { dow: 4, label: 'F' },
];
const MS_PER_DAY = 86400000;

const TOOLTIP_DATE_OPTIONS = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
const MONTH_LABEL_OPTIONS = { month: 'short', year: '2-digit' };

// One mark a day. The level steps through the ink tokens: none, 1, 2, 3, 4 or more shots.
// A day that has not come yet draws nothing.
const FUTURE_FILL = 'fill-none';
const LEVEL_FILLS = [
  'fill-(--track)',
  'fill-(--line-strong)',
  'fill-(--ink-faint)',
  'fill-(--ink-muted)',
  'fill-(--ink)',
];
const LEVEL_GROUNDS = [
  'bg-(--track)',
  'bg-(--line-strong)',
  'bg-(--ink-faint)',
  'bg-(--ink-muted)',
  'bg-(--ink)',
];

const getLevel = count => Math.min(Math.max(0, count), LEVEL_FILLS.length - 1);

function HeatmapFact({ label, children }) {
  return (
    <span className='bm-data'>
      {label} <span className='text-(--ink)'>{children}</span>
    </span>
  );
}

function computeStreaks(dayMap, startMs, todayMs) {
  const totalDaysToToday = Math.round((todayMs - startMs) / MS_PER_DAY) + 1;
  let longest = 0;
  let streak = 0;

  const cursor = new Date(startMs);
  for (let i = 0; i < totalDaysToToday; i++) {
    if ((dayMap.get(cursor.getTime()) || 0) > 0) {
      streak++;
      if (streak > longest) longest = streak;
    } else {
      streak = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Current streak: count back from today until the first gap.
  let current = 0;
  const back = new Date(todayMs);
  if ((dayMap.get(back.getTime()) || 0) === 0) {
    back.setDate(back.getDate() - 1);
  }
  for (let i = 0; i < totalDaysToToday; i++) {
    if ((dayMap.get(back.getTime()) || 0) > 0) {
      current++;
    } else {
      break;
    }
    back.setDate(back.getDate() - 1);
  }

  return { longest, current };
}

function buildHeatmapData(trends) {
  const dayMap = new Map();
  let earliestAllTime = Infinity;
  for (const entry of trends) {
    if (!entry.timestamp) continue;
    const dayMs = getDayStartLocalMs(entry.timestamp);
    if (dayMs == null) continue;
    dayMap.set(dayMs, (dayMap.get(dayMs) || 0) + 1);
    if (dayMs < earliestAllTime) earliestAllTime = dayMs;
  }

  if (dayMap.size === 0) return null;

  const todayMs = getDayStartLocalMs(Date.now());

  const endDate = new Date(todayMs);
  const endDow = (endDate.getDay() + 6) % 7;
  endDate.setDate(endDate.getDate() + (6 - endDow)); // forward to Sunday of current week
  const endMs = endDate.getTime();

  // GitHub-style rolling window: one year back, Monday-aligned via shared utility.
  const startDate = new Date(todayMs);
  startDate.setFullYear(startDate.getFullYear() - 1);
  const startMs = getIsoWeekStartLocalMs(startDate.getTime());

  const totalDays = Math.round((endMs - startMs) / MS_PER_DAY) + 1;
  const weeks = Math.ceil(totalDays / 7);

  let totalShots = 0;
  let daysWithShots = 0;
  let earliestShot = null;

  const cells = [];
  const cursor = new Date(startMs);
  for (let i = 0; i < totalDays; i++) {
    const dayMs = cursor.getTime();
    const count = dayMap.get(dayMs) || 0;
    cells.push({ dayMs, count, week: Math.floor(i / 7), dow: i % 7 });
    if (dayMs <= todayMs && count > 0) {
      totalShots += count;
      daysWithShots++;
      if (earliestShot == null) earliestShot = dayMs;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const monthLabels = [];
  let lastMonth = -1;
  const weekCursor = new Date(startMs);
  for (let w = 0; w < weeks; w++) {
    const month = weekCursor.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        week: w,
        label: formatDateLocal(weekCursor.getTime(), MONTH_LABEL_OPTIONS),
      });
      lastMonth = month;
    }
    weekCursor.setDate(weekCursor.getDate() + 7);
  }

  const daysFromFirst =
    earliestShot != null ? Math.round((todayMs - earliestShot) / MS_PER_DAY) + 1 : 0;
  const dailyAvg = daysFromFirst > 0 ? totalShots / daysFromFirst : 0;

  // Streaks deliberately run over the full history, not just visible year.
  const streaks = computeStreaks(dayMap, earliestAllTime, todayMs);
  return {
    cells,
    monthLabels,
    weeks,
    todayMs,
    stats: {
      totalShots,
      daysWithShots,
      dailyAvg,
      longestStreak: streaks.longest,
      currentStreak: streaks.current,
    },
  };
}

export function ActivityHeatmap({ trends }) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const data = useMemo(() => buildHeatmapData(trends || []), [trends]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!tooltip) return;
    const dismiss = () => setTooltip(null);
    const onPointerDown = e => {
      if (!containerRef.current?.contains(e.target)) setTooltip(null);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [!!tooltip]);

  if (!data || data.stats.totalShots === 0) return null;

  const { weeks } = data;
  const labelWidth = 20;
  const availableWidth = containerWidth > 0 ? containerWidth - labelWidth : 0;
  const cellGap = 2;
  const cellSize =
    availableWidth > 0 ? Math.max(8, Math.floor(availableWidth / weeks - cellGap)) : 11;
  const step = cellSize + cellGap;
  const topPadding = 16;
  const svgWidth = labelWidth + weeks * step;
  const svgHeight = topPadding + 7 * step;

  return (
    <Tile eyebrow='Activity' data-statistics-heatmap>
      <div ref={containerRef} className='an-scroll overflow-x-auto'>
        <svg
          width={svgWidth}
          height={svgHeight + 4}
          className='block fill-none'
          style={{ minWidth: svgWidth }}
          role='img'
          aria-label={`Shots per day over the last year: ${data.stats.totalShots} shots on ${data.stats.daysWithShots} days`}
        >
          {data.monthLabels.map((m, i) => (
            <text
              key={i}
              x={labelWidth + m.week * step}
              y={10}
              className='bm-tick fill-(--ink-muted)'
            >
              {m.label}
            </text>
          ))}

          {DAY_LABELS.map(({ dow, label }) => (
            <text
              key={dow}
              x={0}
              y={topPadding + dow * step + cellSize - 1}
              className='bm-tick fill-(--ink-muted)'
            >
              {label}
            </text>
          ))}

          {data.cells.map((cell, i) => {
            const x = labelWidth + cell.week * step;
            const y = topPadding + cell.dow * step;
            const isFuture = cell.dayMs > data.todayMs;
            const makeTooltip = e => ({
              cell,
              x: e.clientX,
              y: e.clientY,
              onLeft: e.clientX > window.innerWidth / 2,
            });
            const handleHover = e => {
              if (isFuture || e.pointerType !== 'mouse') return;
              setTooltip(makeTooltip(e));
            };

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                data-shots={isFuture ? undefined : cell.count}
                className={isFuture ? FUTURE_FILL : LEVEL_FILLS[getLevel(cell.count)]}
                onPointerEnter={handleHover}
                onPointerMove={handleHover}
                onPointerLeave={e => {
                  if (e.pointerType !== 'mouse') return;
                  setTooltip(null);
                }}
                onPointerUp={e => {
                  // Touch/pen have no hover: tap to show, tap the same cell again to hide.
                  if (isFuture || e.pointerType === 'mouse') return;
                  setTooltip(prev =>
                    prev && prev.cell.dayMs === cell.dayMs ? null : makeTooltip(e),
                  );
                }}
              />
            );
          })}
        </svg>
      </div>

      <div className='flex flex-wrap items-center gap-x-5 gap-y-1'>
        <HeatmapFact label='Daily average'>{data.stats.dailyAvg.toFixed(1)} shots</HeatmapFact>
        <HeatmapFact label='Days active'>{data.stats.daysWithShots}</HeatmapFact>
        <HeatmapFact label='Longest streak'>
          {data.stats.longestStreak} {data.stats.longestStreak === 1 ? 'day' : 'days'}
        </HeatmapFact>
        <HeatmapFact label='Current streak'>
          {data.stats.currentStreak} {data.stats.currentStreak === 1 ? 'day' : 'days'}
        </HeatmapFact>
        <span className='bm-tick ml-auto flex items-center gap-1' aria-hidden='true'>
          0
          {LEVEL_GROUNDS.map(ground => (
            <i key={ground} className={`st-heat__swatch ${ground}`} />
          ))}
          4+
        </span>
      </div>

      {tooltip && (
        <div
          className='st-tip'
          role='status'
          style={{
            ...(tooltip.onLeft
              ? { right: window.innerWidth - tooltip.x + 12 }
              : { left: tooltip.x + 12 }),
            top: tooltip.y > 56 ? tooltip.y - 48 : tooltip.y + 16,
          }}
        >
          <span className='an-data'>
            {tooltip.cell.count} {tooltip.cell.count === 1 ? 'shot' : 'shots'}
          </span>
          <span className='bm-caption'>
            {formatDateLocal(tooltip.cell.dayMs, TOOLTIP_DATE_OPTIONS)}
          </span>
        </div>
      )}
    </Tile>
  );
}
