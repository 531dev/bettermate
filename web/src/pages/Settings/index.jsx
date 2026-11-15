import { computed } from '@preact/signals';
import { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import {
  ApiServiceContext,
  machine,
  prefetchSettings,
  updateSettingsCache,
  getCachedSettings,
} from '../../services/ApiService.js';
import {
  DASHBOARD_LAYOUTS,
  setDashboardLayout,
  setClock24h,
} from '../../utils/dashboardManager.js';
import { downloadJson } from '../../utils/download.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';

import { Menu, MenuItem } from '../../components/Menu.jsx';
import PageLayout from '../../components/PageLayout.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import TabBar from '../../components/TabBar.jsx';

import lazy from 'preact-iso/lazy';

import {
  GeneralTabSkeleton,
  MachineTabSkeleton,
  PluginsTabSkeleton,
  BluetoothTabSkeleton,
  SystemTabSkeleton,
} from '../../components/skeletons/SettingsSkeletons.jsx';
import { FormErrors } from '../../components/FormField.jsx';
import { ImportNotice } from './ImportNotice.jsx';
import { PinnedSave, RestartTile } from './SaveBar.jsx';
import { GeneralTab } from './tabs/GeneralTab.jsx';

const LazyMachineTab = lazy(() => import('./tabs/MachineTab.jsx').then(m => m.MachineTab));
const LazyCalibrationTab = lazy(() =>
  import('./tabs/CalibrationTab.jsx').then(m => m.CalibrationTab),
);
const LazyPluginsTab = lazy(() => import('./tabs/PluginsTab.jsx').then(m => m.PluginsTab));
const LazyBluetoothTab = lazy(() => import('./tabs/BluetoothTab.jsx').then(m => m.BluetoothTab));
const LazySystemTab = lazy(() => import('./tabs/SystemTab.jsx').then(m => m.SystemTab));

const loadMachineTab = () => import('./tabs/MachineTab.jsx');
const loadCalibrationTab = () => import('./tabs/CalibrationTab.jsx');
const loadPluginsTab = () => import('./tabs/PluginsTab.jsx');
const loadBluetoothTab = () => import('./tabs/BluetoothTab.jsx');
const loadSystemTab = () => import('./tabs/SystemTab.jsx');

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: 'sliders-horizontal' },
  { id: 'machine', label: 'Machine', icon: 'thermometer', preload: loadMachineTab },
  { id: 'calibration', label: 'Calibration', icon: 'gauge', preload: loadCalibrationTab },
  { id: 'plugins', label: 'Plugins', icon: 'settings', preload: loadPluginsTab },
  { id: 'bluetooth', label: 'Bluetooth', icon: 'bluetooth', preload: loadBluetoothTab },
  { id: 'system', label: 'System & updates', icon: 'refresh-cw', preload: loadSystemTab },
];
const FORM_TABS = ['general', 'machine', 'plugins'];
const FORM_ID = 'settings-page-form';

// The page only needs to know whether the socket is up, not every telemetry frame.
const connected = computed(() => machine.value.connected);

const CHECKBOX_KEYS = [
  'homekit',
  'boilerFillActive',
  'smartGrindActive',
  'homeAssistant',
  'momentaryButtons',
  'delayAdjust',
  'clock24hFormat',
  'autowakeupEnabled',
  'smartGrindToggle',
];

// Form-only fields that never come back from GET /api/settings.
const FORM_ONLY_KEYS = [
  'kf',
  'button0',
  'button1',
  'button2',
  'standbyDisplayEnabled',
  'dashboardLayout',
];

function splitPidString(pidString) {
  if (!pidString) return { pid: pidString, kf: '0.000' };
  const parts = pidString.split(',');
  if (parts.length >= 4) {
    return { pid: parts.slice(0, 3).join(','), kf: parts[3] };
  }
  return { pid: pidString, kf: '0.000' };
}

function splitButtons(buttonBehavior) {
  if (!buttonBehavior) return {};
  const [button0, button1, button2] = buttonBehavior.split(',');
  return { button0, button1, button2 };
}

function parseAutoWakeupSchedules(autowakeupSchedules) {
  const defaultSchedule = [{ time: '07:00', days: [true, true, true, true, true, true, true] }];
  if (!autowakeupSchedules) {
    return defaultSchedule;
  }
  const schedules = [];
  if (typeof autowakeupSchedules === 'string' && autowakeupSchedules.trim()) {
    const scheduleStrings = autowakeupSchedules.split(';');
    for (const scheduleStr of scheduleStrings) {
      const [time, daysStr] = scheduleStr.split('|');
      if (time && daysStr && daysStr.length === 7) {
        const days = daysStr.split('').map(d => d === '1');
        schedules.push({ time, days });
      }
    }
  }
  return schedules.length > 0 ? schedules : defaultSchedule;
}

