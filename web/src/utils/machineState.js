import { computed, effect, signal } from '@preact/signals';
import { toast } from '../components/Toast.jsx';
import { machine } from '../services/ApiService.js';

// The product states of the web app that are about the machine as a whole (design, Product
// states), from what the WebSocket already reports: whether it is open, the display's system
// state (`sys`), and the OTA events. Nothing here changes the contract.

// ── Connection: Connecting, then Offline after 5 s without one ──────────────────────────────

const GRACE_MS = 5000;
/** 'connecting', 'online' or 'offline'. */
export const connection = signal('connecting');
let api = null;
let graceTimer = 0;

const armGrace = () => {
  clearTimeout(graceTimer);
  graceTimer = setTimeout(() => {
    if (!machine.peek().connected) connection.value = 'offline';
  }, GRACE_MS);
};

/** When the machine last sent anything, or null if it has not since the page opened. */
export const lastSeen = computed(() => machine.value.status.timestamp ?? null);

/** TRY AGAIN: open the connection now instead of at the next retry. */
export function retryConnection() {
  if (machine.peek().connected) return;
  connection.value = 'connecting';
  armGrace();
  api?.reconnect();
}

// ── Faults: what blocks brewing ──────────────────────────────────────────────────────────────

const RUNAWAY = 4;

/**
 * The fault that blocks brewing, as its Notice says it, or null: the controller reports an error,
 * the display cannot find the controller, or the two do not match.
 *   { key, title, text, chip, link? }
 */
export const fault = computed(() => {
  if (!machine.value.connected) return null;
  const sys = machine.value.status.system;
  switch (sys?.state) {
    case 'error':
      return sys.code === RUNAWAY
        ? {
            key: 'runaway',
            title: 'Boiler temperature runaway',
            text: 'Heating is off. Let the machine cool, then switch it off and on again.',
          }
        : {
            key: 'error',
            title: 'The controller reported a fault',
            text: `Heating is off. Switch the machine off and on again. If it comes back, check the controller (code ${sys.code}).`,
          };
    case 'waiting':
      return {
        key: 'waiting',
        title: 'Controller not found',
        text: 'The display cannot reach the controller. Check the cable between them, then switch the machine off and on again.',
      };
    case 'mismatch':
      return {
        key: 'mismatch',
        title: 'The display and controller do not match',
        text: /display/i.test(sys.message)
          ? 'Brewing is off until they match. Update the display in Settings.'
          : 'Brewing is off until they match. Update the controller in Settings.',
        link: { href: '/settings/system', label: 'Open updates' },
      };
    default:
      return null;
  }
});

// ── Updates: ready, installing, finished or failed ───────────────────────────────────────────

const STORED = 'bettermate.updatedTo';
const stored = () => {
  try {
    return sessionStorage.getItem(STORED);
  } catch {
    return null;
  }
};

/**
 *   info      the last res:ota-settings: versions and which part has an update
 *   phase     the evt:ota-progress phase: 0 idle, 1 display, 2 filesystem, 3 controller,
 *             4 finished, 5 failed
 *   progress  percent of the phase
 *   restarting  installed, waiting for the machine to come back
 *   updatedTo   the version just installed, until the Notice saying so is dismissed
 *   failed      the last update gave up
 */
export const ota = signal({
  info: null,
  phase: 0,
  progress: 0,
  restarting: false,
  updatedTo: stored(),
  failed: false,
});

/** Firmware is being installed: the Updating page takes the window. */
export const updating = computed(
  () =>
    (ota.value.phase >= 1 && ota.value.phase <= 3) ||
    ota.value.restarting ||
    machine.value.status.system?.state === 'updating',
);

/** The version an update would install, when the machine has said. */
export const updateVersion = computed(() => ota.value.info?.latestVersion || null);

/** Start installing: the display's firmware first when both parts have one. */
// An install the machine never reports on is given up after this long.
const START_LIMIT_MS = 10000;
let startTimer = 0;

/**
 * Start installing `part` ('display' or 'controller'); left out, the display's firmware when it
 * has one, else the controller's. The Updating page shows at once and waits for the machine's
 * progress; without any it returns after 10 s and says so.
 */
export function installUpdate(part) {
  const info = ota.peek().info;
  const which =
    part ||
    (info?.controllerUpdateAvailable && !info?.displayUpdateAvailable ? 'controller' : 'display');
  try {
    api.send({ tp: 'req:ota-start', cp: which });
  } catch {
    toast('The machine did not answer. Try again.', { alert: true });
    return;
  }
  ota.value = { ...ota.peek(), failed: false, phase: which === 'display' ? 1 : 3, progress: 0 };
  clearTimeout(startTimer);
  startTimer = setTimeout(() => {
    ota.value = { ...ota.peek(), phase: 0, progress: 0 };
    toast('The machine did not answer. Try again.', { alert: true });
  }, START_LIMIT_MS);
}

export function dismissUpdateResult() {
  try {
    sessionStorage.removeItem(STORED);
  } catch {
    // Nothing kept.
  }
  ota.value = { ...ota.peek(), updatedTo: null, failed: false };
}

/** Asks the machine for its versions, once, so the update Notice can name one. */
export function requestUpdateInfo() {
  if (ota.peek().info) return;
  try {
    api?.send({ tp: 'req:ota-settings' });
  } catch {
    // Not connected yet; the Notice says "An update is ready" until it is.
  }
}

// ── Start ────────────────────────────────────────────────────────────────────────────────────

const RESTART_WAIT_MS = 20000;

export function startMachineState(apiService) {
  api = apiService;
  armGrace();
  let was = false;
  let droppedWhileRestarting = false;
  let restartTimer = 0;

  const finishRestart = () => {
    clearTimeout(restartTimer);
    droppedWhileRestarting = false;
    ota.value = { ...ota.peek(), restarting: false };
  };

  effect(() => {
    const up = machine.value.connected;
    if (up === was) return;
    was = up;
    if (up) {
      clearTimeout(graceTimer);
      connection.value = 'online';
      if (ota.peek().restarting && droppedWhileRestarting) finishRestart();
    } else {
      connection.value = 'connecting';
      armGrace();
      if (ota.peek().restarting) droppedWhileRestarting = true;
    }
  });

  apiService.on('res:ota-settings', info => (ota.value = { ...ota.peek(), info }));
  apiService.on('evt:ota-progress', ({ phase, progress }) => {
    clearTimeout(startTimer);
    const now = ota.peek();
    if (phase === 4 && !now.restarting && now.phase !== 4) {
      const version = now.info?.latestVersion || 'the new version';
      try {
        sessionStorage.setItem(STORED, version);
      } catch {
        // Shown until the page closes instead.
      }
      // The display restarts after installing its own firmware; the controller's does not
      // restart the display. Either way the page waits for the machine to be back.
      clearTimeout(restartTimer);
      restartTimer = setTimeout(finishRestart, RESTART_WAIT_MS);
      ota.value = { ...now, phase, progress: 100, restarting: true, updatedTo: version };
      return;
    }
    if (phase === 5) {
      ota.value = { ...now, phase, progress, restarting: false, failed: true };
      return;
    }
    ota.value = { ...now, phase, progress };
  });
}
