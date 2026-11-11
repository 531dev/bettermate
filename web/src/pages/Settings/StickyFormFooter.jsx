import { Spinner } from '../../components/Spinner.jsx';

export function StickyFormFooter({ submitting, onRestart }) {
  return (
    <div className='bm-actions mt-2 block'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4'>
        <div className='flex w-full items-center gap-2 sm:w-auto'>
          <button
            type='submit'
            className='btn btn-primary min-h-11 flex-1 sm:flex-none'
            disabled={submitting}
          >
            {submitting && <Spinner size={4} className='mr-2' />}
            Save Settings
          </button>
          <button
            type='submit'
            name='restart'
            className='btn btn-outline min-h-11 flex-1 sm:flex-none'
            disabled={submitting}
            onClick={onRestart}
          >
            Save & Restart
          </button>
        </div>
        <p className='text-center text-xs leading-4 text-[var(--ink-muted)] sm:text-left'>
          Wi-Fi, time zone and plugin changes need a restart.
        </p>
      </div>
    </div>
  );
}