function transformFetchedSettings(fetchedSettings) {
  if (!fetchedSettings) return {};
  const buttonFields = fetchedSettings.buttonBehavior
    ? splitButtons(fetchedSettings.buttonBehavior)
    : {};
  const settingsWithToggle = {
    ...fetchedSettings,
    ...buttonFields,
    standbyDisplayEnabled:
      fetchedSettings.standbyDisplayEnabled !== undefined
        ? fetchedSettings.standbyDisplayEnabled
        : fetchedSettings.standbyBrightness > 0,
    dashboardLayout: fetchedSettings.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST,
  };

  if (fetchedSettings.pid) {
    const split = splitPidString(fetchedSettings.pid);
    settingsWithToggle.pid = split.pid;
    settingsWithToggle.kf = split.kf;
  }
  return settingsWithToggle;
}

function serializeAutoWakeupSchedules(autowakeupSchedules) {
  return autowakeupSchedules
    .map(schedule => `${schedule.time}|${schedule.days.map(d => (d ? '1' : '0')).join('')}`)
    .join(';');
}

function isTruthySetting(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

// Maps a full or partial settings file onto form fields; keys the file lacks stay untouched.
function normalizeImportedSettings(data, knownKeys) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The file does not contain a settings object.');
  }
  const fields = {};
  const ignored = [];
  for (const [key, value] of Object.entries(data)) {
    if (!knownKeys.has(key) || value === null || typeof value === 'object') {
      ignored.push(key);
    } else {
      fields[key] = CHECKBOX_KEYS.includes(key) ? isTruthySetting(value) : value;
    }
  }
  const count = Object.keys(fields).length;
  // API-shaped files carry "p,i,d,kf" and "b0,b1,b2"; the form edits those as separate fields.
  if (typeof fields.pid === 'string' && fields.pid.split(',').length >= 4) {
    Object.assign(fields, splitPidString(fields.pid));
  }
  if (fields.buttonBehavior && fields.button0 === undefined) {
    Object.assign(fields, splitButtons(String(fields.buttonBehavior)));
  }
  if (fields.standbyBrightness !== undefined && fields.standbyDisplayEnabled === undefined) {
    fields.standbyDisplayEnabled = Number(fields.standbyBrightness) > 0;
  }
  const schedules =
    fields.autowakeupSchedules !== undefined
      ? parseAutoWakeupSchedules(fields.autowakeupSchedules)
      : null;
  return { fields, schedules, ignored, count };
}

function buildSubmitFormData(formData, autowakeupSchedules, restart) {
  const formDataToSubmit = new FormData();

  for (const [key, value] of Object.entries(formData)) {
    if (value === undefined || value === null) continue;

    if (CHECKBOX_KEYS.includes(key)) {
      // Always explicit: the firmware leaves absent booleans untouched (GM-214).
      formDataToSubmit.set(key, value ? '1' : '0');
    } else {
      formDataToSubmit.set(key, String(value));
    }
  }

  formDataToSubmit.set('steamPumpPercentage', String(formData.steamPumpPercentage ?? 0));
  formDataToSubmit.set(
    'altRelayFunction',
    formData.altRelayFunction !== undefined ? String(formData.altRelayFunction) : '1',
  );
  formDataToSubmit.set(
    'buttonBehavior',
    `${formData.button0},${formData.button1},${formData.button2}`,
  );

  if (formData.pid && formData.kf !== undefined) {
    const combinedPid = `${formData.pid},${formData.kf}`;
    formDataToSubmit.set('pid', combinedPid);
  }

  formDataToSubmit.set('autowakeupSchedules', serializeAutoWakeupSchedules(autowakeupSchedules));

  if (!formData.standbyDisplayEnabled) {
    formDataToSubmit.set('standbyBrightness', '0');
  }

  if (restart) {
    formDataToSubmit.append('restart', '1');
  }

  return formDataToSubmit;
}

// What a save would send, as one string: two forms are the same when their strings are. The web's
// own dashboard layout applies at once and never reaches the machine, so it does not count.
function submitKey(formData, autowakeupSchedules) {
  const entries = [...buildSubmitFormData(formData, autowakeupSchedules, false).entries()];
  return JSON.stringify(entries.filter(([key]) => key !== 'dashboardLayout').sort());
}

