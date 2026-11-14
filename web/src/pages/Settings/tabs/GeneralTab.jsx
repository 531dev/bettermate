import { useLocation } from 'preact-iso';
import { timezones } from '../../../config/zones.js';
import {
  DASHBOARD_LAYOUTS,
  DASHBOARD_MODES,
  dashboardLayoutSignal,
  dashboardModeSignal,
  setDashboardMode,
} from '../../../utils/dashboardManager.js';
import { ToggleField } from '../../../components/SettingsFormField.jsx';
import { Tile } from '../../../components/Tile.jsx';
import { WarningIcon } from '../../../components/WarningIcon.jsx';
import { WARNING_LEVELS, WARNINGS } from '../../../utils/warnings.js';
import {
  PasswordField,
  SegmentedField,
  SelectField,
  StepperSetting,
  TextField,
  TILE_GRID,
} from '../fields.jsx';

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const DASHBOARD_VIEWS = [
  {
    value: DASHBOARD_MODES.SIMPLE,
    label: 'Simple',
    help: 'Simple shows only what changes your next step.',
  },
  {
    value: DASHBOARD_MODES.ADVANCED,
    label: 'Advanced',
    help: 'Advanced adds every reading, its target and the live chart.',
  },
  {
    value: DASHBOARD_MODES.CUSTOM,
    label: 'Customize',
    help: 'Customize keeps the panels you arranged.',
  },
];

const DASHBOARD_LAYOUT_OPTIONS = [
  { value: DASHBOARD_LAYOUTS.ORDER_FIRST, label: 'Controls first' },
  { value: DASHBOARD_LAYOUTS.ORDER_LAST, label: 'Chart first' },
];

const STARTUP_MODES = [
  { value: 'standby', label: 'Standby' },
  { value: 'brew', label: 'Brew' },
];

// The values the display firmware reads as its theme.
const DISPLAY_THEMES = [
  { value: 0, label: 'Dark' },
  { value: 1, label: 'Light' },
  { value: 2, label: 'AMOLED' },
];

const WARNING_OPTIONS = WARNING_LEVELS.map(level => ({ value: level.value, label: level.label }));

const FLUSH_STEP = 5;
const FLUSH_MAX = 20;
const BRIGHTNESS_MAX = 16;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
// A stored level as a number on its scale; anything unreadable falls back.
const level = (value, low, fallback) => {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? clamp(Math.round(number), low, BRIGHTNESS_MAX) : fallback;
};

function DashboardView() {
  const { route } = useLocation();
  const view = dashboardModeSignal.value;
  return (
    <SegmentedField
      label='Dashboard view'
      options={DASHBOARD_VIEWS}
      value={view}
      help={DASHBOARD_VIEWS.find(option => option.value === view)?.help}
      onChange={next => {
        setDashboardMode(next);
        if (next === DASHBOARD_MODES.CUSTOM) route('/dashboard-settings');
      }}
    >
      {view === DASHBOARD_MODES.CUSTOM && (
        <a href='/dashboard-settings' className='bm-link self-start'>
          Edit layout
        </a>
      )}
    </SegmentedField>
  );
}

function ButtonBehaviorSelect({ id, label, value, onChange, profiles }) {
  return (
    <SelectField id={id} label={label} value={value} onChange={onChange}>
      <option value='none'>None</option>
      <option value='brew'>Brew button</option>
      <option value='steam'>Steam button</option>
      <option value='water'>Water button</option>
      <option value='flush'>Flush</option>
      {profiles.map(p => (
        <option key={p.id} value={p.id}>
          Profile: {p.label}
        </option>
      ))}
    </SelectField>
  );
}

function WarningLevel({ warning, value, onChange }) {
  return (
    <SegmentedField
      label={
        <span className='flex items-center gap-2'>
          <WarningIcon icon={warning.icon} size={18} className='text-(--ink-muted)' />
          {warning.label}
        </span>
      }
      name={`${warning.label} severity`}
      options={WARNING_OPTIONS}
      value={Number(value ?? 1)}
      onChange={onChange}
    />
  );
}

