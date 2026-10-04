import { Icon } from '../../../../components/Icon.jsx';
import { CardTitle } from '../../../../components/CardTitle';
import { getNotesTasteStyle } from '../../utils/analyzerUtils';
import { useShotNotesState } from '../useShotNotesState';
import { ShotMainInfoCard } from './ShotMainInfoCard';
import { MetricValueGrid } from './ShotMetricCards';

const tasteOptions = [
  { value: 'bitter', label: 'Bitter' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'sour', label: 'Sour' },
];

const fieldLabelClass =
  'text-[var(--ink-muted)] mb-0.5 flex items-center gap-1.5 text-xs leading-tight font-medium';
const inputClass =
  'border-base-content/10 bg-base-100/80 text-base-content input input-xs min-h-8 w-full rounded-md text-xs lg:min-h-7 xl:min-h-8';
const textareaClass =
  'border-base-content/10 bg-base-100/80 text-base-content textarea textarea-bordered textarea-xs min-h-[5rem] w-full rounded-md !text-xs leading-relaxed lg:min-h-[4rem] xl:min-h-[5rem]';
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

function getSelectedTasteButtonStyle(taste) {
  const tasteStyle = getNotesTasteStyle(taste);
  if (!tasteStyle) return undefined;
  return {
    '--shot-details-taste-selected-bg': tasteStyle.selectedBackground,
  };
}

function DetailField({ icon, label, children, className = '', action = null }) {
  return (
    <div className={className}>
      <div className={`${fieldLabelClass} justify-between`}>
        <span className='flex min-w-0 items-center gap-1.5'>
          {icon ? <Icon name={icon} className='text-[0.7rem]' /> : null}
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ShotDetailsCard({ entry, isCompare }) {
  const { flushSave, handleFieldChange, loading, notes, updateAndSave } = useShotNotesState({
    currentShot: entry.shot,
  });
  const duplicateMobileSummaryClass = isCompare ? '' : 'hidden lg:flex';
  const duplicateMobileMetricsClass = isCompare ? 'hidden lg:block' : 'hidden sm:block';

  return (
    <section className='relative flex h-full flex-col gap-3'>
      <ShotMainInfoCard
        entry={entry}
        isCompare={isCompare}
        notes={notes}
        loading={loading}
        onRatingChange={value => updateAndSave('rating', value)}
        className={duplicateMobileSummaryClass || 'flex'}
      />

      <div className={duplicateMobileMetricsClass}>
        <div className='app-card-surface min-w-0 flex-col rounded-xl p-3 lg:p-2.5 xl:p-3'>
          <CardTitle className='mb-3'>Shot Metrics</CardTitle>
          <MetricValueGrid
            total={entry.results?.total}
            excludeKeys={['duration', 'w', 'tt']}
            flat
          />
        </div>
      </div>

      <div className='app-card-surface flex flex-1 flex-col gap-3 rounded-xl p-3 lg:p-2.5 xl:p-3'>
        <CardTitle>Shot Notes</CardTitle>
        <div className='grid grid-cols-2 gap-3'>
          <DetailField icon={'scale'} label='Dose In'>
            <input
              type='number'
              step='0.1'
              className={inputClass}
              value={notes.doseIn || ''}
              onPointerDown={event => initializeEmptyDoseStepper(event, EMPTY_DOSE_DEFAULTS.doseIn)}
              onKeyDown={event =>
                initializeEmptyDoseKeyboardStepper(event, EMPTY_DOSE_DEFAULTS.doseIn)
              }
              onInput={event => handleFieldChange('doseIn', event.target.value)}
              onBlur={flushSave}
              placeholder='18.0'
            />
          </DetailField>
          <DetailField icon={'scale'} label='Dose Out'>
            <input
              type='number'
              step='0.1'
              className={inputClass}
              value={notes.doseOut || ''}
              onPointerDown={event =>
                initializeEmptyDoseStepper(event, EMPTY_DOSE_DEFAULTS.doseOut)
              }
              onKeyDown={event =>
                initializeEmptyDoseKeyboardStepper(event, EMPTY_DOSE_DEFAULTS.doseOut)
              }
              onInput={event => handleFieldChange('doseOut', event.target.value)}
              onBlur={flushSave}
              placeholder='36.0'
            />
          </DetailField>
          <DetailField icon={'sliders-horizontal'} label='Ratio' className='col-span-2'>
            <input
              type='text'
              readOnly
              aria-label='Ratio'
              className={`${inputClass} cursor-default bg-[var(--surface-2)] text-[var(--ink-muted)]`}
              value={notes.ratio ? `1:${notes.ratio}` : '—'}
            />
          </DetailField>
          <DetailField icon={'settings'} label='Grind' className='col-span-2'>
            <input
              type='text'
              className={inputClass}
              value={notes.grindSetting || ''}
              onInput={event => handleFieldChange('grindSetting', event.target.value)}
              onBlur={flushSave}
              placeholder='2.5'
            />
          </DetailField>
          <DetailField icon={'info'} label='Beans' className='col-span-2'>
            <input
              type='text'
              className={inputClass}
              value={notes.beanType || ''}
              onInput={event => handleFieldChange('beanType', event.target.value)}
              onBlur={flushSave}
              placeholder='Single Origin, Blend...'
            />
          </DetailField>
          <DetailField icon={'moon'} label='Balance / Taste' className='col-span-2'>
            <div className='flex w-full min-w-0 rounded-full bg-[var(--surface-2)] p-0.5'>
              {tasteOptions.map(option => (
                <button
                  key={option.value}
                  type='button'
                  className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-2 py-1 text-xs transition-all duration-200 ${
                    notes.balanceTaste === option.value
                      ? 'text-base-content bg-[var(--shot-details-taste-selected-bg)] font-medium'
                      : 'hover:text-base-content text-[var(--ink-muted)]'
                  }`}
                  style={getSelectedTasteButtonStyle(option.value)}
                  onClick={() => updateAndSave('balanceTaste', option.value)}
                >
                  <span className='truncate'>{option.label}</span>
                </button>
              ))}
            </div>
          </DetailField>
        </div>
        <DetailField
          icon={'square-pen'}
          label='Notes'
          className='flex min-h-0 flex-1 flex-col'
          action={
            <span className='text-xs text-[var(--ink-muted)]'>
              {(notes.notes || '').length}/200
            </span>
          }
        >
          <textarea
            className={`${textareaClass} flex-1`}
            value={notes.notes || ''}
            maxLength={200}
            onInput={event => handleFieldChange('notes', event.target.value)}
            onBlur={flushSave}
            placeholder='Tasting notes, brewing observations...'
          />
        </DetailField>
      </div>
    </section>
  );
}
