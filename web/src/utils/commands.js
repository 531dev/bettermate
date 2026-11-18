import { effect, signal } from '@preact/signals';
import { announce, toast } from '../components/Toast.jsx';
import { machine } from '../services/ApiService.js';

// A start or stop pressed and not yet confirmed by the machine (design, Product states, Command
// pending): the ActionBanner says STARTING or STOPPING with a Loader, the other modes lock, and
// after 2 s without an answer the control returns and a Toast says so.

const LIMIT_MS = 2000;

/** { label: 'Starting' | 'Stopping' | 'Waking' } while a command waits, or null. */
export const pendingCommand = signal(null);

let stopWatching = null;
let timer = 0;

/** The machine answered some other way (it asked to confirm a shot first). */
export function settleCommand() {
  clearTimeout(timer);
  stopWatching?.();
  stopWatching = null;
  pendingCommand.value = null;
}

/**
 * Sends a command and waits for the machine to confirm it.
 *   label      'Starting', 'Stopping' or 'Waking'
 *   run        sends it
 *   confirmed  status => true once the machine shows it
 */
export function sendCommand(label, run, confirmed) {
  if (pendingCommand.peek()) return;
  try {
    run();
  } catch {
    toast('The machine did not answer. Try again.', { alert: true });
    return;
  }
  pendingCommand.value = { label };
  announce(`${label}.`);
  timer = setTimeout(() => {
    settleCommand();
    toast('The machine did not answer. Try again.', { alert: true });
  }, LIMIT_MS);
  // Checked from the next status frame on, not against the one already shown.
  let first = true;
  stopWatching = effect(() => {
    const status = machine.value.status;
    if (first) {
      first = false;
      return;
    }
    if (confirmed(status)) queueMicrotask(settleCommand);
  });
}
