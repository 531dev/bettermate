import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Icon } from '../../components/Icon.jsx';
import { dismissSetup } from '../../utils/setupState.js';

const TOTAL_STEPS = 3;
// The restart takes a few seconds; before this the old server may still answer.
const RECONNECT_GRACE_MS = 8000;
const RECONNECT_POLL_MS = 3000;

function Wordmark({ className }) {
  return (
    <>
      <img
        className={`bm-wordmark-light w-auto ${className}`}
        src='/bettermate-wordmark.svg'
        alt='BetterMate'
      />
      <img
        className={`bm-wordmark-dark w-auto ${className}`}
        src='/bettermate-wordmark-inverse.svg'
        alt='BetterMate'
      />
    </>
  );
}

Wordmark.propTypes = {
  className: PropTypes.string.isRequired,
};

// Each step is one sentence of context, one piece of work and its pinned actions.
function StepLayout({ step, title, subtitle, onBack, children, actions }) {
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), [step]);

  return (
    <>
      <header className='grid min-h-[52px] shrink-0 grid-cols-[44px_1fr_44px] items-center py-1'>
        {onBack ? (
          <button
            type='button'
            className='btn btn-ghost btn-circle hover:bg-base-content/10 border-none'
            aria-label='Back'
            onClick={onBack}
          >
            <Icon name='arrow-left' />
          </button>
        ) : (
          <span />
        )}
        <span className='justify-self-center'>
          <Wordmark className='h-5' />
        </span>
      </header>
      <div className='mt-4 flex items-baseline justify-between gap-3 px-2'>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className='text-[22px] leading-7 font-normal outline-none'
        >
          {title}
        </h1>
        <span className='shrink-0 text-lg font-light text-[var(--ink-muted)]'>
          <span className='sr-only'>Step </span>
          {step}/{TOTAL_STEPS}
        </span>
      </div>
      <p className='mt-1 px-2 text-[15px] leading-[22px] text-[var(--ink-muted)]'>{subtitle}</p>
      <div className='flex min-h-0 flex-1 flex-col justify-center py-6'>{children}</div>
      <div className='flex shrink-0 flex-col gap-2'>{actions}</div>
    </>
  );
}

StepLayout.propTypes = {
  step: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  onBack: PropTypes.func,
  children: PropTypes.node,
  actions: PropTypes.node,
};

function Welcome({ onStart, onSkip }) {
  return (
    <>
      <div className='flex flex-1 flex-col items-center justify-center gap-4 py-10'>
        <img className='h-14 w-14' src='/bettermate.svg' alt='' />
        <Wordmark className='h-8' />
      </div>
      <h1 className='px-2 text-[22px] leading-7 font-normal'>Welcome to BetterMate</h1>
      <p className='mt-1 mb-6 px-2 text-[15px] leading-[22px] text-[var(--ink-muted)]'>
        Precise shots, with your machine, profiles and history in any browser on your Wi-Fi.
      </p>
      <div className='flex shrink-0 flex-col gap-2'>
        <button type='button' className='btn btn-primary' onClick={onStart}>
          Get started
        </button>
        <button type='button' className='btn border-none bg-[var(--surface-2)]' onClick={onSkip}>
          Skip for now
        </button>
      </div>
    </>
  );
}

Welcome.propTypes = {
  onStart: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
};

