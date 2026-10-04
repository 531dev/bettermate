import { Icon } from '../../../components/Icon.jsx';
import { useContext, useState } from 'preact/hooks';
import { computed, useSignalEffect } from '@preact/signals';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import PropTypes from 'prop-types';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';

const connected = computed(() => machine.value.connected);

function ProfileMiniCard({ profile, isSelected, onSelect }) {
  const phases = Array.isArray(profile?.phases) ? profile.phases : [];
  const totalSeconds = phases.reduce(
    (sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0),
    0,
  );
  const lastPhase = phases[phases.length - 1];
  const weight = lastPhase?.targets?.find(t => t.type === 'volumetric')?.value ?? null;

  return (
    <button
      type='button'
      aria-pressed={isSelected}
      onClick={() => onSelect(profile.id)}
      className={`flex w-full cursor-pointer flex-col gap-2 rounded-xl border-2 p-3 text-left transition-colors ${
        isSelected
          ? 'border-primary bg-info'
          : 'border-transparent bg-[var(--surface-2)] hover:border-[var(--line-strong)]'
      }`}
    >
      <div className='w-full truncate text-sm font-semibold'>{profile.label}</div>
      <div className='w-full truncate text-xs text-[var(--ink-muted)]'>
        {profile.description || ' '}
      </div>
      <div className='mt-auto flex flex-wrap gap-1 pt-0.5'>
        <span className='badge badge-sm gap-1 border-0 bg-[var(--heat-soft)] text-[var(--heat-text)]'>
          <Icon name={'thermometer'} />
          {profile.temperature}°C
        </span>
        {weight !== null && (
          <span className='badge badge-sm gap-1 border-0 bg-[var(--weight-soft)] text-[var(--weight)]'>
            <Icon name={'scale'} />
            {weight}g
          </span>
        )}
        <span className='badge badge-sm gap-1 border-0 bg-[var(--surface-0)] text-[var(--ink-muted)]'>
          <Icon name={'clock'} />
          {totalSeconds}s
        </span>
      </div>
    </button>
  );
}

ProfileMiniCard.propTypes = {
  profile: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export function FavoriteProfilesCard({ selectedProfileId, inCard = false, compact = false }) {
  const apiService = useContext(ApiServiceContext);
  const [favorites, setFavorites] = useState(null);
  const [loading, setLoading] = useState(false);

  useSignalEffect(() => {
    if (!apiService || !connected.value) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiService
      .request({ tp: 'req:profiles:list' })
      .then(res => {
        if (cancelled) return;
        setFavorites((res.profiles ?? []).filter(p => p.favorite).slice(0, 3));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  });

  const handleSelect = id => {
    apiService.request({ tp: 'req:profiles:select', id }).catch(() => {});
  };

  const wrapperClass = inCard
    ? 'flex flex-col gap-2'
    : 'card bg-base-100 flex flex-col gap-2 rounded-xl p-3';

  if (loading || favorites === null) {
    return (
      <div className={wrapperClass}>
        <SkeletonBlock className='h-2 w-20' />
        {compact ? (
          <div className='flex gap-1.5'>
            {[0, 1, 2].map(i => (
              <SkeletonBlock key={i} className='h-7 w-20 rounded-full' />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-3 gap-2'>
            {[0, 1, 2].map(i => (
              <SkeletonBlock key={i} className='h-24 rounded-lg' />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className={wrapperClass}>
        <div className='text-[0.6rem] tracking-wider text-[var(--ink-muted)] uppercase'>
          Quick Select
        </div>
        <div className='flex flex-col items-center gap-1 py-3 text-center text-sm text-[var(--ink-muted)]'>
          <span className='text-lg'>★</span>
          <span>No favorites — mark profiles as ★ in the profile list</span>
        </div>
      </div>
    );
  }

  const content = compact ? (
    <div className='flex gap-1.5 overflow-x-auto pb-0.5'>
      {favorites.map(profile => (
        <button
          key={profile.id}
          type='button'
          aria-pressed={profile.id === selectedProfileId}
          onClick={() => handleSelect(profile.id)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            profile.id === selectedProfileId
              ? 'bg-primary text-primary-content'
              : 'text-base-content hover:bg-base-300 bg-[var(--surface-2)]'
          }`}
        >
          {profile.label}
        </button>
      ))}
    </div>
  ) : (
    <div
      className='grid gap-2'
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))' }}
    >
      {favorites.map(profile => (
        <ProfileMiniCard
          key={profile.id}
          profile={profile}
          isSelected={profile.id === selectedProfileId}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );

  return (
    <div className={wrapperClass}>
      <div className='text-[0.6rem] tracking-wider text-[var(--ink-muted)] uppercase'>
        Quick Select
      </div>
      {content}
    </div>
  );
}

FavoriteProfilesCard.propTypes = {
  selectedProfileId: PropTypes.string,
  inCard: PropTypes.bool,
  compact: PropTypes.bool,
};
