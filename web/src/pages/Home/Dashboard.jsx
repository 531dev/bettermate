import { Fragment } from 'preact';
import { useLocation } from 'preact-iso';
import { ActionBanner } from '../../components/ActionBanner.jsx';
import { shownWarnings } from '../../components/AppBar.jsx';
import { Button } from '../../components/Button.jsx';
import { cx } from '../../components/cx.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import { ProcessProfileChart } from '../../components/ProcessProfileChart.jsx';
import { SkeletonBlock } from '../../components/SkeletonBlock.jsx';
import { StatTile } from '../../components/StatTile.jsx';
import { Tile } from '../../components/Tile.jsx';
import {
  DASHBOARD_LAYOUTS,
  dashboardLayoutSignal,
  metricOrderSignal,
  panelOrderSignal,
  profileChartHeightSignal,
  showRecentShotsSignal,
} from '../../utils/dashboardManager.js';
import { metricById } from '../../utils/metricDefinitions.js';
import { PANEL_DEFINITIONS, panelIds } from '../../utils/panelDefinitions.js';
import { pendingCommand } from '../../utils/commands.js';
import { activeWarnings } from '../../utils/warnings.js';
import { BrewConfirm } from './BrewConfirm.jsx';
import { CHART, CURVE, place } from './layout.js';
import { describeMachine } from './machineView.js';
import { pickReadings } from './readings.js';
import { DialTile } from './tiles/DialTile.jsx';
import { RecentShots } from './tiles/RecentShots.jsx';
import { hasSetup, SetupTile } from './tiles/SetupTile.jsx';
import { useDashboardState } from './useDashboardState.js';
import { useFinishedStats } from './useFinishedStats.js';
import { useRecentShots } from './useRecentShots.js';
import { useShotPlan, useShotStages } from './useShotPlan.js';
import { nextWakeLabel } from './wakeSchedule.js';
import './reading.css';

// Below the desktop placement (layout.js, 75rem) every tile is a full row of the grid: both of
// its 2 columns from 600px, all 12 from 1024px. Readings go two to a row, and an odd last one
// takes a whole row; on the desktop grid of Simple and Advanced each is placed by itself.
const ROW = 'sm:max-lg:col-span-2';
const ROW_BELOW_DESKTOP = 'sm:max-lg:col-span-2 lg:max-[75rem]:col-span-12';
const PAIRS = 'grid grid-cols-2 gap-2';
const ODD_LAST = '[&>:last-child:nth-child(odd)]:col-span-2';
const ODD_LAST_BELOW_DESKTOP = 'max-[75rem]:[&>:last-child:nth-child(odd)]:col-span-2';

// The warnings worth naming on the dashboard: what the top bar's glyph stands for, plus the
// temperature reminder between shots, when the Chip beside it does not already say the boiler is
// off its target. Grinding does not use the boiler.
function listedWarnings(ds, view) {
  const keys = new Set(shownWarnings(ds).map(w => w.key));
  const resting = ds.hasReading && !ds.isActive && !ds.isFlushing;
  if (resting && ds.mode !== 0 && ds.mode !== 4 && view.chip?.tone !== 'heat') {
    keys.add('temperature');
  }
  return activeWarnings(ds.warnings).filter(w => keys.has(w.key));
}

/**
 * Which readings of a two-column group take a whole row: an empty tile, and the reading left
 * alone before it.
 */
function fullRows(stats) {
  const readings = stats.filter(stat => !stat.empty).length;
  return stats.map((stat, i) => !!stat.empty || (readings % 2 === 1 && i === readings - 1));
}

function Reading({ stat, className }) {
  if (stat.empty === 'scale') {
    return (
      <Tile title={stat.label} className={cx('home-reading', className)}>
        <EmptyState
          icon='scale'
          title='No scale connected'
          action={<Button href='/settings/bluetooth'>Pair a scale</Button>}
        >
          With a scale, shots stop at their target weight.
        </EmptyState>
      </Tile>
    );
  }
  return (
    <StatTile
      label={stat.label}
      value={stat.value}
      unit={stat.unit}
      target={stat.target}
      bar={stat.bar}
      className={cx('home-reading', className)}
    >
      {stat.note && <span className='bm-data'>{stat.note}</span>}
    </StatTile>
  );
}

function ChartTile({ title, className, tall, hour12 }) {
  return (
    <Tile aria-label='Live chart' title={title} className={className}>
      <div
        className={cx('flex h-64 min-h-0 flex-col', tall ? 'lg:h-[min(60dvh,520px)]' : 'lg:h-72')}
      >
        <OverviewChart hour12={hour12} />
      </div>
    </Tile>
  );
}

function CurveTile({ profile, processInfo, className }) {
  const style = { height: `${profileChartHeightSignal.value}px` };
  return (
    <Tile aria-label='Profile curve' title='Profile curve' className={className}>
      {profile ? (
        <ProcessProfileChart
          data={profile}
          processInfo={processInfo}
          className='w-full'
          style={style}
        />
      ) : (
        // The chart's own shape, legend row and plot, so the tile does not jump when it arrives.
        <div className='flex flex-col gap-3'>
          <SkeletonBlock className='h-6 w-40' />
          <SkeletonBlock className='w-full' style={style} />
        </div>
      )}
    </Tile>
  );
}

/**
 * The dashboard, in one of its three views:
 *   simple    the Dial tile, the ActionBanner, the readings that matter now, Setup, recent shots,
 *             and the chart only during a shot and after it
 *   advanced  the same tiles plus every reading with its target, the chart between shots and the
 *             curve of a profile that sets a pressure or a flow
 *   custom    the tiles and readings chosen in Dashboard Settings, in that order, beside the chart
 */
