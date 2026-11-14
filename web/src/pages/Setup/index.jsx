import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Button } from '../../components/Button.jsx';
import { Chip } from '../../components/Chip.jsx';
import { Field, Input } from '../../components/Field.jsx';
import { Icon } from '../../components/Icon.jsx';
import { List, ListRow } from '../../components/ListRow.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { Cell, Tile } from '../../components/Tile.jsx';
import { Wordmark } from '../../components/Wordmark.jsx';
import { dismissSetup } from '../../utils/setupState.js';

const TOTAL_STEPS = 3;
// The restart takes a few seconds; before this the old server may still answer.
const RECONNECT_GRACE_MS = 8000;
const RECONNECT_POLL_MS = 3000;

// One step is one tile: what the step is, its one piece of work, then its actions with the
// primary Button first. Each new step moves focus to its title.
function Step({ step, title, subtitle, children, actions, ...rest }) {
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), [step]);

  return (
    <Tile {...rest}>
      <div className='flex flex-col gap-1'>
        {step > 0 && (
          <span className='bm-eyebrow'>
            Step {step} of {TOTAL_STEPS}
          </span>
        )}
        <h1 ref={headingRef} tabIndex={-1} className='bm-heading outline-none'>
          {title}
        </h1>
        <p className='bm-help'>{subtitle}</p>
      </div>
      {children}
      <div className='flex flex-col gap-2 pt-2'>{actions}</div>
    </Tile>
  );
}

function Welcome({ onStart, onSkip }) {
  return (
    <Step
      step={0}
      title='Welcome to BetterMate'
      subtitle='Precise shots, with your machine, profiles and history in any browser on your Wi-Fi.'
      actions={
        <>
          <Button variant='primary' block onClick={onStart}>
            Get started
          </Button>
          <Button block onClick={onSkip}>
            Skip for now
          </Button>
        </>
      }
    />
  );
}

function WifiStep({ ssid, setSsid, password, setPassword, savedSsid, onBack, onSubmit }) {
  const [shown, setShown] = useState(false);
  const ready = ssid.trim().length > 0;
  const sameNetwork = savedSsid !== '' && ssid.trim() === savedSsid;

  return (
    <Step
      as='form'
      step={1}
      title='Connect to your Wi-Fi'
      subtitle='BetterMate joins your home network so you can reach it from your phone or laptop. This takes about a minute.'
      onSubmit={e => {
        e.preventDefault();
        if (ready) onSubmit();
      }}
      actions={
        <>
          <Button type='submit' variant='primary' block disabled={!ready}>
            Continue
          </Button>
          <Button block onClick={onBack}>
            Back
          </Button>
        </>
      }
    >
      <Field label='Wi-Fi name' htmlFor='setup-ssid'>
        <Input
          id='setup-ssid'
          value={ssid}
          autoComplete='off'
          autoCapitalize='none'
          onInput={e => setSsid(e.target.value)}
          required
        />
      </Field>
      <Field
        label='Password'
        htmlFor='setup-password'
        help='Your password is saved on the machine only.'
      >
        <div className='flex gap-2'>
          <Input
            id='setup-password'
            className='min-w-0 flex-1'
            type={shown ? 'text' : 'password'}
            value={password}
            autoComplete='off'
            placeholder={sameNetwork ? 'Leave blank to keep the saved one' : undefined}
            onInput={e => setPassword(e.target.value)}
          />
          <Button
            iconOnly
            className='shrink-0'
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            onClick={() => setShown(!shown)}
          >
            <Icon name={shown ? 'eye-off' : 'eye'} />
          </Button>
        </div>
      </Field>
    </Step>
  );
}

