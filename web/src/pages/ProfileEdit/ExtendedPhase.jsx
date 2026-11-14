import { Fragment } from 'preact';
import { Menu, MenuItem } from '../../components/Menu.jsx';
import { Tile } from '../../components/Tile.jsx';
import { ExtendedPhaseTarget, TargetTypes } from './ExtendedPhaseTarget.jsx';
import { Choice, FormField } from './form.jsx';
import { PHASE_TYPES, VALVE_STATES } from './StandardProfileForm.jsx';

const RAMP_STYLES = [
  { value: 'instant', label: 'Instant' },
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease in' },
  { value: 'ease-out', label: 'Ease out' },
  { value: 'ease-in-out', label: 'Ease in and out' },
];
const RAMP_TARGETS = [
  { value: 'time', label: 'Time' },
  { value: 'volumetric', label: 'Weight' },
  { value: 'pumped', label: 'Water' },
];
const RAMP_UNIT_NAMES = { s: 'seconds', g: 'grams', ml: 'millilitres' };
const RAMP_STARTS = [
  { value: 'previous', label: 'Previous target' },
  { value: 'current', label: 'Current value' },
];

/** The phase being edited, as tiles of fields: the phase, its pump, its ramp and its stops. */
export function ExtendedPhase({ phase, index, onChange, pressureAvailable }) {
  const onFieldChange = (field, value) => {
    onChange({
      ...phase,
      [field]: value,
    });
  };

  const targets = phase?.targets || [];

  // A new list each time: the profile as it was loaded shares these objects, and an edit made in
  // place would change both and pass for no edit at all.
  const onTargetChange = (index, value) => {
    onChange({
      ...phase,
      targets: targets.map((target, i) => (i === index ? value : target)),
    });
  };

  const onTargetRemove = index => {
    onChange({
      ...phase,
      targets: targets.filter((_, i) => i !== index),
    });
  };

  const onTargetAdd = target => {
    onChange({
      ...phase,
      targets: [...targets, target],
    });
  };

  // A pump is a power in percent, or a pressure and a flow of which one is the target. A power
  // field that is being retyped is empty for a moment, and is still a power.
  const simplePump = typeof phase.pump === 'number';
  const pumpPower = simplePump ? (Number.isFinite(phase.pump) ? phase.pump : '') : 100;
  const pressure = simplePump ? 0 : phase.pump?.pressure;
  const flow = simplePump ? 0 : phase.pump?.flow;
  let mode = simplePump ? (phase.pump === 0 ? 'off' : 'power') : phase.pump?.target;
  if (mode === 'pressure' && phase.pump.pressure === -1) mode = 'hold-pressure';
  if (mode === 'flow' && phase.pump.flow === -1) mode = 'hold-flow';
  const availableTargetTypes = TargetTypes.filter(
    t => !targets.find(t2 => t2.type === t.type && t2.operator === t.operator),
  );

  let rampUnit = 's';
  if (phase.transition?.target === 'volumetric') rampUnit = 'g';
  if (phase.transition?.target === 'pumped') rampUnit = 'ml';

  const pumpModes = [
    { value: 'off', label: 'Off' },
    { value: 'power', label: 'Power' },
    ...(pressureAvailable
      ? [
          { value: 'pressure', label: 'Pressure' },
          { value: 'flow', label: 'Flow' },
          { value: 'hold-pressure', label: 'Maintain pressure' },
          { value: 'hold-flow', label: 'Maintain flow' },
        ]
      : []),
  ];
  const onModeChange = next => {
    if (next === mode) return;
    const keptPressure = Math.max(phase.pump?.pressure || 0, 0);
    const keptFlow = Math.max(phase.pump?.flow || 0, 0);
    if (next === 'off') onFieldChange('pump', 0);
    if (next === 'power') onFieldChange('pump', 100);
    if (next === 'pressure') {
      onFieldChange('pump', { target: 'pressure', pressure: keptPressure, flow: keptFlow });
    }
    if (next === 'flow') {
      onFieldChange('pump', { target: 'flow', pressure: keptPressure, flow: keptFlow });
    }
    if (next === 'hold-pressure') {
      onFieldChange('pump', { target: 'pressure', pressure: -1, flow: keptFlow });
    }
    if (next === 'hold-flow') {
      onFieldChange('pump', { target: 'flow', pressure: keptPressure, flow: -1 });
    }
  };

  const rampStyle = phase.transition?.type || 'instant';
  const onRampStyleChange = type => {
    onFieldChange(
      'transition',
      type === 'instant'
        ? { ...phase.transition, type: 'instant', duration: 0 }
        : { ...phase.transition, type },
    );
  };

  return (
    <>
      <Tile title='Phase' role='tabpanel' id={`panel-${index}`} aria-labelledby={`tab-${index}`}>
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
            id={`phase-${index}-temperature`}
            label='Temperature'
            unit='°C'
            type='number'
            help='0 keeps the temperature of the profile.'
            value={`${phase.temperature || 0}`}
            onInput={e => onFieldChange('temperature', parseFloat(e.target.value))}
            aria-label='Temperature in degrees Celsius'
            min='0'
            step='0.1'
          />
          <Choice
            label='Valve'
            options={VALVE_STATES}
            value={phase.valve ? 1 : 0}
            onChange={value => onFieldChange('valve', value)}
          />
        </div>
      </Tile>

      <Tile title='Pump'>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
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
              value={pumpPower.toString()}
              onInput={e => onFieldChange('pump', parseFloat(e.target.value))}
              aria-label='Pump power as percentage'
            />
          )}

          {(mode === 'pressure' ||
            mode === 'flow' ||
            mode === 'hold-pressure' ||
            mode === 'hold-flow') && (
            <>
              {mode !== 'hold-pressure' && (
                <FormField
                  id={`phase-${index}-pressure`}
                  label={mode === 'pressure' ? 'Target pressure' : 'Maximum pressure'}
                  help={mode === 'flow' ? '0 sets no limit.' : undefined}
                  unit='bar'
                  type='number'
                  step='0.01'
                  min={mode === 'pressure' ? '0.1' : '0'}
                  value={`${pressure}`}
                  onInput={e =>
                    onFieldChange('pump', { ...phase.pump, pressure: parseFloat(e.target.value) })
                  }
                  aria-label={`${mode === 'pressure' ? 'Target pressure' : 'Maximum pressure'} in bar`}
                />
              )}
              {mode !== 'hold-flow' && (
                <FormField
                  id={`phase-${index}-flow`}
                  label={mode === 'flow' ? 'Target flow' : 'Maximum flow'}
                  help={mode === 'pressure' ? '0 sets no limit.' : undefined}
                  unit='ml/s'
                  type='number'
                  step='0.01'
                  min={mode === 'flow' ? '0.1' : '0'}
                  value={`${flow}`}
                  onInput={e =>
                    onFieldChange('pump', { ...phase.pump, flow: parseFloat(e.target.value) })
                  }
                  aria-label={`${mode === 'flow' ? 'Target flow' : 'Maximum flow'} in millilitres per second`}
                />
              )}
            </>
          )}
        </div>
      </Tile>

      <Tile title='Ramp'>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <Choice
            id={`phase-${index}-ramp-style`}
            label='Ramp style'
            options={RAMP_STYLES}
            value={rampStyle}
            onChange={onRampStyleChange}
          />
          {rampStyle !== 'instant' && (
            <>
              <Choice
                label='Ramp over'
                help='Weight and water count from the start of this phase.'
                options={RAMP_TARGETS}
                value={phase.transition?.target || 'time'}
                onChange={target => onFieldChange('transition', { ...phase.transition, target })}
              />
              <FormField
                id={`phase-${index}-transition-duration`}
                label='Ramp length'
                unit={rampUnit}
                type='number'
                value={phase.transition?.duration || 0}
                onInput={e =>
                  onFieldChange('transition', {
                    ...phase.transition,
                    duration: parseFloat(e.target.value),
                  })
                }
                aria-label={`Ramp length in ${RAMP_UNIT_NAMES[rampUnit]}`}
                min='0'
                step='0.1'
              />
              <Choice
                label='Start ramp from'
                options={RAMP_STARTS}
                value={phase.transition?.adaptive ? 'current' : 'previous'}
                onChange={start =>
                  onFieldChange('transition', {
                    ...phase.transition,
                    adaptive: start === 'current',
                  })
                }
              />
            </>
          )}
        </div>
      </Tile>

      <Tile
        title='Stop when'
        end={
          <Menu label='Add stop condition' icon='plus' size='sm'>
            {availableTargetTypes.map(t => (
              <MenuItem
                key={`${t.type}-${t.operator}`}
                onClick={() =>
                  onTargetAdd({
                    type: t.type,
                    operator: t.operator,
                    value: 0,
                  })
                }
              >
                {t.label}
              </MenuItem>
            ))}
            {availableTargetTypes.length === 0 && <MenuItem disabled>No more conditions</MenuItem>}
          </Menu>
        }
      >
        {targets.length === 0 && (
          <p className='bm-help'>No condition yet: the phase runs for its duration.</p>
        )}
        {targets.map((target, idx) => (
          <Fragment key={idx}>
            {idx !== 0 && <span className='bm-eyebrow'>or</span>}
            <ExtendedPhaseTarget
              onChange={value => onTargetChange(idx, value)}
              onRemove={() => onTargetRemove(idx)}
              target={target}
              index={idx}
            />
          </Fragment>
        ))}
      </Tile>
    </>
  );
}
