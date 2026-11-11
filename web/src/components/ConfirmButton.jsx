import { useConfirmAction } from '../hooks/useConfirmAction.js';
import { Button } from './Button.jsx';
import { Icon } from './Icon.jsx';
import { Tooltip } from './Tooltip.jsx';

/**
 * A destructive icon button that asks once. The first press arms it and it says CONFIRM; the
 * second runs `onAction`. Left alone, it disarms after four seconds.
 *   icon                     the glyph, such as 'trash-2'
 *   tooltip, confirmTooltip  its name before and after it is armed
 *   btnSize                  'sm' (default) or 'md'
 */
export function ConfirmButton({ onAction, icon, tooltip, confirmTooltip, btnSize = 'sm' }) {
  const { armed, armOrRun } = useConfirmAction(4000);
  const name = armed ? confirmTooltip : tooltip;

  return (
    <Tooltip content={name}>
      <Button
        variant={armed ? 'danger' : undefined}
        size={btnSize === 'sm' ? 'sm' : undefined}
        iconOnly={!armed}
        aria-label={name}
        onClick={() => armOrRun(onAction)}
      >
        <Icon name={icon} size={18} />
        {armed && 'Confirm'}
      </Button>
    </Tooltip>
  );
}
