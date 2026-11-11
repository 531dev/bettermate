import { Icon } from '../../components/Icon.jsx';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { useState } from 'preact/hooks';
import { ExtendedPhase } from './ExtendedPhase.jsx';
import { ProfileMainInformation } from './ProfileMainInformation.jsx';
import { getProfilePhases, removePhaseAt, updatePhaseAt } from './profilePhases.js';

export function ExtendedProfileForm(props) {
  const { data, onChange, onSave, saving = true, pressureAvailable = false } = props;
  const phases = getProfilePhases(data);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);

  const onFieldChange = (field, value) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const onPhaseChange = (index, value) => {
    onChange({
      ...data,
      phases: updatePhaseAt(phases, index, value),
    });
  };

  const onPhaseAdd = () => {
    onChange({
      ...data,
      phases: [
        ...phases,
        {
          phase: 'brew',
          name: 'New Phase',
          pump: 100,
          valve: 1,
          duration: 0,
          transition: {
            type: 'instant',
            duration: 0,
            adaptive: true,
            target: 'time',
          },
          targets: [],
        },
      ],
    });
    setCurrentPhaseIndex(phases.length);
  };

  const onPhaseRemove = index => {
    onChange({
      ...data,
      phases: removePhaseAt(phases, index),
    });
    setCurrentPhaseIndex(0);
  };

  const currentPhase = phases[currentPhaseIndex];

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSave(data);
      }}
    >
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
        <ProfileMainInformation
          data={data}
          onChangeLabel={e => onFieldChange('label', e.target.value)}
          onChangeDescription={e => onFieldChange('description', e.target.value)}
          onChangeDose={e =>
            onFieldChange('dose', e.target.value === '' ? undefined : Number(e.target.value))
          }
          onChangeTemperature={e => onFieldChange('temperature', e.target.value)}
          onChangeUtility={e => onFieldChange('utility', !!e.target.checked)}
        />
        <Card sm={10}>
          <ExtendedProfileChart
            data={{ ...data, phases }}
            selectedPhase={currentPhaseIndex}
            className='max-h-72 w-full'
            onPhaseClick={setCurrentPhaseIndex}
          />
        </Card>
        <Card sm={10}>
          <div className='card-header flex items-center gap-4'>
            <h2 className='card-title flex-grow text-lg sm:text-xl'>Phases</h2>
            <h5 className='card-subtitle text-sm sm:text-base'>
              {phases.length > 0 ? `${currentPhaseIndex + 1} / ${phases.length}` : '0 / 0'}
            </h5>
            <div>
              <div className='join' role='group' aria-label='Phase navigation'>
                <button
                  type='button'
                  className={`join-item btn btn-outline max-sm:btn-sm`}
                  aria-label='Previous'
                  disabled={currentPhaseIndex === 0}
                  onClick={() => setCurrentPhaseIndex(currentPhaseIndex - 1)}
                >
                  <Icon name={'chevron-left'} />
                </button>
                <button
                  type='button'
                  className={`join-item btn btn-outline max-sm:btn-sm`}
                  aria-label='Next'
                  disabled={phases.length === 0 || currentPhaseIndex === phases.length - 1}
                  onClick={() => setCurrentPhaseIndex(currentPhaseIndex + 1)}
                >
                  <Icon name={'chevron-right'} />
                </button>
              </div>
            </div>
            <button
              type='button'
              className={`join-item btn btn-outline max-sm:btn-sm`}
              aria-label='Add phase'
              onClick={() => onPhaseAdd()}
            >
              <Icon name={'plus'} />
            </button>
            <button
              type='button'
              className={`join-item btn btn-outline max-sm:btn-sm text-[var(--danger)]`}
              aria-label='Remove phase'
              disabled={phases.length === 0}
              onClick={() => onPhaseRemove(currentPhaseIndex)}
            >
              <Icon name={'trash-2'} />
            </button>
          </div>
          <div className='space-y-4' role='group' aria-label='Brew phases configuration'>
            {currentPhase ? (
              <ExtendedPhase
                phase={currentPhase}
                index={currentPhaseIndex}
                onChange={phase => onPhaseChange(currentPhaseIndex, phase)}
                onRemove={() => onPhaseRemove(currentPhaseIndex)}
                pressureAvailable={pressureAvailable}
              />
            ) : (
              <p className='text-sm text-[var(--ink-muted)]'>
                No phases yet. Add a phase to configure brewing.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className='bm-actions mt-2 lg:col-span-10'>
        <div className='flex w-full gap-2 sm:w-auto'>
          <a href='/profiles' className='btn btn-outline flex-1 sm:flex-none'>
            Back
          </a>
          <button
            type='submit'
            className='btn btn-primary flex-[2] gap-2 sm:flex-none sm:px-10'
            disabled={saving}
            aria-label={saving ? 'Saving profile...' : 'Save profile'}
          >
            <span>Save</span>
            {saving && <Spinner size={4} />}
          </button>
        </div>
      </div>
    </form>
  );
}