export function GeneralTab({
  formData,
  onChange,
  profiles,
  currentTheme,
  setCurrentTheme,
  handleThemeChange,
}) {
  // A control that is not a native input reports its value the way one would.
  const pick = key => value => onChange(key)({ currentTarget: { value } });

  // Snap legacy free-form values onto the 5 s steps the control offers.
  const flushDuration = clamp(
    Math.round(Number(formData.flushDuration ?? FLUSH_STEP) / FLUSH_STEP) * FLUSH_STEP,
    0,
    FLUSH_MAX,
  );
  const mainBrightness = level(formData.mainBrightness, 1, BRIGHTNESS_MAX);
  const standbyOn = !!formData.standbyDisplayEnabled;
  const standbyBrightness = standbyOn ? level(formData.standbyBrightness, 0, 0) : 0;

  return (
    <div className={TILE_GRID}>
      <Tile title='Web settings'>
        <SegmentedField
          label='Theme'
          options={THEMES}
          value={currentTheme}
          onChange={theme => {
            setCurrentTheme(theme);
            handleThemeChange({ target: { value: theme } });
          }}
        />
        <DashboardView />
        {dashboardModeSignal.value === DASHBOARD_MODES.CUSTOM && (
          <SegmentedField
            label='Dashboard layout'
            options={DASHBOARD_LAYOUT_OPTIONS}
            value={dashboardLayoutSignal.value}
            onChange={pick('dashboardLayout')}
          />
        )}
      </Tile>

      <Tile title='User preferences'>
        <SegmentedField
          label='Startup mode'
          options={STARTUP_MODES}
          value={formData.startupMode === 'brew' ? 'brew' : 'standby'}
          onChange={pick('startupMode')}
        />
        <SelectField
          id='startup-profile'
          name='startupProfile'
          label='Startup profile'
          value={formData.startupProfile || ''}
          onChange={onChange('startupProfile')}
        >
          <option value=''>Last used profile</option>
          {profiles.map(profile => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </SelectField>
        <TextField
          id='standbyTimeout'
          label='Standby timeout'
          unit='s'
          type='number'
          placeholder='0'
          value={formData.standbyTimeout}
          onChange={onChange('standbyTimeout')}
        />
      </Tile>

      <Tile title='Physical buttons' className='md:row-span-2'>
        <p className='bm-help'>
          Define behavior for physical buttons when pressed. Make sure they are wired to the buttons
          header. Pressing the brew and steam buttons together (or a third button wired to both)
          triggers the water button behavior.
        </p>
        <ToggleField
          label='Momentary buttons'
          htmlFor='momentaryButtons'
          helpText='Activate this if your coffee machine is equipped with momentary buttons. A momentary button set to Brew or a profile starts a flush instead when held.'
          checked={!!formData.momentaryButtons}
          onChange={onChange('momentaryButtons')}
        />
        <ButtonBehaviorSelect
          id='button0'
          label='Brew button behavior'
          value={formData.button0}
          onChange={onChange('button0')}
          profiles={profiles}
        />
        <ButtonBehaviorSelect
          id='button1'
          label='Steam button behavior'
          value={formData.button1}
          onChange={onChange('button1')}
          profiles={profiles}
        />
        <ButtonBehaviorSelect
          id='button2'
          label='Water button behavior'
          value={formData.button2}
          onChange={onChange('button2')}
          profiles={profiles}
        />
      </Tile>

      <Tile title='Predictive scale delay'>
        <p className='bm-help'>
          Shuts off the process ahead of time based on the flow rate to account for any dripping or
          delays in the control.
        </p>
        <ToggleField
          label='Auto adjust'
          htmlFor='delayAdjust'
          checked={!!formData.delayAdjust}
          onChange={onChange('delayAdjust')}
        />
        <div className='grid grid-cols-2 gap-3'>
          <TextField
            id='brewDelay'
            label='Brew'
            unit='ms'
            type='number'
            step='any'
            placeholder='0'
            value={formData.brewDelay}
            onChange={onChange('brewDelay')}
          />
          <TextField
            id='grindDelay'
            label='Grind'
            unit='ms'
            type='number'
            step='any'
            placeholder='0'
            value={formData.grindDelay}
            onChange={onChange('grindDelay')}
          />
        </div>
      </Tile>

      <Tile title='Flush'>
        <StepperSetting
          label='Flush duration'
          help='Hold runs the flush for as long as the button is held. The valve stays open for one more second after the pump stops.'
          value={flushDuration === 0 ? 'Hold' : `${flushDuration} s`}
          canDecrease={flushDuration > 0}
          canIncrease={flushDuration < FLUSH_MAX}
          decreaseLabel='Shorter flush'
          increaseLabel='Longer flush'
          onDecrease={() => pick('flushDuration')(flushDuration - FLUSH_STEP)}
          onIncrease={() => pick('flushDuration')(flushDuration + FLUSH_STEP)}
        />
      </Tile>

      <Tile title='Display settings'>
        <StepperSetting
          label='Main brightness'
          help='From 1 to 16.'
          value={mainBrightness}
          canDecrease={mainBrightness > 1}
          canIncrease={mainBrightness < BRIGHTNESS_MAX}
          decreaseLabel='Lower main brightness'
          increaseLabel='Raise main brightness'
          onDecrease={() => pick('mainBrightness')(mainBrightness - 1)}
          onIncrease={() => pick('mainBrightness')(mainBrightness + 1)}
        />
        <SegmentedField
          label='Display theme'
          options={DISPLAY_THEMES}
          value={Number(formData.themeMode ?? 0)}
          onChange={pick('themeMode')}
        />
      </Tile>

      <Tile title='Standby display' className='md:row-span-2'>
        <ToggleField
          label='Enable standby display'
          htmlFor='standbyDisplayEnabled'
          checked={standbyOn}
          onChange={onChange('standbyDisplayEnabled')}
        />
        <StepperSetting
          label='Standby brightness'
          help='From 0 to 16. When the switch is off, brightness is set to 0.'
          value={standbyBrightness}
          disabled={!standbyOn}
          canDecrease={standbyBrightness > 0}
          canIncrease={standbyBrightness < BRIGHTNESS_MAX}
          decreaseLabel='Lower standby brightness'
          increaseLabel='Raise standby brightness'
          onDecrease={() => pick('standbyBrightness')(standbyBrightness - 1)}
          onIncrease={() => pick('standbyBrightness')(standbyBrightness + 1)}
        />
        <TextField
          id='standbyBrightnessTimeout'
          label='Standby brightness timeout'
          unit='s'
          type='number'
          min='1'
          placeholder='60'
          value={formData.standbyBrightnessTimeout}
          onChange={onChange('standbyBrightnessTimeout')}
        />
      </Tile>

      <Tile title='Clock'>
        <ToggleField
          label='Use 24h format'
          htmlFor='clock24hFormat'
          checked={!!formData.clock24hFormat}
          onChange={onChange('clock24hFormat')}
        />
      </Tile>

      <Tile title='System & network'>
        <TextField
          id='wifiSsid'
          label='Wi-Fi SSID'
          type='text'
          value={formData.wifiSsid}
          onChange={onChange('wifiSsid')}
        />
        <PasswordField
          id='wifiPassword'
          label='Wi-Fi password'
          value={formData.wifiPassword}
          onChange={onChange('wifiPassword')}
        />
        <PasswordField
          id='apPassword'
          label='Access point password'
          help='Used for the BetterMate hotspot when no Wi-Fi is configured (min. 8 characters).'
          minLength={8}
          maxLength={63}
          value={formData.apPassword}
          onChange={onChange('apPassword')}
        />
        <TextField
          id='mdnsName'
          label='Hostname'
          type='text'
          value={formData.mdnsName}
          onChange={onChange('mdnsName')}
        />
        <SelectField
          id='timezone'
          label='Time zone'
          value={formData.timezone}
          onChange={onChange('timezone')}
        >
          {timezones.map(tz => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </SelectField>
        <a href='/setup' className='bm-link self-start'>
          Connect to Wi-Fi step by step
        </a>
      </Tile>

      <Tile title='Warnings'>
        <p className='bm-help'>
          Warnings are shown on the display. An error additionally asks for confirmation before a
          brew starts.
        </p>
        {WARNINGS.map(warning => (
          <WarningLevel
            key={warning.key}
            warning={warning}
            value={formData[warning.settingKey]}
            onChange={pick(warning.settingKey)}
          />
        ))}
      </Tile>
    </div>
  );
}