export function Dashboard({ view: mode }) {
  const { route } = useLocation();
  const custom = mode === 'custom';
  const advanced = mode === 'advanced';
  const ds = useDashboardState();
  const finishedStats = useFinishedStats(ds);
  const shot = useShotPlan(ds);
  const stages = useShotStages(shot.phases, ds);
  const recent = useRecentShots(!custom || showRecentShotsSignal.value);

  // The web reads the 24-hour clock everywhere (design, Content); the machine's clock setting is
  // the round display's.
  const hour12 = false;

  const view = describeMachine(ds, {
    shot,
    nextWake: nextWakeLabel(ds.settings, hour12),
    openGrinderSettings: () => route('/settings/plugins'),
  });
  const warnings = listedWarnings(ds, view);
  const stats = pickReadings(ds, {
    view: mode,
    chosen: metricOrderSignal.value,
    finishedStats,
    recent,
  });
  const full = fullRows(stats);

  const brewing = ds.isBrewing && !ds.processInfo?.u && (ds.isActive || ds.isFinished);
  // Nothing moves between shots, so Simple only charts a shot and its result.
  const showChart = custom || advanced || brewing;
  const chartTitle = brewing ? 'This shot' : 'Last minute';
  // The curve tile holds its place while the profile loads, and leaves when the profile turns
  // out to have no curve: an empty chart would say nothing.
  const showCurve = !shot.profile || shot.hasCurve;
  // While a start or stop waits for the machine, the banner says so and takes no second press.
  const pending = pendingCommand.value;
  const action =
    view.action &&
    (pending
      ? { ...view.action, label: pending.label, busy: true, 'aria-label': pending.label }
      : { ...view.action, 'aria-label': view.action.label });

  if (custom) {
    const panels = {
      mode: <DialTile ds={ds} view={view} warnings={warnings} stages={stages} />,
      action: action && <ActionBanner {...action} />,
      metrics: stats.length > 0 && (
        <div role='group' aria-label='Readings' className={cx(PAIRS, ODD_LAST, 'lg:gap-3')}>
          {stats.map((stat, i) => (
            <Reading key={stat.id} stat={stat} className={full[i] && 'col-span-2'} />
          ))}
        </div>
      ),
      favorites: <SetupTile ds={ds} />,
      profile: showCurve && <CurveTile profile={shot.profile} processInfo={ds.processInfo} />,
      watertank: (
        <Reading
          stat={{ id: 'watertank', label: 'Water tank', ...metricById('waterlevel').stat(ds) }}
        />
      ),
    };
    const order = panelIds(panelOrderSignal.value).filter(id =>
      PANEL_DEFINITIONS.find(panel => panel.id === id).available(ds),
    );
    const chart = (
      <ChartTile
        tall
        title={chartTitle}
        hour12={hour12}
        // Beside the controls the chart stays in sight while they scroll.
        className={cx(ROW, 'lg:sticky lg:top-3 lg:col-span-7 lg:self-start')}
      />
    );
    const chartFirst = dashboardLayoutSignal.value === DASHBOARD_LAYOUTS.ORDER_LAST;
    return (
      <>
        <h1 className='sr-only'>Dashboard</h1>
        <BrewConfirm />
        <div className='bm-grid'>
          {chartFirst && chart}
          <div className={cx(ROW, 'flex min-w-0 flex-col gap-2 lg:col-span-5 lg:gap-3')}>
            {order.map(id => (
              <Fragment key={id}>{panels[id]}</Fragment>
            ))}
          </div>
          {!chartFirst && chart}
          {showRecentShotsSignal.value && (
            <RecentShots
              recent={recent}
              settings={ds.settings}
              hour12={hour12}
              className={cx(ROW, 'lg:col-span-12')}
            />
          )}
        </div>
      </>
    );
  }

  const at = place({
    hasAction: !!action,
    hasSetup: hasSetup(ds),
    stats: stats.length,
    hasChart: showChart,
    emptyLast: !!stats.at(-1)?.empty,
  });
  return (
    <>
      <h1 className='sr-only'>Dashboard</h1>
      <BrewConfirm />
      <div className='bm-grid'>
        <DialTile
          ds={ds}
          view={view}
          warnings={warnings}
          stages={stages}
          className={cx(ROW_BELOW_DESKTOP, at.dial)}
        />
        {action && (
          <ActionBanner {...action} stretch className={cx(ROW_BELOW_DESKTOP, at.action)} />
        )}
        {stats.length > 0 && (
          // On the desktop grid each reading is a tile of the grid itself.
          <div
            role='group'
            aria-label='Readings'
            className={cx(
              PAIRS,
              ODD_LAST_BELOW_DESKTOP,
              ROW_BELOW_DESKTOP,
              'lg:gap-3 min-[75rem]:contents',
            )}
          >
            {stats.map((stat, i) => (
              <Reading
                key={stat.id}
                stat={stat}
                className={cx(at.stats[i], full[i] && 'max-[75rem]:col-span-2')}
              />
            ))}
          </div>
        )}
        <SetupTile ds={ds} className={cx(ROW_BELOW_DESKTOP, at.setup)} />
        {advanced && ds.mode === 1 && showCurve && (
          <CurveTile
            profile={shot.profile}
            processInfo={ds.processInfo}
            className={cx(ROW_BELOW_DESKTOP, CURVE)}
          />
        )}
        {showChart && (
          <ChartTile title={chartTitle} hour12={hour12} className={cx(ROW_BELOW_DESKTOP, CHART)} />
        )}
        <RecentShots
          recent={recent}
          // Simple keeps the list to the last three.
          max={advanced ? undefined : 3}
          settings={ds.settings}
          hour12={hour12}
          className={cx(ROW_BELOW_DESKTOP, at.recent)}
        />
      </div>
    </>
  );
}
