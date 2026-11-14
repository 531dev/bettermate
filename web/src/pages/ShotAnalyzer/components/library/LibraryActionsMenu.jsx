import { Menu, MenuItem } from '../../../../components/Menu.jsx';

/**
 * The actions of a library row or section as a Menu.
 *   actions  [{ label, icon, tone('error' for delete), href, onSelect }]
 * The button sits inside a row that loads its item on a press, so its own press stays with it.
 */
export function LibraryActionsMenu({ actions, ariaLabel, placement = 'bottom-end' }) {
  return (
    <span className='inline-flex' onClick={event => event.stopPropagation()}>
      <Menu label={ariaLabel} size='sm' placement={placement}>
        {actions.map(action => (
          <MenuItem
            key={action.label}
            icon={action.icon}
            danger={action.tone === 'error'}
            href={action.href}
            onClick={() => action.onSelect?.()}
          >
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </span>
  );
}
