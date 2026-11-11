import PropTypes from 'prop-types';
import { OverviewChart } from '../../../components/OverviewChart.jsx';
import { clock24hSignal } from '../../../utils/dashboardManager.js';
import { activeWarnings } from '../../../utils/warnings.js';
import { BrewConfirmHost } from '../BrewConfirmHost.jsx';
import { FlushButton } from '../FlushButton.jsx';
import { RecentShotsCard } from '../cards/RecentShotsCard.jsx';
import { useDashboardState } from '../useDashboardState.js';
import { useFinishedStats } from '../useFinishedStats.js';
import { MachineCard } from './MachineCard.jsx';
import { PrimaryAction } from './PrimaryAction.jsx';
import { ShotSetup } from './ShotSetup.jsx';
import { StatGrid } from './StatGrid.jsx';
import { WakeScheduleCard } from './WakeScheduleCard.jsx';
import { describeMachine } from './machineView.js';
import { useShotPlan } from './useShotPlan.js';
import { nextWakeLabel } from './wakeSchedule.js';

function visibleWarnings(ds, view) {
  if (ds.mode === 0) return [];
  return activeWarnings(ds.warnings).filter(w => {
    // Flushing is a Brew action.
    if (w.key === 'flush') return ds.isBrewing;
    // Grinding doesn't use the boiler, and a status line saying it is off target already covers this.
    if (w.key === 'temperature') return ds.mode !== 4 && view.tone !== 'heat';
    return true;
  });
}

export function MachineHome({ advanced = false }) {
  const ds = useDashboardState();
  const finishedStats = useFinishedStats(ds);
  const { plan, dose } = useShotPlan(ds);
  const nextWake = nextWakeLabel(ds.settings, !clock24hSignal.value);
  const view = describeMachine(ds, { plan, dose, nextWake });
  const warnings = visibleWarnings(ds, view);
  // Stays mounted while held, so a hold-to-flush can still see its release.
  const showFlush = ds.isBrewing && (ds.isFlushing || (!ds.isActive && !ds.isFinished));
  // Nothing moves between shots, so Simple only charts a shot and its result.
  const showChart =
    advanced || (ds.isBrewing && !ds.processInfo?.u && (ds.isActive || ds.isFinished));

  return (
    <div className='@container w-full'>
      <BrewConfirmHost />
      <div className='grid grid-cols-1 items-start gap-2 @2xl:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]'>
        <div className='flex min-w-0 flex-col gap-2 @2xl:sticky @2xl:top-0'>
          <MachineCard ds={ds} view={view} warnings={warnings}>
            {showFlush && (
              <FlushButton
                className='bm-flush'
                isFlushing={ds.isFlushing}
                startFlush={ds.startFlush}
                stopFlush={ds.stopFlush}
              />
            )}
          </MachineCard>
          {view.action && (
            <div className='flex'>
              <PrimaryAction action={view.action} />
            </div>
          )}
          <StatGrid ds={ds} advanced={advanced} />
        </div>
        <div className='flex min-w-0 flex-col gap-2'>
          <ShotSetup ds={ds} advanced={advanced} finishedStats={finishedStats} />
          {showChart && (
            <section
              aria-label='Live chart'
              className='bm-group h-[280px] @2xl:h-[min(58dvh,560px)]'
            >
              <OverviewChart />
            </section>
          )}
          <RecentShotsCard max={advanced ? undefined : 3} />
          <WakeScheduleCard />
        </div>
      </div>
    </div>
  );
}

MachineHome.propTypes = {
  advanced: PropTypes.bool,
};
