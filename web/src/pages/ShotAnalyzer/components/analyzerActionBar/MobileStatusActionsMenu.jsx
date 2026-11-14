/** Import and the import mode on a phone, where the action row has no room for them. */

import { Menu, MenuItem } from '../../../../components/Menu.jsx';

export function MobileStatusActionsMenu({
  anchorRef,
  onImportClick,
  onImportModeChange,
  importMode,
  isImporting,
  showImportModeToggle,
}) {
  const isBrowserImportMode = importMode === 'browser';

  return (
    <span ref={anchorRef} className='ml-auto inline-flex sm:hidden'>
      <Menu label='More actions' size='sm'>
        <MenuItem icon='plus' onClick={onImportClick} disabled={isImporting}>
          {isImporting ? 'Importing' : 'Import'}
        </MenuItem>
        {showImportModeToggle ? (
          <MenuItem
            icon={isBrowserImportMode ? 'eye' : 'monitor'}
            onClick={() => onImportModeChange(isBrowserImportMode ? 'temp' : 'browser')}
          >
            {isBrowserImportMode ? 'View imports temporarily' : 'Save imports to browser'}
          </MenuItem>
        ) : null}
      </Menu>
    </span>
  );
}
