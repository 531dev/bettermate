import { Button } from '../../components/Button.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Menu, MenuItem } from '../../components/Menu.jsx';
import { Tile } from '../../components/Tile.jsx';
import { Choice, FormField, useFormValidation } from './form.jsx';
import { ProfileForm } from './ProfileForm.jsx';
import { ProfileMainInformation } from './ProfileMainInformation.jsx';
import { getProfilePhases, movePhaseAt, removePhaseAt, updatePhaseAt } from './profilePhases.js';

export const PHASE_TYPES = [
  { value: 'preinfusion', label: 'Pre-infusion' },
  { value: 'brew', label: 'Brew' },
];
export const VALVE_STATES = [
  { value: 0, label: 'Closed' },
  { value: 1, label: 'Open' },
];

export function StandardProfileForm(props) {
  const { data, onChange, onSave, saving = true, pressureAvailable = false } = props;
  const phases = getProfilePhases(data);
  const validation = useFormValidation();

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
          targets: [],
        },
      ],
    });
  };

  const onPhaseRemove = index => {
    validation.clearErrors();
    onChange({
      ...data,
      phases: removePhaseAt(phases, index),
    });
  };

  const onPhaseMove = (index, offset) => {
    validation.clearErrors();
    onChange({
      ...data,
      phases: movePhaseAt(phases, index, offset),
    });
  };

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

      {phases.map((value, index) => (
        <Phase
          key={index}
          phase={value}
          index={index}
          count={phases.length}
          onChange={phase => onPhaseChange(index, phase)}
          onRemove={() => onPhaseRemove(index)}
          onMove={offset => onPhaseMove(index, offset)}
          pressureAvailable={pressureAvailable}
        />
      ))}
      <Button className='self-start' onClick={onPhaseAdd}>
        <Icon name='plus' size={18} />
        Add phase
      </Button>
    </ProfileForm>
  );
}

function Phase({ phase, index, count, onChange, onRemove, onMove, pressureAvailable }) {
  const onFieldChange = (field, value) => {
    onChange({
      ...phase,
      [field]: value,
    });
  };

  const onVolumetricTargetChange = value => {
    if (!Number.isFinite(value) || value <= 0) {
      onChange({
        ...phase,
        targets: [],
      });
      return;
    }
    onChange({
      ...phase,
      targets: [
        {
          type: 'volumetric',
          value,
        },
      ],
    });
  };

  const targets = phase?.targets || [];
  const volumetricTarget = targets.find(t => t.type === 'volumetric') || {};
  const targetWeight = volumetricTarget?.value || 0;

  // A pump is a power in percent, or a pressure and a flow of which one is the target. A power
  // field that is being retyped is empty for a moment, and is still a power.
  const simplePump = typeof phase.pump === 'number';
  const pumpPower = simplePump ? (Number.isFinite(phase.pump) ? phase.pump : '') : 100;
  const pressure = simplePump ? 0 : phase.pump?.pressure;
  const flow = simplePump ? 0 : phase.pump?.flow;
  const mode = simplePump ? (phase.pump === 0 ? 'off' : 'power') : phase.pump?.target;

  const pumpModes = [
    { value: 'off', label: 'Off' },
    { value: 'power', label: 'Power' },
    ...(pressureAvailable
      ? [
          { value: 'pressure', label: 'Pressure' },
          { value: 'flow', label: 'Flow' },
        ]
      : []),
  ];
  const onModeChange = next => {
    if (next === mode) return;
    if (next === 'off') onFieldChange('pump', 0);
    else if (next === 'power') onFieldChange('pump', 100);
    else {
      onFieldChange('pump', {
        target: next,
        pressure: phase.pump?.pressure || 0,
        flow: phase.pump?.flow || 0,
      });
    }
  };

  return (
    <Tile
      role='group'
      aria-label={`Phase ${index + 1} configuration`}
      eyebrow={`Phase ${index + 1}`}
      end={
        <Menu label={`Actions for phase ${index + 1}`} size='sm'>
          <MenuItem icon='chevron-up' disabled={index === 0} onClick={() => onMove(-1)}>
            Move up
          </MenuItem>
          <MenuItem icon='chevron-down' disabled={index === count - 1} onClick={() => onMove(1)}>
            Move down
          </MenuItem>
          <MenuItem icon='trash-2' danger onClick={onRemove}>
            Delete
          </MenuItem>
        </Menu>
      }
    >
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <Choice
          label='Phase type'
          options={PHASE_TYPES}
          value={phase.phase}
          onChange={value => onFieldChange('phase', value)}
        />
        <FormField
          id={`phase-${index}-name`}
          label='Phase name'
          placeholder='Name'
          value={phase.name}
          onInput={e => onFieldChange('name', e.target.value)}
        />
        <FormField
          id={`phase-${index}-duration`}
          label='Duration'
          unit='s'
          type='number'
          min='1'
          value={phase.duration}
          onInput={e => onFieldChange('duration', e.target.value)}
          aria-label='Duration in seconds'
        />
        <FormField
          id={`phase-${index}-target`}
          label='Target weight'
          unit='g'
          type='number'
          help='0 runs the phase for its duration.'
          value={targetWeight}
          onInput={e => onVolumetricTargetChange(parseFloat(e.target.value))}
          aria-label='Target weight in grams'
          min='0'
          step='0.1'
        />
        <Choice
          label='Valve'
          options={VALVE_STATES}
          value={phase.valve ? 1 : 0}
          onChange={value => onFieldChange('valve', value)}
        />
        <Choice
          id={`phase-${index}-pump`}
          label='Pump mode'
          options={pumpModes}
          value={mode}
          onChange={onModeChange}
        />

        {mode === 'power' && (
          <FormField
            id={`phase-${index}-power`}
            label='Pump power'
            unit='%'
            type='number'
            step='1'
            min={0}
            max={100}
            required
            value={pumpPower}
            onInput={e => onFieldChange('pump', parseFloat(e.target.value))}
            aria-label='Pump power as percentage'
          />
        )}

        {(mode === 'pressure' || mode === 'flow') && (
          <>
            <FormField
              id={`phase-${index}-pressure`}
              label={mode === 'pressure' ? 'Pressure target' : 'Pressure limit'}
              unit='bar'
              type='number'
              step='0.01'
              min='0'
              value={pressure}
              onInput={e =>
                onFieldChange('pump', { ...phase.pump, pressure: parseFloat(e.target.value) })
              }
              aria-label={`${mode === 'pressure' ? 'Pressure target' : 'Pressure limit'} in bar`}
            />
            <FormField
              id={`phase-${index}-flow`}
              label={mode === 'flow' ? 'Flow target' : 'Flow limit'}
              unit='ml/s'
              type='number'
              step='0.01'
              min='0'
              value={flow}
              onInput={e =>
                onFieldChange('pump', { ...phase.pump, flow: parseFloat(e.target.value) })
              }
              aria-label={`${mode === 'flow' ? 'Flow target' : 'Flow limit'} in millilitres per second`}
            />
          </>
        )}
      </div>
    </Tile>
  );
}
