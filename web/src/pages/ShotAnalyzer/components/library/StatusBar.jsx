/**
 * One row of the library bar: the shot and its profile, each as a slot. A slot names what is
 * loaded, opens the library for itself, and carries its own small actions (export, retry the
 * profile search, unload). In a comparison the row starts with its shot badge.
 */

import { cx } from '../../../../components/cx.js';
import { Icon } from '../../../../components/Icon.jsx';
import { Loader } from '../../../../components/Loader.jsx';
import { IconButton } from '../../../../components/IconButton.jsx';
import { ShotBadge } from '../../ui/ShotBadge.jsx';
import { cleanName } from '../../utils/analyzerUtils';
import './LibraryBar.css';

const RETRY_PROFILE_SEARCH_LABEL = 'Retry automatic profile search';

function isNoProfileName(profileName) {
  return cleanName(profileName || '').toLowerCase() === 'no profile loaded';
}

function getShotSlotName(currentShot, currentShotName) {
  if (!currentShot) return 'No shot loaded';
  if (currentShot.source === 'gaggimate') return `#${currentShot.id}`;
  return cleanName(currentShotName);
}

function getProfileSlotName(currentProfileName) {
  if (!currentProfileName || isNoProfileName(currentProfileName)) return 'No profile loaded';
  return cleanName(currentProfileName);
}

function getPanelTitle(expanded) {
  return expanded ? 'Close the library' : 'Open the library';
}

function getMismatchTitle(currentShot) {
  const expectedProfileName = cleanName(currentShot?.profile || '');
  return expectedProfileName
    ? `This profile is not the one the shot was pulled with (${expectedProfileName}).`
    : 'This profile is not the one the shot was pulled with.';
}

/** The pill itself. `children` are the icon buttons at its end. */
function Slot({
  kind,
  name,
  empty = false,
  warning = false,
  busy = false,
  showChevron = true,
  expanded = false,
  title,
  onToggle,
  children,
}) {
  return (
    <div
      className={cx('an-slot an-on-cell', empty && 'an-slot--empty', warning && 'an-slot--warning')}
      data-slot={kind}
    >
      <button
        type='button'
        className='an-slot__main'
        onClick={onToggle}
        aria-haspopup='dialog'
        aria-expanded={expanded}
        aria-busy={busy || undefined}
        title={title}
      >
        <span className='sr-only'>{kind === 'shot' ? 'Shot: ' : 'Profile: '}</span>
        {warning && <Icon name='triangle-alert' size={18} title='Profile mismatch' />}
        <span className='an-slot__name'>{name}</span>
        {busy && <Loader size={18} />}
        {showChevron && <Icon name='chevron-down' size={18} className='an-slot__chevron' />}
      </button>
      {children}
    </div>
  );
}

function ShotSlot({
  currentShot,
  currentShotName,
  isShotPending,
  expanded,
  onToggle,
  onExportShot,
  onUnloadShot,
}) {
  return (
    <Slot
      kind='shot'
      name={getShotSlotName(currentShot, currentShotName)}
      empty={!currentShot}
      busy={isShotPending}
      expanded={expanded}
      title={getPanelTitle(expanded)}
      onToggle={onToggle}
    >
      {currentShot && onExportShot ? (
        <IconButton size='sm' icon='download' label='Export shot' onClick={() => onExportShot()} />
      ) : null}
      {currentShot ? (
        <IconButton size='sm' icon='x' label='Unload shot' onClick={() => onUnloadShot?.()} />
      ) : null}
    </Slot>
  );
}

function ProfileSlot({
  currentShot,
  currentProfile,
  currentProfileName,
  isMismatch,
  isSearchingProfile,
  canRetryProfileSearch,
  expanded,
  onToggle,
  onExportProfile,
  onRetryProfileSearch,
  onUnloadProfile,
}) {
  const hasProfile = Boolean(currentProfile);
  // A named profile that has not loaded (still searched for, or not found) can be dismissed too.
  const canUnload = hasProfile || isSearchingProfile || !isNoProfileName(currentProfileName);
  const canRetry =
    Boolean(onRetryProfileSearch) &&
    (hasProfile ? isMismatch || canRetryProfileSearch : canRetryProfileSearch);

  return (
    <Slot
      kind='profile'
      name={getProfileSlotName(currentProfileName)}
      empty={!hasProfile}
      warning={Boolean(isMismatch)}
      busy={isSearchingProfile}
      showChevron={hasProfile || !isSearchingProfile}
      expanded={expanded}
      title={isMismatch ? getMismatchTitle(currentShot) : getPanelTitle(expanded)}
      onToggle={onToggle}
    >
      {hasProfile && onExportProfile ? (
        <IconButton
          size='sm'
          icon='download'
          label='Export profile'
          onClick={() => onExportProfile()}
        />
      ) : null}
      {canRetry ? (
        <IconButton
          size='sm'
          icon='refresh-cw'
          label={RETRY_PROFILE_SEARCH_LABEL}
          disabled={isSearchingProfile}
          onClick={() => onRetryProfileSearch()}
        />
      ) : null}
      {canUnload ? (
        <IconButton size='sm' icon='x' label='Unload profile' onClick={() => onUnloadProfile?.()} />
      ) : null}
    </Slot>
  );
}

export function StatusBar({
  currentShot,
  currentProfile,
  currentShotName,
  currentProfileName,
  isShotPending = false,
  canRetryProfileSearch = false,
  onUnloadShot,
  onUnloadProfile,
  onExportShot,
  onExportProfile,
  onRetryProfileSearch,
  onTogglePanel,
  onShotPanelToggle,
  onProfilePanelToggle,
  isMismatch,
  isSearchingProfile = false,
  compareBadgeNumber = null,
  shotPanelOpen = false,
  profilePanelOpen = false,
  isDropTarget = false,
  dropzoneProps,
}) {
  return (
    <div
      {...dropzoneProps}
      className={cx('an-libbar__row', isDropTarget && 'an-drop')}
      data-slot-row={compareBadgeNumber || 1}
    >
      {compareBadgeNumber ? <ShotBadge number={compareBadgeNumber} /> : null}
      <div className='an-libbar__pair'>
        <ShotSlot
          currentShot={currentShot}
          currentShotName={currentShotName}
          isShotPending={isShotPending}
          expanded={shotPanelOpen}
          onToggle={onShotPanelToggle || onTogglePanel}
          onExportShot={onExportShot}
          onUnloadShot={onUnloadShot}
        />
        <ProfileSlot
          currentShot={currentShot}
          currentProfile={currentProfile}
          currentProfileName={currentProfileName}
          isMismatch={isMismatch}
          isSearchingProfile={isSearchingProfile}
          canRetryProfileSearch={canRetryProfileSearch}
          expanded={profilePanelOpen}
          onToggle={onProfilePanelToggle || onTogglePanel}
          onExportProfile={onExportProfile}
          onRetryProfileSearch={onRetryProfileSearch}
          onUnloadProfile={onUnloadProfile}
        />
      </div>
    </div>
  );
}
