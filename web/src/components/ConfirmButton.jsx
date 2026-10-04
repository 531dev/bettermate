import { Icon } from './Icon.jsx';
import { useCallback, useState } from 'preact/hooks';
import { Tooltip } from './Tooltip.jsx';

export function ConfirmButton({ onAction, icon, tooltip, confirmTooltip, btnSize = 'sm' }) {
  const [confirm, setConfirm] = useState(false);
  const confirmOrAction = useCallback(() => {
    if (confirm) {
      onAction();
      setConfirm(false);
    } else {
      setConfirm(true);
    }
  }, [confirm, setConfirm, onAction]);

  return (
    <Tooltip content={confirm ? confirmTooltip : tooltip}>
      <button
        onClick={() => {
          confirmOrAction();
        }}
        className={`btn btn-ghost btn-${btnSize} cursor-pointer text-[var(--danger)] transition-colors ${confirm ? 'bg-error text-error-content font-semibold' : 'hover:bg-error/10 hover:text-[var(--danger)]'}`}
        aria-label={confirm ? confirmTooltip : tooltip}
      >
        <Icon name={icon} />
        {confirm && <span className='ml-2 hidden sm:inline'>Confirm</span>}
      </button>
    </Tooltip>
  );
}
