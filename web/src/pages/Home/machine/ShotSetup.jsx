import PropTypes from 'prop-types';
import { useContext, useEffect, useState } from 'preact/hooks';
import { useSignalEffect, computed } from '@preact/signals';
import { Icon } from '../../../components/Icon.jsx';
import { ProcessProfileChart } from '../../../components/ProcessProfileChart.jsx';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import { profileChartHeightSignal } from '../../../utils/dashboardManager.js';

const connected = computed(() => machine.value.connected);
const MAX_PROFILE_TILES = 3;

function ProfileTiles({ selectedProfileId, disabled = false }) {
  const apiService = useContext(ApiServiceContext);
  const [profiles, setProfiles] = useState(null);

  useSignalEffect(() => {
    if (!apiService || !connected.value) return undefined;
    let cancelled = false;
    apiService
      .request({ tp: 'req:profiles:list' })
      .then(res => {
        if (!cancelled) setProfiles(res.profiles ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  });

  const select = id => apiService.request({ tp: 'req:profiles:select', id }).catch(() => {});

  if (profiles === null) {
    return (
      <div className='flex gap-2'>
        {[0, 1, 2].map(i => (
          <SkeletonBlock key={i} className='h-14 flex-1 rounded-[18px]' />
        ))}
      </div>
    );
  }

  // Favorites first; the selected profile always has a tile, even when it isn't a favorite.
  const favorites = profiles.filter(p => p.favorite);
  const selected = profiles.find(p => p.id === selectedProfileId);
  const tiles =
    selected && !favorites.includes(selected)
      ? [selected, ...favorites].slice(0, MAX_PROFILE_TILES)
      : favorites.slice(0, MAX_PROFILE_TILES);

  return (
    <div className='flex items-stretch gap-2'>
      {tiles.map(profile => (
        <button
          key={profile.id}
          type='button'
          className='bm-tile min-h-14'
          aria-pressed={profile.id === selectedProfileId}
          disabled={disabled}
          onClick={() => select(profile.id)}
        >
          <span className='line-clamp-2 break-words'>{profile.label}</span>
        </button>
      ))}
    </div>
  );
}

ProfileTiles.propTypes = {
  selectedProfileId: PropTypes.string,
  disabled: PropTypes.bool,
};

function ProfileCurve({ selectedProfileId, processInfo, className = '' }) {
  const apiService = useContext(ApiServiceContext);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!selectedProfileId || !apiService) {
      setProfile(null);
      return undefined;
    }
    let cancelled = false;
    apiService
      .request({ tp: 'req:profiles:load', id: selectedProfileId })
      .then(res => {
        if (!cancelled) setProfile(res.profile);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId, apiService]);

  const style = { height: `${profileChartHeightSignal.value}px` };
  if (!profile) return <SkeletonBlock className={`w-full rounded-xl ${className}`} style={style} />;
  return (
    <ProcessProfileChart
      data={profile}
      processInfo={processInfo}
      className={`w-full ${className}`}
      style={style}
    />
  );
}

ProfileCurve.propTypes = {
  selectedProfileId: PropTypes.string,
  processInfo: PropTypes.object,
  className: PropTypes.string,
};

const STOP_BY = ['Time', 'Weight'];

function StopBy({ label, value, onChange }) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='bm-group__title min-w-0'>{label}</div>
      <div className='bm-choice' role='group' aria-label={label}>
        {STOP_BY.map((name, id) => (
          <button
            key={name}
            type='button'
            className='bm-choice__item'
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

StopBy.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

function Stepper({ label, targetName, value, onDecrease, onIncrease, disabled = false }) {
  const button = 'btn btn-circle btn-outline h-11 w-11 shrink-0 bg-[var(--surface-2)] p-0';
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='bm-group__title min-w-0'>{label}</div>
      <div className='flex shrink-0 items-center gap-1'>
        <button
          type='button'
          className={button}
          aria-label={`Decrease ${targetName} target`}
          disabled={disabled}
          onClick={onDecrease}
        >
          <Icon name='minus' />
        </button>
        <output className='min-w-[68px] text-center text-[22px] leading-7 font-light'>
          {value}
        </output>
        <button
          type='button'
          className={button}
          aria-label={`Increase ${targetName} target`}
          disabled={disabled}
          onClick={onIncrease}
        >
          <Icon name='plus' />
        </button>
      </div>
    </div>
  );
}

Stepper.propTypes = {
  label: PropTypes.string.isRequired,
  targetName: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onDecrease: PropTypes.func.isRequired,
  onIncrease: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

// The dial already shows the time and the yield.
function ShotResults({ stats }) {
  const results = [
    stats?.maxPressure != null && {
      label: 'Max pressure',
      value: `${stats.maxPressure.toFixed(1)} bar`,
    },
    stats?.avgFlow != null && { label: 'Average flow', value: `${stats.avgFlow.toFixed(2)} ml/s` },
  ].filter(Boolean);
  if (results.length === 0) return null;
  return (
    <section className='bm-group' aria-label='Shot result'>
      <h2 className='bm-group__title'>This shot</h2>
      <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
        {results.map(result => (
          <div key={result.label}>
            <div className='text-xs leading-4 text-[var(--ink-muted)]'>{result.label}</div>
            <div className='text-[20px] leading-7 font-light'>{result.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

ShotResults.propTypes = {
  stats: PropTypes.object,
};

// The grind target itself is set on the dial.
function GrindSetup({ ds, running }) {
  if (running || !ds.isGrindAvailable || !ds.volumetricAvailable) return null;
  return (
    <section className='bm-group' aria-label='Grind setup'>
      <StopBy label='Stop grind by' value={ds.grindTarget ? 1 : 0} onChange={ds.changeTarget} />
    </section>
  );
}

GrindSetup.propTypes = {
  ds: PropTypes.object.isRequired,
  running: PropTypes.bool.isRequired,
};

// What can change before the next shot, in one group. Everything else stays off the screen.
export function ShotSetup({ ds, advanced = false, finishedStats }) {
  const { mode, isActive, isFinished, isFlushing, selectedProfileId, processInfo } = ds;
  const running = isActive || isFlushing;
  // A flush is not a shot: it keeps the setup on screen and clears itself when it ends.
  const flush = !!processInfo?.u || isFlushing;

  if (mode === 0 || !ds.systemReady) return null;
  if (mode === 4) return <GrindSetup ds={ds} running={running || isFinished} />;

  const temperature = (
    <Stepper
      label='Target temperature'
      targetName='temp'
      value={ds.hasReading ? `${Math.round(ds.targetTemperature ?? 0)}°` : '—'}
      onDecrease={ds.lowerTemp}
      onIncrease={ds.raiseTemp}
      disabled={!ds.hasReading || (mode === 1 && running)}
    />
  );

  if (mode !== 1) {
    return (
      <section className='bm-group' aria-label='Temperature'>
        {temperature}
      </section>
    );
  }

  const curve = <ProfileCurve selectedProfileId={selectedProfileId} processInfo={processInfo} />;
  const shotCurve = advanced && (
    <section className='bm-group' aria-label='Profile'>
      <h2 className='bm-group__title'>{ds.selectedProfile || 'Default'}</h2>
      {curve}
    </section>
  );

  if (isFinished && !flush) {
    return (
      <>
        <ShotResults stats={finishedStats} />
        {shotCurve}
      </>
    );
  }
  if (isActive && !flush) return shotCurve;

  return (
    <section className='bm-group gap-4' aria-label='Shot setup'>
      <div className='flex flex-col gap-2'>
        <div className='bm-group__head'>
          <h2 className='bm-group__title'>Profile</h2>
          <a href='/profiles' className='bm-link'>
            All profiles
          </a>
        </div>
        <ProfileTiles selectedProfileId={selectedProfileId} disabled={running} />
        {advanced && curve}
      </div>
      {temperature}
      {ds.volumetricAvailable && (
        <StopBy label='Stop shot by' value={ds.brewTarget ? 1 : 0} onChange={ds.changeTarget} />
      )}
      {ds.volumetricAvailable && ds.brewTarget && ds.targetWeight > 0 && (
        <Stepper
          label='Target weight'
          targetName='weight'
          value={`${Math.round(ds.targetWeight)} g`}
          onDecrease={ds.lowerTarget}
          onIncrease={ds.raiseTarget}
        />
      )}
    </section>
  );
}

ShotSetup.propTypes = {
  ds: PropTypes.object.isRequired,
  advanced: PropTypes.bool,
  finishedStats: PropTypes.object,
};