function WifiStep({ ssid, setSsid, password, setPassword, onBack, onSubmit }) {
  const [shown, setShown] = useState(false);
  const ready = ssid.trim().length > 0;

  return (
    <form
      className='flex min-h-0 flex-1 flex-col'
      onSubmit={e => {
        e.preventDefault();
        if (ready) onSubmit();
      }}
    >
      <StepLayout
        step={1}
        title='Connect to your Wi-Fi'
        subtitle='This takes about a minute.'
        onBack={onBack}
        actions={
          <button type='submit' className='btn btn-primary' disabled={!ready}>
            Continue
          </button>
        }
      >
        <div className='bm-group'>
          <p className='text-[15px] leading-[22px]'>
            BetterMate joins your home network so you can reach it from your phone or laptop.
          </p>
          <div>
            <label htmlFor='setup-ssid' className='mb-2 block text-sm font-medium'>
              Wi-Fi name
            </label>
            <input
              id='setup-ssid'
              className='input w-full'
              value={ssid}
              autoComplete='off'
              autoCapitalize='none'
              onInput={e => setSsid(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor='setup-password' className='mb-2 block text-sm font-medium'>
              Password
            </label>
            <label className='input w-full'>
              <input
                id='setup-password'
                type={shown ? 'text' : 'password'}
                value={password}
                autoComplete='off'
                onInput={e => setPassword(e.target.value)}
              />
              <button
                type='button'
                className='hover:text-primary flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full'
                aria-label={shown ? 'Hide password' : 'Show password'}
                aria-pressed={shown}
                onClick={() => setShown(!shown)}
              >
                <Icon name={shown ? 'eye-off' : 'eye'} />
              </button>
            </label>
          </div>
        </div>
        <p className='mt-3 flex items-center justify-center gap-1 text-[13px] text-[var(--ink-muted)]'>
          <Icon name='info' />
          Your password is saved on the machine only.
        </p>
      </StepLayout>
    </form>
  );
}

WifiStep.propTypes = {
  ssid: PropTypes.string.isRequired,
  setSsid: PropTypes.func.isRequired,
  password: PropTypes.string.isRequired,
  setPassword: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

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
    <StepLayout
      step={2}
      title={`Joining ${ssid}`}
      subtitle='The machine restarts and connects to your network.'
      actions={
        <button
          type='button'
          className='btn border-none bg-[var(--surface-2)]'
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen(open => !open)}
        >
          How to reconnect
        </button>
      }
    >
      <div className='flex flex-col items-center gap-3' role='status'>
        <div className='relative flex h-[72px] w-[72px] items-center justify-center'>
          <svg
            viewBox='0 0 72 72'
            className='absolute inset-0 animate-spin [animation-duration:1.4s] motion-reduce:animate-none'
            aria-hidden='true'
          >
            <circle cx='36' cy='36' r='34' fill='none' stroke='var(--line)' strokeWidth='2' />
            <path
              d='M36 2a34 34 0 0 1 34 34'
              fill='none'
              stroke='var(--primary-text)'
              strokeWidth='2.5'
              strokeLinecap='round'
            />
          </svg>
          <Icon name='wifi' />
        </div>
        <span className='text-sm text-[var(--ink-muted)]'>Waiting for the machine...</span>
      </div>
      {helpOpen && (
        <ol className='bm-group mt-6 list-inside list-decimal gap-2 text-[15px] leading-[22px]'>
          <li>Join {ssid} on this device.</li>
          <li>
            Open{' '}
            <a className='text-primary underline' href={`http://${hostname}.local`}>
              {hostname}.local
            </a>
            .
          </li>
          <li>
            If it doesn&apos;t appear, the details may be wrong. The machine then opens its own
            BetterMate hotspot, so join that to try again.
          </li>
        </ol>
      )}
    </StepLayout>
  );
}

JoiningStep.propTypes = {
  ssid: PropTypes.string.isRequired,
  hostname: PropTypes.string.isRequired,
  onReconnected: PropTypes.func.isRequired,
};

function ConnectedStep({ ssid, hostname, onFinish }) {
  return (
    <StepLayout
      step={3}
      title='Your BetterMate is connected!'
      subtitle={`You can now use it from any device on ${ssid}.`}
      actions={
        <button type='button' className='btn btn-primary' onClick={onFinish}>
          Finish setup
        </button>
      }
    >
      <div className='bm-group'>
        <div className='bm-row'>
          <span className='bm-row__icon'>
            <img className='h-6 w-6' src='/bettermate.svg' alt='' />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='bm-row__title'>BetterMate</span>
            <span className='bm-row__sub'>{hostname}.local</span>
          </span>
          <span className='bm-row__arrow text-[var(--primary-text)]'>
            <Icon name='check' />
          </span>
        </div>
        <a href='/settings/machine' className='btn btn-outline' onClick={dismissSetup}>
          Personalise machine
        </a>
      </div>
    </StepLayout>
  );
}

ConnectedStep.propTypes = {
  ssid: PropTypes.string.isRequired,
  hostname: PropTypes.string.isRequired,
  onFinish: PropTypes.func.isRequired,
};

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
    <div className='fixed inset-0 z-[10000] overflow-y-auto bg-[var(--surface-0)]'>
      <div className='mx-auto flex min-h-full w-full max-w-md flex-col px-3 pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]'>
        {step === 0 && <Welcome onStart={() => setStep(1)} onSkip={leave} />}
        {step === 1 && (
          <WifiStep
            ssid={ssid}
            setSsid={setSsid}
            password={password}
            setPassword={setPassword}
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
