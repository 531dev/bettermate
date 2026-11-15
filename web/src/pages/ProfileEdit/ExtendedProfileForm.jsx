import { useEffect, useState } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Menu, MenuItem } from '../../components/Menu.jsx';
import { Tile } from '../../components/Tile.jsx';
import { ExtendedPhase } from './ExtendedPhase.jsx';
import { useFormValidation } from '../../components/FormField.jsx';
import { PhaseTabs } from './PhaseTabs.jsx';
import { ProfileForm } from './ProfileForm.jsx';
import { ProfileMainInformation } from './ProfileMainInformation.jsx';
import { getProfilePhases, movePhaseAt, removePhaseAt, updatePhaseAt } from './profilePhases.js';

export function ExtendedProfileForm(props) {
  const { data, onChange, onSave, saving = true, pressureAvailable = false } = props;
  const phases = getProfilePhases(data);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const validation = useFormValidation();

  // One phase is on the page at a time, so a message belongs to the phase it was raised for.
  const { clearErrors } = validation;
  useEffect(() => clearErrors(), [clearErrors, currentPhaseIndex, phases.length]);

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

  // The moved phase stays the one being edited.
  const onPhaseMove = offset => {
    const target = currentPhaseIndex + offset;
    if (target < 0 || target >= phases.length) return;
    onChange({
      ...data,
      phases: movePhaseAt(phases, currentPhaseIndex, offset),
    });
    setCurrentPhaseIndex(target);
  };

  const currentPhase = phases[currentPhaseIndex];

  return (
    <ProfileForm validation={validation} saving={saving} onSubmit={() => onSave(data)}>
      <ProfileMainInformation
        data={data}
        onChangeLabel={e => onFieldChange('label', e.target.value)}
        onChangeDescription={e => onFieldChange('description', e.target.value)}
        onChangeDose={e =>
          onFieldChange('dose', e.target.value === '' ? undefined : Number(e.target.value))
        }
        onChangeTemperature={e => onFieldChange('temperature', e.target.value)}
        onChangeUtility={utility => onFieldChange('utility', utility)}
      />
      <Tile>
        <ExtendedProfileChart
          data={{ ...data, phases }}
          selectedPhase={currentPhaseIndex}
          className='max-h-72 w-full'
          onPhaseClick={setCurrentPhaseIndex}
        />
        {phases.length > 1 && <p className='bm-help'>Press a phase in the chart to edit it.</p>}
      </Tile>

      <div className='flex items-center justify-between gap-3 pt-3'>
        <h2 className='bm-heading'>Phases</h2>
        <div className='flex items-center gap-2'>
          <Menu
            label={
              phases.length > 0
                ? `Actions for phase ${currentPhaseIndex + 1} of ${phases.length}`
                : 'Phase actions'
            }
            size='sm'
          >
            <MenuItem
              icon='chevron-left'
              disabled={currentPhaseIndex === 0}
              onClick={() => onPhaseMove(-1)}
            >
              Move earlier
            </MenuItem>
            <MenuItem
              icon='chevron-right'
              disabled={phases.length === 0 || currentPhaseIndex === phases.length - 1}
              onClick={() => onPhaseMove(1)}
            >
              Move later
            </MenuItem>
            <MenuItem
              icon='trash-2'
              danger
              disabled={phases.length === 0}
              onClick={() => onPhaseRemove(currentPhaseIndex)}
            >
              Delete
            </MenuItem>
          </Menu>
          <Button size='sm' aria-label='Add phase' onClick={() => onPhaseAdd()}>
            <Icon name='plus' size={18} />
            Add
          </Button>
        </div>
      </div>
      {phases.length > 0 && (
        <PhaseTabs phases={phases} current={currentPhaseIndex} onSelect={setCurrentPhaseIndex} />
      )}

      {currentPhase ? (
        <ExtendedPhase
          phase={currentPhase}
          index={currentPhaseIndex}
          onChange={phase => onPhaseChange(currentPhaseIndex, phase)}
          pressureAvailable={pressureAvailable}
        />
      ) : (
        <Tile>
          <p className='bm-help'>No phases yet. Add a phase to configure brewing.</p>
        </Tile>
      )}
    </ProfileForm>
  );
}