function JoiningStep({ ssid, hostname, onReconnected }) {
  const [helpOpen, setHelpOpen] = useState(false);

  // Answers again only once the machine is back and this device can still reach it.
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt < RECONNECT_GRACE_MS) return;
      try {
        const resp = await fetch('/api/settings', { cache: 'no-store' });
        const settings = resp.ok ? await resp.json() : null;
        if (settings?.wifiSsid === ssid) onReconnected();
      } catch {
        // Still restarting, or this device is on the old network.
      }
    }, RECONNECT_POLL_MS);
    return () => clearInterval(timer);
  }, [ssid, onReconnected]);

  return (
    <Step
      step={2}
      title={`Joining ${ssid}`}
      subtitle='The machine restarts and connects to your network.'
      actions={
        <>
          <Button block aria-expanded={helpOpen} onClick={() => setHelpOpen(open => !open)}>
            How to reconnect
          </Button>
          {helpOpen && (
            <Cell as='ol' className='list-inside list-decimal'>
              <li>Join {ssid} on this device.</li>
              <li>
                Open{' '}
                <a className='bm-link' href={`http://${hostname}.local`}>
                  {hostname}.local
                </a>
                .
              </li>
              <li>
                If it doesn&apos;t appear, the details may be wrong. The machine then opens its own
                BetterMate hotspot, so join that to try again.
              </li>
            </Cell>
          )}
        </>
      }
    >
      <div className='flex items-center gap-3'>
        <Spinner size={12} />
        <span>Waiting for the machine</span>
      </div>
    </Step>
  );
}

function ConnectedStep({ ssid, hostname, onFinish }) {
  return (
    <Step
      step={3}
      title='Your BetterMate is connected'
      subtitle={`You can now use it from any device on ${ssid}.`}
      actions={
        <>
          <Button variant='primary' block onClick={onFinish}>
            Finish setup
          </Button>
          <Button block href='/settings/machine' onClick={dismissSetup}>
            Personalise machine
          </Button>
        </>
      }
    >
      <List>
        <ListRow
          icon='wifi'
          title='BetterMate'
          meta={`${hostname}.local`}
          end={<Chip tone='success'>Connected</Chip>}
        />
      </List>
    </Step>
  );
}

export function Setup() {
  const { route } = useLocation();
  const [step, setStep] = useState(0);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [hostname, setHostname] = useState('gaggimate');
  const [savedSsid, setSavedSsid] = useState('');

  // Prefills what the machine already knows, so changing networks starts from the current one.
  useEffect(() => {
    fetch('/api/settings')
      .then(resp => (resp.ok ? resp.json() : null))
      .then(settings => {
        if (settings?.wifiSsid) {
          setSsid(settings.wifiSsid);
          setSavedSsid(settings.wifiSsid);
        }
        if (settings?.mdnsName) setHostname(settings.mdnsName);
      })
      .catch(() => {});
  }, []);

  const leave = () => {
    dismissSetup();
    route('/', true);
  };

  const save = () => {
    const body = new FormData();
    body.append('wifiSsid', ssid.trim());
    // Left blank on the same network, the saved password stays. A new network may really be open.
    if (password || ssid.trim() !== savedSsid) body.append('wifiPassword', password);
    body.append('restart', '1');
    // The machine restarts as it answers, so a dropped response still means it was saved.
    fetch('/api/settings', { method: 'post', body }).catch(() => {});
    setStep(2);
  };

  // Covers the app shell: nothing else on the machine matters until this is done.
  return (
    <div className='fixed inset-0 z-100 overflow-y-auto bg-(--surface-0)'>
      <div className='mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-3 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center'>
        <div className='flex justify-center'>
          <Wordmark />
        </div>
        {step === 0 && <Welcome onStart={() => setStep(1)} onSkip={leave} />}
        {step === 1 && (
          <WifiStep
            ssid={ssid}
            setSsid={setSsid}
            password={password}
            setPassword={setPassword}
            savedSsid={savedSsid}
            onBack={() => setStep(0)}
            onSubmit={save}
          />
        )}
        {step === 2 && (
          <JoiningStep ssid={ssid.trim()} hostname={hostname} onReconnected={() => setStep(3)} />
        )}
        {step === 3 && <ConnectedStep ssid={ssid.trim()} hostname={hostname} onFinish={leave} />}
      </div>
    </div>
  );
}
