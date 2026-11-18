import { computed, useSignalEffect } from '@preact/signals';
import { useContext, useState } from 'preact/hooks';
import { Setting } from '../../../components/Field.jsx';
import { Segmented } from '../../../components/Segmented.jsx';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
import { Stepper } from '../../../components/Stepper.jsx';
import { Tile } from '../../../components/Tile.jsx';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import { grindTargetLabel } from '../machineView.js';

const connected = computed(() => machine.value.connected);
const MAX_FAVOURITES = 10;
const STOP_BY = [
  { value: 0, label: 'Time' },
  { value: 1, label: 'Weight' },
];

function Favourites({ selectedProfileId, disabled }) {
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

  // The track holds its place until the profiles arrive.
  if (profiles === null) return <SkeletonBlock className='rounded-pill h-11' />;

  // Favourites first; the selected profile always has a place, even when it isn't a favourite.
  const favourites = profiles.filter(p => p.favorite);
  const selected = profiles.find(p => p.id === selectedProfileId);
  const shown =
    selected && !favourites.includes(selected)
      ? [selected, ...favourites].slice(0, MAX_FAVOURITES)
      : favourites.slice(0, MAX_FAVOURITES);

  if (shown.length === 0) {
    return <p className='bm-help'>Mark a profile as a favourite to pick it from here.</p>;
  }
  return (
    <Segmented
      scroll
      label='Favourite profiles'
      // Real names keep their room: the track scrolls sideways instead of squeezing them, and a
      // name longer than 176px ends in an ellipsis. All profiles reaches every one.
      options={shown.map(p => ({ value: p.id, label: p.label }))}
      value={selectedProfileId}
      onChange={select}
      disabled={disabled}
    />
  );
}

function Temperature({ ds, disabled }) {
  return (
    <Setting label='Target temperature'>
      <Stepper
        value={ds.hasReading ? `${Math.round(ds.targetTemperature ?? 0)}°` : undefined}
        onDecrease={ds.lowerTemp}
        onIncrease={ds.raiseTemp}
        decreaseLabel='Lower target temperature'
        increaseLabel='Raise target temperature'
        disabled={!ds.hasReading || disabled}
      />
    </Setting>
  );
}

function StopBy({ label, value, onChange, disabled }) {
  return (
    <Setting label={label}>
      <Segmented
        label={label}
        options={STOP_BY}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </Setting>
  );
}

/** Whether the machine's state has anything to set up: not in standby, nor without a grinder. */
export const hasSetup = ds =>
  ds.systemReady && (ds.mode === 4 ? ds.isGrindAvailable : ds.mode >= 1 && ds.mode <= 3);

/**
 * What can change before the next shot, in one tile: the profile, then the targets. While a
 * process runs, and until a finished shot is put away, it stays where it is and cannot be used.
 */
export function SetupTile({ ds, className }) {
  const { mode, isActive, isFinished, isFlushing, processInfo } = ds;
  if (!hasSetup(ds)) return null;

  if (mode === 4) {
    const locked = isActive || isFinished;
    return (
      <Tile aria-label='Grind setup' className={className}>
        {ds.volumetricAvailable && (
          <StopBy
            label='Stop grinding by'
            value={ds.grindTarget ? 1 : 0}
            onChange={ds.changeTarget}
            disabled={locked}
          />
        )}
        <Setting label='Grind target'>
          <Stepper
            value={grindTargetLabel(ds)}
            onDecrease={ds.lowerTarget}
            onIncrease={ds.raiseTarget}
            decreaseLabel='Lower grind target'
            increaseLabel='Raise grind target'
            disabled={locked}
          />
        </Setting>
      </Tile>
    );
  }

  if (mode !== 1) {
    return (
      <Tile aria-label='Temperature' className={className}>
        <Temperature ds={ds} />
      </Tile>
    );
  }

  // A flush is not a shot: it locks the setup while it runs and leaves nothing to put away.
  const flush = !!processInfo?.u || isFlushing;
  const locked = isActive || isFlushing || (isFinished && !flush);
  return (
    <Tile
      aria-label='Shot setup'
      title='Profile'
      end={
        <a href='/profiles' className='bm-link'>
          All profiles
        </a>
      }
      className={className}
    >
      <Favourites selectedProfileId={ds.selectedProfileId} disabled={locked} />
      <Temperature ds={ds} disabled={locked} />
      {ds.volumetricAvailable && (
        <StopBy
          label='Stop shot by'
          value={ds.brewTarget ? 1 : 0}
          onChange={ds.changeTarget}
          disabled={locked}
        />
      )}
      {ds.volumetricAvailable && ds.brewTarget && ds.targetWeight > 0 && (
        <Setting label='Target weight'>
          <Stepper
            value={`${Math.round(ds.targetWeight)} g`}
            onDecrease={ds.lowerTarget}
            onIncrease={ds.raiseTarget}
            decreaseLabel='Lower target weight'
            increaseLabel='Raise target weight'
            disabled={locked}
          />
        </Setting>
      )}
    </Tile>
  );
}
