import { libraryService } from '../../services/LibraryService';
import {
  cleanName,
  getShotIdentityKey,
  getShotStorageKey,
  isProfilePinned,
  isShotPinned,
} from '../../utils/analyzerUtils';
import { cx } from '../../../../components/cx.js';
import { usePresence } from '../../../../components/motion.js';
import { Segmented } from '../../../../components/Segmented.jsx';
import { LibrarySection } from './LibrarySection';
import { doesProfileLabelMatchShot, doesProfileMatchProfile } from './libraryData';
import {
  getLibraryProfileDeleteKey,
  getProfileCompareBadgeNumber,
  getShotCompareBadgeNumber,
} from './libraryDisplay';

function getNextLibrarySortState(currentSort, key, order) {
  return {
    key,
    order: order || (currentSort.key === key && currentSort.order === 'desc' ? 'asc' : 'desc'),
  };
}

// Below 1024px one section shows at a time; from there both do.
function LibrarySectionSlot({ active, children }) {
  return <div className={cx('min-h-0 lg:flex', active ? 'flex' : 'hidden')}>{children}</div>;
}

const MOBILE_SECTION_OPTIONS = [
  { value: 'shots', label: 'Shots' },
  { value: 'profiles', label: 'Profiles' },
];

/**
 * The library, hanging from the library bar over a scrim: shots and profiles side by side from
 * 1024px, one of them at a time below that. It enters and leaves with the scrim.
 */
export function LibraryDropdown({
  children,
  open,
  style,
  mobileActiveSection,
  onClose,
  onMobileSectionChange,
}) {
  const { mounted, shown } = usePresence(open);
  if (!mounted) return null;

  return (
    <>
      <div className={cx('bm-scrim', shown && 'is-open')} onClick={onClose} />
      <div
        className={cx('an-lib', shown && 'is-open')}
        style={style}
        role='dialog'
        aria-label='Library'
        data-tool-portal='library'
      >
        <Segmented
          block
          className='lg:hidden'
          label='Library section'
          options={MOBILE_SECTION_OPTIONS}
          value={mobileActiveSection}
          onChange={onMobileSectionChange}
        />
        <div className='an-lib__body'>{children}</div>
      </div>
    </>
  );
}