// What an input's own constraints (type, min, max, step, minlength) reject, in the page's words.
function problemWith(input) {
  const validity = input.validity;
  if (validity.valid) return null;
  if (validity.badInput) return input.type === 'time' ? 'Enter a time.' : 'Enter a number.';
  if (validity.valueMissing) return 'Enter a value.';
  if (validity.tooShort) return `Use at least ${input.minLength} characters.`;
  if (validity.tooLong) return `Use at most ${input.maxLength} characters.`;
  if (validity.rangeUnderflow) return `Enter ${input.min} or more.`;
  if (validity.rangeOverflow) return `Enter ${input.max} or less.`;
  if (validity.stepMismatch) {
    return Number(input.step || 1) === 1 ? 'Enter a whole number.' : `Use steps of ${input.step}.`;
  }
  return 'Enter another value.';
}

// The same check the browser runs before it submits a form, kept on the page instead of in a
// bubble: every problem by input id, and the first input that has one.
function findProblems(form) {
  const problems = {};
  let first = null;
  for (const input of form.elements) {
    if (!input.willValidate || !input.id) continue;
    const problem = problemWith(input);
    if (!problem) continue;
    problems[input.id] = problem;
    if (!first) first = input;
  }
  return { problems, first };
}

export function Settings() {
  const apiService = useContext(ApiServiceContext);
  const { params } = useRoute();
  const tab = params.tab || 'general';
  const isFormTab = FORM_TABS.includes(tab);

  const [profiles, setProfiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [autowakeupSchedules, setAutoWakeupSchedules] = useState([
    { time: '07:00', days: [true, true, true, true, true, true, true] },
  ]);

  const [importNotice, setImportNotice] = useState(null);
  // By input id, what the last save rejected; and how that save ended.
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState(null);

  const [fetchedSettings, setFetchedSettings] = useState(() => getCachedSettings());
  const [isLoading, setIsLoading] = useState(!fetchedSettings);

  useEffect(() => {
    if (!fetchedSettings) {
      prefetchSettings()
        .then(data => {
          setFetchedSettings(data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Failed to prefetch settings:', err);
          setIsLoading(false);
        });
    }
  }, [fetchedSettings]);

  const isConnected = connected.value;
  useEffect(() => {
    const loadProfiles = async () => {
      if (isConnected) {
        const response = await apiService.request({ tp: 'req:profiles:list', minimal: true });
        setProfiles(response.profiles);
      }
    };
    loadProfiles();
  }, [isConnected, apiService]);

  const formRef = useRef();
  const importRef = useRef();

  useEffect(() => {
    if (fetchedSettings) {
      const settingsWithToggle = transformFetchedSettings(fetchedSettings);
      const parsedSchedules = parseAutoWakeupSchedules(fetchedSettings.autowakeupSchedules);
      setAutoWakeupSchedules(parsedSchedules);
      setClock24h(!!fetchedSettings.clock24hFormat);
      setFormData(settingsWithToggle);
    } else {
      setFormData({});
      setAutoWakeupSchedules([{ time: '07:00', days: [true, true, true, true, true, true, true] }]);
    }
  }, [fetchedSettings]);

  useEffect(() => {
    setCurrentTheme(getStoredTheme());
  }, []);

  // A problem and a "saved" belong to the tab they were found on; a save that did not arrive, or
  // was not answered, stays until the next one.
  useEffect(() => {
    setErrors({});
    setSaveState(state => (state === 'failed' || state === 'unanswered' ? state : null));
  }, [tab]);

  const onChange = key => {
    return e => {
      let value = e.currentTarget.value;
      if (CHECKBOX_KEYS.includes(key)) {
        value = !formData[key];
      }
      if (key === 'clock24hFormat') {
        setClock24h(value);
      }
      if (key === 'standbyDisplayEnabled') {
        value = !formData.standbyDisplayEnabled;
        const newFormData = {
          ...formData,
          [key]: value,
        };
        if (!value) {
          newFormData.standbyBrightness = 0;
        }
        setFormData(newFormData);
        return;
      }
      if (key === 'dashboardLayout') {
        setDashboardLayout(value);
      }
      setFormData({
        ...formData,
        [key]: value,
      });
    };
  };

  const setField = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  // Autotune writes its gains on the machine. The form takes them too, so a later save sends the
  // tuned values instead of the ones it loaded.
  const onPidTuned = useCallback(pid => {
    if (!pid) return;
    const cached = getCachedSettings();
    if (cached) updateSettingsCache({ ...cached, pid });
    setFormData(prev => (Object.keys(prev).length ? { ...prev, ...splitPidString(pid) } : prev));
  }, []);

  const addAutoWakeupSchedule = () => {
    setAutoWakeupSchedules([
      ...autowakeupSchedules,
      {
        time: '07:00',
        days: [true, true, true, true, true, true, true],
      },
    ]);
  };

  const removeAutoWakeupSchedule = index => {
    if (autowakeupSchedules.length > 1) {
      const newSchedules = autowakeupSchedules.filter((_, i) => i !== index);
      setAutoWakeupSchedules(newSchedules);
    }
  };

  const updateAutoWakeupTime = (index, value) => {
    const newSchedules = [...autowakeupSchedules];
    newSchedules[index].time = value;
    setAutoWakeupSchedules(newSchedules);
  };

  const updateAutoWakeupDay = (scheduleIndex, dayIndex, enabled) => {
    const newSchedules = [...autowakeupSchedules];
    newSchedules[scheduleIndex].days[dayIndex] = enabled;
    setAutoWakeupSchedules(newSchedules);
  };

  const onSubmit = useCallback(
    async (e, restart = false) => {
      if (e) e.preventDefault();
      const form = formRef.current;

      const { problems, first } = findProblems(form);
      setErrors(problems);
      if (first) {
        setSaveState(null);
        first.focus({ preventScroll: true });
        first.scrollIntoView({ block: 'center' });
        return;
      }

      setSubmitting(true);
      const formDataToSubmit = buildSubmitFormData(formData, autowakeupSchedules, restart);

      try {
        const response = await fetch(form.action, {
          method: 'post',
          body: formDataToSubmit,
        });
        const data = await response.json();

        const splitPid = data.pid ? splitPidString(data.pid) : null;
        const buttonFields = data.buttonBehavior ? splitButtons(data.buttonBehavior) : {};

        const updatedData = {
          ...data,
          ...(splitPid !== null ? { pid: splitPid.pid, kf: splitPid.kf } : {}),
          ...buttonFields,
          standbyDisplayEnabled:
            data.standbyBrightness > 0 ? formData.standbyDisplayEnabled : false,
        };

        updateSettingsCache(data);
        setFormData(updatedData);
        setImportNotice(null);
        setSaveState(restart ? 'restarting' : 'saved');
      } catch (error) {
        console.error('Failed to save settings:', error);
        // The machine restarts as soon as it has saved, and can be gone before its answer
        // arrives: without an answer, a save with a restart is unknown, not failed.
        setSaveState(restart ? 'unanswered' : 'failed');
      } finally {
        setSubmitting(false);
      }
    },
    [formData, autowakeupSchedules],
  );

  // Editing a field takes its problem away; the next save looks again.
  const onFormInput = useCallback(event => {
    const id = event.target?.id;
    if (!id) return;
    setErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const onExport = useCallback(() => {
    const autowakeupSchedulesStr = serializeAutoWakeupSchedules(autowakeupSchedules);
    downloadJson({ ...formData, autowakeupSchedules: autowakeupSchedulesStr }, 'settings.json');
  }, [formData, autowakeupSchedules]);

  const onUpload = async evt => {
    const input = evt.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      // Merging onto a form that never loaded would save defaults over the real settings.
      if (isLoading || !Object.keys(formData).length) {
        throw new Error('Settings have not loaded yet.');
      }
      const knownKeys = new Set([...Object.keys(formData), ...FORM_ONLY_KEYS]);
      const { fields, schedules, ignored, count } = normalizeImportedSettings(
        JSON.parse(await file.text()),
        knownKeys,
      );
      if (!count) throw new Error('The file contains no known settings.');

      setFormData(prev => ({ ...prev, ...fields }));
      if (schedules) setAutoWakeupSchedules(schedules);
      if (fields.clock24hFormat !== undefined) setClock24h(fields.clock24hFormat);
      if (fields.dashboardLayout !== undefined) setDashboardLayout(fields.dashboardLayout);
      setImportNotice({ error: false, name: file.name, count, ignored });
    } catch (error) {
      setImportNotice({ error: true, name: file.name, message: error.message });
    } finally {
      // Lets the same file be picked again.
      input.value = '';
    }
  };

  const onDiscardImport = useCallback(() => {
    const current = getCachedSettings() ?? fetchedSettings;
    setFormData(transformFetchedSettings(current));
    setAutoWakeupSchedules(parseAutoWakeupSchedules(current?.autowakeupSchedules));
    setClock24h(!!current?.clock24hFormat);
    setImportNotice(null);
  }, [fetchedSettings]);

  // The form is loaded once it holds the machine's settings, and unsaved while a save would send
  // something else than the machine last reported.
  const loaded = !isLoading && Object.keys(formData).length > 0;
  const machineSettings = getCachedSettings() ?? fetchedSettings;
  const dirty = useMemo(() => {
    if (!loaded || !machineSettings) return false;
    const held = submitKey(
      transformFetchedSettings(machineSettings),
      parseAutoWakeupSchedules(machineSettings.autowakeupSchedules),
    );
    return submitKey(formData, autowakeupSchedules) !== held;
  }, [loaded, machineSettings, formData, autowakeupSchedules]);

  const importPending = !!importNotice && !importNotice.error;
  const panel = { role: 'tabpanel', id: `panel-${tab}`, 'aria-labelledby': `tab-${tab}` };

  return (
    <FormErrors.Provider value={errors}>
      <PageLayout>
        <PageHeader
          title='Settings'
          noStack={true}
          tabs={<TabBar tabs={SETTINGS_TABS} activeTab={tab} basePath='/settings' />}
          actions={
            <>
              <Menu label='More options'>
                <MenuItem icon='download' onClick={onExport}>
                  Export settings
                </MenuItem>
                <MenuItem icon='upload' onClick={() => importRef.current?.click()}>
                  Import settings
                </MenuItem>
              </Menu>
              <input
                ref={importRef}
                onChange={onUpload}
                className='hidden'
                id='settingsImport'
                type='file'
                accept='.json,application/json'
                aria-label='Settings file to import'
              />
            </>
          }
        />

        {importNotice && (
          <ImportNotice
            notice={importNotice}
            onDismiss={() => setImportNotice(null)}
            onDiscard={onDiscardImport}
          />
        )}

        <form
          id={FORM_ID}
          key='settings'
          ref={formRef}
          method='post'
          action='/api/settings'
          noValidate
          onSubmit={onSubmit}
          onInput={onFormInput}
          className={isFormTab ? 'flex flex-col gap-2 lg:gap-3' : 'hidden'}
        >
          {isFormTab && (
            <div {...panel}>
              {tab === 'general' &&
                (isLoading ? (
                  <GeneralTabSkeleton />
                ) : (
                  <GeneralTab
                    formData={formData}
                    onChange={onChange}
                    profiles={profiles}
                    currentTheme={currentTheme}
                    setCurrentTheme={setCurrentTheme}
                    handleThemeChange={handleThemeChange}
                  />
                ))}
              {tab === 'machine' &&
                (isLoading ? (
                  <MachineTabSkeleton />
                ) : (
                  <LazyMachineTab formData={formData} onChange={onChange} setField={setField} />
                ))}
              {tab === 'plugins' &&
                (isLoading ? (
                  <PluginsTabSkeleton />
                ) : (
                  <LazyPluginsTab
                    formData={formData}
                    onChange={onChange}
                    autowakeupSchedules={autowakeupSchedules}
                    addAutoWakeupSchedule={addAutoWakeupSchedule}
                    removeAutoWakeupSchedule={removeAutoWakeupSchedule}
                    updateAutoWakeupTime={updateAutoWakeupTime}
                    updateAutoWakeupDay={updateAutoWakeupDay}
                  />
                ))}
            </div>
          )}

          {isFormTab && (
            <RestartTile
              submitting={submitting}
              disabled={!loaded}
              onRestart={() => onSubmit(null, true)}
            />
          )}
        </form>

        {tab === 'calibration' && (
          <div {...panel}>
            <LazyCalibrationTab formData={formData} setField={setField} onPidTuned={onPidTuned} />
          </div>
        )}
        {tab === 'bluetooth' && (
          <div {...panel}>{isLoading ? <BluetoothTabSkeleton /> : <LazyBluetoothTab />}</div>
        )}
        {tab === 'system' && (
          <div {...panel}>{isLoading ? <SystemTabSkeleton /> : <LazySystemTab />}</div>
        )}

        {(isFormTab || dirty || importPending || saveState) && (
          <PinnedSave
            form={FORM_ID}
            submitting={submitting}
            disabled={!loaded}
            invalid={Object.keys(errors).length}
            state={!isLoading && !loaded ? 'unloaded' : saveState}
            dirty={dirty}
          />
        )}
      </PageLayout>
    </FormErrors.Provider>
  );
}
