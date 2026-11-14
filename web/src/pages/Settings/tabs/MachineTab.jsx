import { useContext, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { machine } from '../../../services/ApiService.js';
import { Button } from '../../../components/Button.jsx';
import { Input } from '../../../components/Field.jsx';
import { SettingsFormField } from '../../../components/SettingsFormField.jsx';
import { Cell, Tile } from '../../../components/Tile.jsx';
import {
  FieldError,
  FormErrors,
  SegmentedField,
  StepperSetting,
  TextField,
  TILE_GRID,
} from '../fields.jsx';

const ledControl = computed(() => machine.value.capabilities.ledControl);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);
const tofDistance = computed(() => machine.value.status.tofDistance);

// The firmware's functions for the second relay. The steam boiler is not built yet.
const ALT_RELAY_FUNCTIONS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Grind' },
  { value: 2, label: 'Steam boiler', disabled: true },
];

// The external LED is stored as 0 to 255 and set in steps of 5%.
const LED_MAX = 255;
const LED_STEP = 5;

/** One LED color: its name, the color and its value. The whole cell opens the color picker. */
function SunriseColor({ id, label, value, fallback, onChange }) {
  const color = value || fallback;
  return (
    <Cell as='label' htmlFor={id} className='cursor-pointer'>
      <span className='bm-field__label'>{label}</span>
      <span className='flex items-center gap-2'>
        <span
          className='rounded-pill relative size-9 shrink-0 border border-(--line) has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)'
          style={{ background: color }}
        >
          <input
            id={id}
            name={id}
            type='color'
            className='absolute inset-0 size-full cursor-pointer opacity-0'
            value={color}
            onChange={onChange}
          />
        </span>
        <span className='bm-data'>{color.toUpperCase()}</span>
      </span>
    </Cell>
  );
}

/** A tank distance with a button that takes what the sensor measures now. */
function TankDistanceField({ id, label, value, onChange, onUseCurrent }) {
  const error = useContext(FormErrors)[id];
  const measured = tofDistance.value;
  return (
    <SettingsFormField label={label} htmlFor={id}>
      <div className='flex gap-2'>
        <Input
          id={id}
          name={id}
          type='number'
          unit='mm'
          placeholder='16'
          className='min-w-0 flex-1'
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          value={value}
          onChange={onChange}
        />
        <Button
          className='shrink-0'
          title='Set to current measurement'
          disabled={measured === undefined}
          onClick={onUseCurrent}
        >
          {measured === undefined ? 'Use current' : `Use ${measured} mm`}
        </Button>
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </SettingsFormField>
  );
}

