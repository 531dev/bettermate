import { Icon } from '../../../components/Icon.jsx';
import { useContext, useEffect, useState } from 'preact/hooks';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import PropTypes from 'prop-types';
import { ProcessProfileChart } from '../../../components/ProcessProfileChart.jsx';
import { profileChartHeightSignal } from '../../../utils/dashboardManager.js';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
import { fmtElapsed, fmtPhaseTarget, getPhaseLabel } from '../utils.js';
import { useFinishedStats } from '../useFinishedStats.js';

function ProgressCard({ processInfo, isBrewing, isGrinding, selectedProfile }) {
  const p = processInfo;
  const progress = Math.max(0, Math.min(100, ((p?.pp ?? 0) / (p?.pt || 1)) * 100));
  const phase = getPhaseLabel(p, isGrinding);
  const target = fmtPhaseTarget(p, isGrinding);

  return (
    <div className='card bg-primary/10 border-primary/30 flex flex-col gap-1 rounded-xl border p-3'>
      <div className='text-primary text-[0.65rem] font-semibold tracking-wider uppercase'>
        {isBrewing ? 'Now Brewing' : 'Grinding'} · {selectedProfile || 'Default'}
      </div>
      <div className='flex items-baseline justify-between'>
        <div className='flex flex-col gap-0.5'>
          <span className='bg-primary/20 text-primary rounded px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wider uppercase'>
            {phase}
          </span>
          <span className='text-base-content font-mono text-2xl font-bold tabular-nums'>
            {fmtElapsed(p?.e)}
          </span>
        </div>
        {target && (
          <div className='text-right'>
            <div className='text-[0.6rem] tracking-wider text-[var(--ink-muted)] uppercase'>
              Target
            </div>
            <div className='text-base-content font-mono text-lg font-bold tabular-nums'>
              {target}
            </div>
          </div>
        )}
      </div>
      <div className='bg-base-content/10 h-1.5 w-full overflow-hidden rounded-full'>
        <div
          className='bg-primary h-full rounded-full transition-all duration-300 ease-out'
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

ProgressCard.propTypes = {
  processInfo: PropTypes.object,
  isBrewing: PropTypes.bool.isRequired,
  isGrinding: PropTypes.bool.isRequired,
  selectedProfile: PropTypes.string,
};

function FinishedProcessCard({ processInfo, isBrewing, selectedProfile, stats, weight }) {
  const p = processInfo;
  const weightLabel = weight != null && weight > 0 ? `${weight.toFixed(1)}g` : null;
  const pressureLabel =
    isBrewing && stats?.maxPressure != null ? `${stats.maxPressure.toFixed(1)} bar` : null;
  const flowLabel = isBrewing && stats?.avgFlow != null ? `${stats.avgFlow.toFixed(2)} ml/s` : null;
  const items = [
    weightLabel && { key: 'weight', label: 'Weight', value: weightLabel },
    pressureLabel && { key: 'pressure', label: 'Pressure', value: pressureLabel },
    flowLabel && { key: 'flow', label: 'Flow', value: flowLabel },
  ].filter(Boolean);

  return (
    <div className='card bg-success/10 border-success/30 flex flex-col gap-1 rounded-xl border p-3'>
      <div className='flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-wider text-[var(--success)] uppercase'>
        <Icon name={'check'} />
        Finished · {selectedProfile || 'Default'}
      </div>
      <span className='text-base-content text-center font-mono text-2xl font-bold tabular-nums'>
        {fmtElapsed(p?.e)}
      </span>
      {items.length > 0 && (
        <div className='mt-1 flex gap-3'>
          {items.map(item => (
            <div key={item.key} className='flex-1 text-center'>
              <div className='text-base-content font-mono text-sm font-bold tabular-nums'>
                {item.value}
              </div>
              <div className='text-[0.6rem] font-semibold tracking-wider text-[var(--ink-muted)] uppercase'>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

FinishedProcessCard.propTypes = {
  processInfo: PropTypes.object,
  isBrewing: PropTypes.bool.isRequired,
  selectedProfile: PropTypes.string,
  stats: PropTypes.shape({
    maxPressure: PropTypes.number,
    avgFlow: PropTypes.number,
  }),
  weight: PropTypes.number,
};

export function ProfileCard({
  selectedProfile,
  selectedProfileId,
  processInfo,
  isActive,
  isFinished,
  isBrewing,
  isGrinding,
  inCard = false,
  compact = false,
}) {
  const apiService = useContext(ApiServiceContext);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const finishedStats = useFinishedStats({ isActive, isFinished, isBrewing });

  useEffect(() => {
    if (!selectedProfileId || !apiService) {
      setProfileData(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    apiService
      .request({ tp: 'req:profiles:load', id: selectedProfileId })
      .then(res => {
        if (cancelled) return;
        setProfileData(res.profile);
        setProfileLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setProfileData(null);
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId, apiService]); // eslint-disable-line react-hooks/exhaustive-deps

  const showProgress = (isBrewing || isGrinding) && (isActive || isFinished);

  if (showProgress) {
    if (isFinished) {
      return (
        <FinishedProcessCard
          processInfo={processInfo}
          isBrewing={isBrewing}
          selectedProfile={selectedProfile}
          stats={finishedStats}
          weight={machine.value.status?.currentWeight}
        />
      );
    }
    return (
      <ProgressCard
        processInfo={processInfo}
        isBrewing={isBrewing}
        isGrinding={isGrinding}
        selectedProfile={selectedProfile}
      />
    );
  }

  const inner = (
    <>
      <div className='text-[0.6rem] tracking-wider text-[var(--ink-muted)] uppercase'>Profile</div>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-base-content truncate text-sm font-semibold'>
          {selectedProfile || 'Default'}
        </span>
        <a href='/profiles'>
          <Icon name={'list'} className='shrink-0 text-sm text-[var(--ink-muted)]' />
        </a>
      </div>
      {!compact &&
        (profileLoading || (!!selectedProfileId && !profileData) ? (
          <SkeletonBlock
            className='mt-1 w-full rounded-xl'
            style={{ height: `${profileChartHeightSignal.value}px` }}
          />
        ) : profileData ? (
          <ProcessProfileChart
            data={profileData}
            processInfo={processInfo}
            className='mt-1 w-full'
            style={{ height: `${profileChartHeightSignal.value}px` }}
          />
        ) : null)}
    </>
  );

  if (inCard) {
    return <div className='flex h-full flex-col gap-1'>{inner}</div>;
  }

  return <div className='card bg-base-100 flex h-full flex-col gap-1 rounded-xl p-3'>{inner}</div>;
}

ProfileCard.propTypes = {
  selectedProfile: PropTypes.string,
  selectedProfileId: PropTypes.string,
  processInfo: PropTypes.object,
  isActive: PropTypes.bool.isRequired,
  isFinished: PropTypes.bool.isRequired,
  isBrewing: PropTypes.bool.isRequired,
  isGrinding: PropTypes.bool.isRequired,
  inCard: PropTypes.bool,
  compact: PropTypes.bool,
};
