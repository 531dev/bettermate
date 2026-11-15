import { useId } from 'preact/hooks';
import { Field, Input, Textarea } from '../../../../components/Field.jsx';
import { Segmented } from '../../../../components/Segmented.jsx';
import { Cell, Tile } from '../../../../components/Tile.jsx';
import { useShotNotesState } from '../useShotNotesState';
import { ShotMainInfoCard } from './ShotMainInfoCard';
import { ShotMetricsTile } from './ShotMetricCards';
import './shotDetails.css';

const tasteOptions = [
  { value: 'bitter', label: 'Bitter' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'sour', label: 'Sour' },
];

const NOTES_MAX_LENGTH = 200;
const EMPTY_DOSE_DEFAULTS = {
  doseIn: 18,
  doseOut: 36,
};

function initializeEmptyDoseStepper(event, fallbackValue) {
  const input = event.currentTarget;
  if (input.value !== '') return;

  const bounds = input.getBoundingClientRect();
  const stepperWidth = Math.min(24, bounds.width);
  if (event.clientX < bounds.right - stepperWidth) return;

  const isIncrement = event.clientY < bounds.top + bounds.height / 2;
  input.value = (fallbackValue + (isIncrement ? -0.1 : 0.1)).toFixed(1);
}

function initializeEmptyDoseKeyboardStepper(event, fallbackValue) {
  const input = event.currentTarget;
  if (input.value !== '' || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;

  input.value = (fallbackValue + (event.key === 'ArrowUp' ? -0.1 : 0.1)).toFixed(1);
}

/** A dose in grams. Stepping an empty field starts from the usual dose instead of from zero. */
function DoseField({ label, value, fallbackValue, onInput, onBlur }) {
  return (
    <Field label={label}>
      <Input
        type='number'
        step='0.1'
        inputMode='decimal'
        unit='g'
        className='an-input--sm'
        value={value || ''}
        onPointerDown={event => initializeEmptyDoseStepper(event, fallbackValue)}
        onKeyDown={event => initializeEmptyDoseKeyboardStepper(event, fallbackValue)}
        onInput={event => onInput(event.target.value)}
        onBlur={onBlur}
        placeholder={fallbackValue.toFixed(1)}
      />
    </Field>
  );
}

export function ShotDetailsCard({ entry, isCompare }) {
  const { flushSave, handleFieldChange, loading, notes, updateAndSave } = useShotNotesState({
    currentShot: entry.shot,
  });
  const fieldId = useId();
  const notesId = `${fieldId}-notes`;
  const notesCountId = `${fieldId}-notes-count`;
  // On a phone the summary sits above the chart and the chart pages through the metrics, so a
  // single shot does not repeat them here. A comparison shows its details on their own page.
  const summaryClassName = isCompare ? undefined : 'max-lg:hidden';
  const metricsClassName = isCompare ? 'max-lg:hidden' : 'max-sm:hidden';

  return (
    <div className='flex flex-col gap-2 lg:gap-3'>
      <ShotMainInfoCard
        entry={entry}
        notes={notes}
        loading={loading}
        onRatingChange={value => updateAndSave('rating', value)}
        className={summaryClassName}
      />

      <ShotMetricsTile total={entry.results?.total} className={metricsClassName} />

      <Tile eyebrow='Shot notes'>
        <div className='grid grid-cols-2 gap-2'>
          <DoseField
            label='Dose in'
            value={notes.doseIn}
            fallbackValue={EMPTY_DOSE_DEFAULTS.doseIn}
            onInput={value => handleFieldChange('doseIn', value)}
            onBlur={flushSave}
          />
          <DoseField
            label='Dose out'
            value={notes.doseOut}
            fallbackValue={EMPTY_DOSE_DEFAULTS.doseOut}
            onInput={value => handleFieldChange('doseOut', value)}
            onBlur={flushSave}
          />
        </div>

        <Cell className='flex-row items-center justify-between py-3'>
          <span className='bm-eyebrow'>Ratio</span>
          <span className='bm-metric-sm'>{notes.ratio ? `1:${notes.ratio}` : '—'}</span>
        </Cell>

        <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2'>
          <Field label='Grind'>
            <Input
              type='text'
              className='an-input--sm'
              value={notes.grindSetting || ''}
              onInput={event => handleFieldChange('grindSetting', event.target.value)}
              onBlur={flushSave}
              placeholder='2.5'
            />
          </Field>
          <Field label='Beans'>
            <Input
              type='text'
              className='an-input--sm'
              value={notes.beanType || ''}
              onInput={event => handleFieldChange('beanType', event.target.value)}
              onBlur={flushSave}
              placeholder='Single origin, blend…'
            />
          </Field>
        </div>

        <Field label='Balance / taste' as='div'>
          <Segmented
            block
            label='Balance / taste'
            options={tasteOptions}
            value={notes.balanceTaste}
            onChange={value => updateAndSave('balanceTaste', value)}
          />
        </Field>

        <div className='bm-field'>
          <div className='flex items-baseline justify-between gap-3'>
            <label className='bm-field__label' htmlFor={notesId}>
              Notes
            </label>
            <span className='bm-caption' id={notesCountId}>
              {(notes.notes || '').length}/{NOTES_MAX_LENGTH}
            </span>
          </div>
          <Textarea
            id={notesId}
            aria-describedby={notesCountId}
            value={notes.notes || ''}
            maxLength={NOTES_MAX_LENGTH}
            onInput={event => handleFieldChange('notes', event.target.value)}
            onBlur={flushSave}
            placeholder='Tasting notes, brewing observations…'
          />
        </div>
      </Tile>
    </div>
  );
}