export function LibraryShotsPanelSection({
  compareMode,
  comparePendingKeys,
  compareSecondaryShotKey,
  compareSelectedCount,
  compareSelectionKeys,
  desktopSectionHeight,
  getEffectiveShotPinBucketKey,
  getPinnedShotBucketKey,
  getShotPinDisabledReason,
  handleDelete,
  handleExport,
  handleShotPinToggle,
  handleShotRowAction,
  loading,
  mobileActiveSection,
  normalizedCurrentProfileName,
  onCompareShotToggle,
  pinnedShotsByProfile,
  primaryDisplayProfile,
  primaryDisplayShot,
  refreshLibraries,
  setShotsPinnedFirst,
  setShotsSearch,
  setShotsSort,
  setShotsSourceFilter,
  shots,
  shotsPinnedFirst,
  shotsSearch,
  shotsSort,
  shotsSourceFilter,
}) {
  const handleExportAllShots = () => {
    if (shots.length === 0) return;
    if (
      confirm(
        `Do you really want to export all ${shots.length} filtered shots? (Shots are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < shots.length; i++)
        setTimeout(() => handleExport(shots[i], true), i * 300);
    }
  };

  const handleDeleteAllShots = async () => {
    if (
      confirm(
        `WARNING: Do you really want to IRREVOCABLY delete all ${shots.length} filtered shots?`,
      )
    ) {
      for (const shot of shots) {
        await libraryService.deleteShot(getShotStorageKey(shot), shot.source);
      }
      refreshLibraries();
    }
  };

  return (
    <LibrarySectionSlot active={mobileActiveSection === 'shots'}>
      <LibrarySection
        title='Shots'
        items={shots}
        isShot={true}
        sectionHeight={desktopSectionHeight}
        searchValue={shotsSearch}
        sortKey={shotsSort.key}
        sortOrder={shotsSort.order}
        sourceFilter={shotsSourceFilter}
        onSearchChange={setShotsSearch}
        onSortChange={(key, order) => setShotsSort(getNextLibrarySortState(shotsSort, key, order))}
        onSourceFilterChange={setShotsSourceFilter}
        onLoad={handleShotRowAction}
        onExport={item => handleExport(item, true)}
        onDelete={handleDelete}
        compareSelectedCount={compareSelectedCount}
        compareSelectionKeys={compareSelectionKeys}
        comparePendingKeys={comparePendingKeys}
        compareReferenceKey={primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : ''}
        getCompareBadgeNumber={item =>
          getShotCompareBadgeNumber({
            compareMode,
            item,
            primaryDisplayShot,
            compareSecondaryShotKey,
          })
        }
        isLoading={loading}
        onExportAll={handleExportAllShots}
        onDeleteAll={handleDeleteAllShots}
        getMatchStatus={item =>
          primaryDisplayProfile &&
          cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName
        }
        getActiveStatus={item =>
          primaryDisplayShot &&
          getShotIdentityKey(item) === getShotIdentityKey(primaryDisplayShot) &&
          item.source === primaryDisplayShot.source
        }
        getPinStatus={item =>
          shotsPinnedFirst
            ? Boolean(getPinnedShotBucketKey(item))
            : isShotPinned(item, getEffectiveShotPinBucketKey(item), pinnedShotsByProfile)
        }
        getPinDisabledReason={getShotPinDisabledReason}
        pinnedFirstEnabled={shotsPinnedFirst}
        onPinnedFirstToggle={() => setShotsPinnedFirst(value => !value)}
        onPinToggle={handleShotPinToggle}
      />
    </LibrarySectionSlot>
  );
}

export function LibraryProfilesPanelSection({
  compareMode,
  desktopSectionHeight,
  getProfilePinDisabledReason,
  handleDelete,
  handleExport,
  handleLibraryProfileStatsOpen,
  handleProfilePinToggle,
  handleProfileRowAction,
  loading,
  mobileActiveSection,
  normalizedCompareSecondaryProfileName,
  pinnedProfiles,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  primaryDisplayShot,
  profiles,
  profilesPinnedFirst,
  profilesSearch,
  profilesSort,
  profilesSourceFilter,
  refreshLibraries,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
  secondaryDisplayShot,
  setProfilesPinnedFirst,
  setProfilesSearch,
  setProfilesSort,
  setProfilesSourceFilter,
}) {
  const handleExportAllProfiles = () => {
    if (profiles.length === 0) return;
    if (
      confirm(
        `Do you really want to export all ${profiles.length} filtered profiles? (Profiles are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < profiles.length; i++)
        setTimeout(() => handleExport(profiles[i], false), i * 300);
    }
  };

  const handleDeleteAllProfiles = async () => {
    if (
      confirm(
        `WARNING: Do you really want to IRREVOCABLY delete all ${profiles.length} filtered profiles?`,
      )
    ) {
      for (const profile of profiles) {
        await libraryService.deleteProfile(getLibraryProfileDeleteKey(profile), profile.source);
      }
      refreshLibraries();
    }
  };

  return (
    <LibrarySectionSlot active={mobileActiveSection === 'profiles'}>
      <LibrarySection
        title='Profiles'
        items={profiles}
        isShot={false}
        sectionHeight={desktopSectionHeight}
        searchValue={profilesSearch}
        sortKey={profilesSort.key}
        sortOrder={profilesSort.order}
        sourceFilter={profilesSourceFilter}
        onSearchChange={setProfilesSearch}
        onSortChange={(key, order) =>
          setProfilesSort(getNextLibrarySortState(profilesSort, key, order))
        }
        onSourceFilterChange={setProfilesSourceFilter}
        onLoad={handleProfileRowAction}
        onShowStats={handleLibraryProfileStatsOpen}
        onExport={item => handleExport(item, false)}
        onDelete={handleDelete}
        isLoading={loading}
        onExportAll={handleExportAllProfiles}
        onDeleteAll={handleDeleteAllProfiles}
        getMatchStatus={item =>
          primaryDisplayShot && doesProfileLabelMatchShot(item, primaryDisplayShot)
        }
        getCompareStatus={item =>
          Boolean(
            secondaryDisplayProfileName &&
              normalizedCompareSecondaryProfileName &&
              normalizedCompareSecondaryProfileName !== 'no profile loaded' &&
              doesProfileLabelMatchShot(item, secondaryDisplayShot),
          )
        }
        getCompareBadgeNumber={item =>
          getProfileCompareBadgeNumber({
            compareMode,
            item,
            primaryDisplayProfile,
            primaryDisplayProfileName,
            secondaryDisplayProfile,
            secondaryDisplayProfileName,
          })
        }
        getActiveStatus={item =>
          primaryDisplayProfile &&
          doesProfileMatchProfile(item, primaryDisplayProfile, primaryDisplayProfileName)
        }
        getPinStatus={item => isProfilePinned(item, pinnedProfiles)}
        getPinDisabledReason={getProfilePinDisabledReason}
        pinnedFirstEnabled={profilesPinnedFirst}
        onPinnedFirstToggle={() => setProfilesPinnedFirst(value => !value)}
        onPinToggle={handleProfilePinToggle}
      />
    </LibrarySectionSlot>
  );
}