export function MachineTab({ formData, onChange, setField }) {
  const [steamPumpDraft, setSteamPumpDraft] = useState(null);
  const hasPressure = pressureAvailable.value;

  const ledBrightness = Number.parseFloat(formData.sunriseExtBrightness) || 0;
  const ledPercent = Math.round((ledBrightness / LED_MAX) * 100);
  const setLedPercent = percent =>
    setField(
      'sunriseExtBrightness',
      Math.round((Math.max(0, Math.min(100, percent)) / 100) * LED_MAX),
    );

  return (
    <div className={TILE_GRID}>
      <Tile title='Boiler'>
        <TextField
          id='pid'
          label='PID values'
          unit={
            <>
              K<sub>p</sub>, K<sub>i</sub>, K<sub>d</sub>
            </>
          }
          type='text'
          placeholder='2.0, 0.1, 0.01'
          value={formData.pid}
          onChange={onChange('pid')}
        />
        <TextField
          id='kf'
          label='Thermal feedforward gain'
          unit={
            <>
              K<sub>ff</sub>
            </>
          }
          help='Set to 0 to disable feedforward control.'
          type='number'
          step='0.001'
          placeholder='0.600'
          value={formData.kf}
          onChange={onChange('kf')}
        />
        <TextField
          id='temperatureOffset'
          label='Temperature offset'
          unit='°C'
          type='number'
          step='any'
          placeholder='0'
          value={formData.temperatureOffset}
          onChange={onChange('temperatureOffset')}
        />
      </Tile>

      <Tile title='Pump'>
        <TextField
          id='pumpModelCoeffs'
          label='Pump flow coefficients'
          help='Enter 2 values (flow at 1 bar, flow at 9 bar).'
          type='text'
          placeholder='10.205,5.521'
          value={formData.pumpModelCoeffs}
          onChange={onChange('pumpModelCoeffs')}
        />
        <TextField
          id='steamPumpPercentage'
          label='Steam pump assist'
          unit={hasPressure ? 'ml/s' : '%'}
          help={
            hasPressure
              ? 'How many ml/s to pump into the boiler during steaming.'
              : 'What percentage to run the pump at during steaming.'
          }
          type='number'
          step='0.1'
          placeholder='0.0'
          value={steamPumpDraft ?? String(formData.steamPumpPercentage / (hasPressure ? 10 : 1))}
          onChange={e => setSteamPumpDraft(e.target.value)}
          onBlur={e => {
            setSteamPumpDraft(null);
            setField(
              'steamPumpPercentage',
              (parseFloat(e.target.value) * (pressureAvailable.value ? 10 : 1)).toFixed(0),
            );
          }}
        />
        {hasPressure && (
          <TextField
            id='steamPumpCutoff'
            label='Pump assist cutoff'
            unit='bar'
            help='At how many bars should the pump assist stop. This makes it so the pump will only run when steam is flowing.'
            type='number'
            step='any'
            placeholder='0.0'
            value={formData.steamPumpCutoff}
            onChange={onChange('steamPumpCutoff')}
          />
        )}
      </Tile>

      {hasPressure && (
        <Tile title='Pressure sensor' className='md:row-span-2'>
          <TextField
            id='pressureOffset'
            label='Pressure offset'
            unit='bar'
            help='Cracking pressure of a grouphead mushroom valve (e.g. 4.0 on Delonghi machines). Subtracted from readings and added to targets only while a brew is running. Leave at 0.0 for a 3-way solenoid.'
            type='number'
            step='any'
            placeholder='0.0'
            value={formData.pressureOffset}
            onChange={onChange('pressureOffset')}
          />
          <TextField
            id='pressureScaling'
            label='Pressure sensor rating'
            unit='bar'
            help='Enter the bar rating of the pressure sensor being used.'
            type='number'
            step='any'
            placeholder='0.0'
            value={formData.pressureScaling}
            onChange={onChange('pressureScaling')}
          />
        </Tile>
      )}

      <Tile title='Temperature settings'>
        <div className='grid grid-cols-2 gap-3'>
          <TextField
            id='targetSteamTemp'
            label='Default steam temperature'
            unit='°C'
            type='number'
            placeholder='135'
            value={formData.targetSteamTemp}
            onChange={onChange('targetSteamTemp')}
          />
          <TextField
            id='targetWaterTemp'
            label='Default water temperature'
            unit='°C'
            type='number'
            placeholder='80'
            value={formData.targetWaterTemp}
            onChange={onChange('targetWaterTemp')}
          />
        </div>
      </Tile>

      <Tile title='Relay'>
        <SegmentedField
          label='Alt relay / SSR2 function'
          help='Steam boiler is coming soon.'
          options={ALT_RELAY_FUNCTIONS}
          value={Number(formData.altRelayFunction ?? 1)}
          onChange={value => setField('altRelayFunction', value)}
        />
      </Tile>

      {ledControl.value && (
        <Tile title='Alba settings' className='md:col-span-2'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            <div className='flex flex-col gap-3'>
              <TankDistanceField
                id='emptyTankDistance'
                label='Distance from sensor to bottom of the tank'
                value={formData.emptyTankDistance}
                onChange={onChange('emptyTankDistance')}
                onUseCurrent={() => setField('emptyTankDistance', tofDistance.value)}
              />
              <TankDistanceField
                id='fullTankDistance'
                label='Distance from sensor to the fill line'
                value={formData.fullTankDistance}
                onChange={onChange('fullTankDistance')}
                onUseCurrent={() => setField('fullTankDistance', tofDistance.value)}
              />
            </div>
            <div className='flex flex-col gap-3'>
              <div className='grid grid-cols-2 gap-2'>
                <SunriseColor
                  id='sunriseIdle'
                  label='Idle color'
                  value={formData.sunriseIdle}
                  fallback='#00ffff'
                  onChange={onChange('sunriseIdle')}
                />
                <SunriseColor
                  id='sunriseActive'
                  label='Brew color'
                  value={formData.sunriseActive}
                  fallback='#0000ff'
                  onChange={onChange('sunriseActive')}
                />
                <SunriseColor
                  id='sunriseFinished'
                  label='Finished color'
                  value={formData.sunriseFinished}
                  fallback='#00ff00'
                  onChange={onChange('sunriseFinished')}
                />
                <SunriseColor
                  id='sunriseError'
                  label='Error color'
                  value={formData.sunriseError}
                  fallback='#ff0000'
                  onChange={onChange('sunriseError')}
                />
              </div>
              <StepperSetting
                label='External LED'
                value={`${ledPercent}%`}
                canDecrease={ledBrightness > 0}
                canIncrease={ledBrightness < LED_MAX}
                decreaseLabel='Dim the external LED'
                increaseLabel='Brighten the external LED'
                onDecrease={() => setLedPercent((Math.ceil(ledPercent / LED_STEP) - 1) * LED_STEP)}
                onIncrease={() => setLedPercent((Math.floor(ledPercent / LED_STEP) + 1) * LED_STEP)}
              />
            </div>
          </div>
        </Tile>
      )}
    </div>
  );
}
