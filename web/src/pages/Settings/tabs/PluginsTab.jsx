import { computed } from '@preact/signals';
import homekitImage from '../../../assets/homekit.png';
import { machine } from '../../../services/ApiService.js';
import { Chip } from '../../../components/Chip.jsx';
import { Cell } from '../../../components/Tile.jsx';
import { FormField, PasswordField, SegmentedField } from '../../../components/FormField.jsx';
import { TILE_GRID } from '../grid.js';
import { PluginCard, WakeSchedules } from '../PluginCard.jsx';
import { Notice } from '../../../components/Notice.jsx';

const gearpumpAddon = computed(() => machine.value.capabilities.gearpumpAddon);

// What the Tasmota plug does around a grind. `help` is the mode in full, shown under the choice.
const SMART_GRIND_MODES = [
  { value: 0, label: 'Turn off', help: 'Turn off at target.' },
  { value: 1, label: 'Toggle', help: 'Toggle off and on at target.' },
  { value: 2, label: 'On, then off', help: 'Turn on at start, off at target.' },
];

export function PluginsTab({
  formData,
  onChange,
  autowakeupSchedules,
  addAutoWakeupSchedule,
  removeAutoWakeupSchedule,
  updateAutoWakeupTime,
  updateAutoWakeupDay,
}) {
  const smartGrindMode = Number(formData.smartGrindMode ?? 0);

  return (
    <div className={TILE_GRID}>
      <PluginCard
        id='autowakeupEnabled'
        title='Automatic wakeup schedule'
        help='Automatically switch to brew mode at specified times of day.'
        enableLabel='Enable auto wakeup'
        checked={formData.autowakeupEnabled}
        onChange={onChange('autowakeupEnabled')}
        className='md:col-span-2'
      >
        <WakeSchedules
          schedules={autowakeupSchedules}
          onAdd={addAutoWakeupSchedule}
          onRemove={removeAutoWakeupSchedule}
          onTimeChange={updateAutoWakeupTime}
          onDayChange={updateAutoWakeupDay}
        />
      </PluginCard>

      <PluginCard
        id='homekit'
        title='HomeKit'
        help='Control the machine from the Home app on your Apple devices.'
        enableLabel='Enable HomeKit'
        checked={formData.homekit}
        onChange={onChange('homekit')}
      >
        <Cell className='items-center'>
          <img src={homekitImage} alt='HomeKit setup code' width='194' height='80' />
        </Cell>
        <p className='bm-help'>
          Open the Home app on your iOS device, select Add Accessory, and enter the setup code shown
          above.
        </p>
      </PluginCard>

      <PluginCard
        id='boilerFillActive'
        title='Boiler refill plugin'
        help='Runs the pump to refill the boiler on startup and after steaming.'
        enableLabel='Enable boiler refill'
        checked={formData.boilerFillActive}
        onChange={onChange('boilerFillActive')}
      >
        {/* Side by side from 288px of tile; narrower, the second label would wrap and its input drop. */}
        <div className='@container'>
          <div className='grid grid-cols-1 gap-3 @2xs:grid-cols-2'>
            <FormField
              id='startupFillTime'
              label='On startup'
              unit='s'
              type='number'
              placeholder='0'
              value={formData.startupFillTime}
              onChange={onChange('startupFillTime')}
            />
            <FormField
              id='steamFillTime'
              label='On steam deactivate'
              unit='s'
              type='number'
              placeholder='0'
              value={formData.steamFillTime}
              onChange={onChange('steamFillTime')}
            />
          </div>
        </div>
      </PluginCard>

      <PluginCard
        id='smartGrindActive'
        title='Smart grind plugin'
        help='Controls a Tasmota plug to turn off your grinder after the target has been reached.'
        enableLabel='Enable smart grind'
        checked={formData.smartGrindActive}
        onChange={onChange('smartGrindActive')}
      >
        <FormField
          id='smartGrindIp'
          label='Tasmota IP'
          type='text'
          value={formData.smartGrindIp}
          onChange={onChange('smartGrindIp')}
        />
        <SegmentedField
          label='Mode'
          options={SMART_GRIND_MODES}
          value={smartGrindMode}
          help={SMART_GRIND_MODES.find(mode => mode.value === smartGrindMode)?.help}
          onChange={value => onChange('smartGrindMode')({ currentTarget: { value } })}
        />
      </PluginCard>

      <PluginCard
        id='homeAssistant'
        title='Home Assistant over MQTT'
        chip={<Chip tone='warning'>Deprecated</Chip>}
        help='Connects to a Home Assistant or MQTT installation and pushes the current state.'
        enableLabel='Enable Home Assistant'
        checked={formData.homeAssistant}
        onChange={onChange('homeAssistant')}
      >
        <Notice tone='warning' title='Deprecated for Home Assistant'>
          The{' '}
          <a
            className='bm-link'
            href='https://github.com/gaggimate/ha-integration'
            target='_blank'
            rel='noreferrer'
          >
            Home Assistant integration
          </a>{' '}
          replaces it.
        </Notice>
        <FormField
          id='haIP'
          label='MQTT IP'
          type='text'
          value={formData.haIP}
          onChange={onChange('haIP')}
        />
        <FormField
          id='haPort'
          label='MQTT port'
          type='number'
          placeholder='1883'
          value={formData.haPort}
          onChange={onChange('haPort')}
        />
        <FormField
          id='haUser'
          label='MQTT user'
          type='text'
          value={formData.haUser}
          onChange={onChange('haUser')}
        />
        <PasswordField
          id='haPassword'
          label='MQTT password'
          value={formData.haPassword}
          onChange={onChange('haPassword')}
        />
        <FormField
          id='haTopic'
          label='Home Assistant discovery topic'
          type='text'
          value={formData.haTopic}
          onChange={onChange('haTopic')}
        />
      </PluginCard>

      {gearpumpAddon.value && (
        <PluginCard
          id='bldcPump'
          title='BLDC pump settings'
          help='The BLDC pump addon was detected in your system. You can change the pump control characteristics using the values below.'
          className='md:col-span-2'
        >
          <FormField
            id='commutationGain'
            label='Commutation gain'
            type='number'
            placeholder='0'
            min='0'
            max='100'
            step='any'
            value={formData.commutationGain?.toString()}
            onChange={onChange('commutationGain')}
          />
          <FormField
            id='convergenceGain'
            label='Convergence gain'
            type='number'
            placeholder='0'
            min='0'
            max='100'
            step='any'
            value={formData.convergenceGain?.toString()}
            onChange={onChange('convergenceGain')}
          />
          <FormField
            id='integralGain'
            label='Integral gain'
            type='number'
            placeholder='0'
            min='0'
            max='100'
            step='any'
            value={formData.integralGain?.toString()}
            onChange={onChange('integralGain')}
          />
          <FormField
            id='maxPumpPower'
            label='Maximum pump power'
            help='From 0 to 1.'
            type='number'
            placeholder='0'
            min='0'
            max='1'
            step='any'
            value={formData.maxPumpPower?.toString()}
            onChange={onChange('maxPumpPower')}
          />
          <FormField
            id='pumpSlipCoeffs'
            label='Pump slip coefficients'
            help='Pressure polynomial (a,b,c,d) for vane-/gear-pump internal leakage. Leave at 0,0,0,0 if uncalibrated.'
            type='text'
            placeholder='0,0,0,0'
            value={formData.pumpSlipCoeffs}
            onChange={onChange('pumpSlipCoeffs')}
          />
        </PluginCard>
      )}
    </div>
  );
}
