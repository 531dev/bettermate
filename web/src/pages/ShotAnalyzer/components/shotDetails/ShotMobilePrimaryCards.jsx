import { ShotMainInfoCard } from './ShotMainInfoCard';
import { useShotNotesState } from '../useShotNotesState';

/** The shot's summary above the chart, where a phone shows it first. */
export function ShotMobilePrimaryCards({ entry }) {
  const { loading, notes, updateAndSave } = useShotNotesState({
    currentShot: entry?.shot,
  });

  return (
    <div className='flex flex-col lg:hidden'>
      <ShotMainInfoCard
        entry={entry}
        notes={notes}
        loading={loading}
        onRatingChange={value => updateAndSave('rating', value)}
      />
    </div>
  );
}
