import { MenuItem } from '../../components/Menu.jsx';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';

/**
 * The danger item of a Menu, which asks once. The first press arms it, keeps the menu open and
 * changes its words; the second runs `onConfirm`. Left alone it disarms after four seconds, and
 * closing the menu disarms it too, because it lives only while the menu is open.
 *   label, confirmLabel  its words before and after it is armed
 *   icon                 the glyph (default 'trash-2')
 */
export function ConfirmMenuItem({ label, confirmLabel, icon = 'trash-2', onConfirm }) {
  const { armed, armOrRun } = useConfirmAction(4000);

  return (
    <MenuItem
      icon={icon}
      danger
      className={armed ? 'bg-(--danger-soft)' : undefined}
      onClick={event => {
        // A Menu closes on any choice. Arming is not a choice yet.
        if (!armed) event.stopPropagation();
        armOrRun(onConfirm);
      }}
    >
      {armed ? confirmLabel : label}
    </MenuItem>
  );
}
