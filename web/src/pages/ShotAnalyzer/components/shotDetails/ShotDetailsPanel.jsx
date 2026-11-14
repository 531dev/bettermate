/** Orchestrates single- and compare-shot detail cards and tab selection. */

import { useId } from 'preact/hooks';
import TabBar from '../../../../components/TabBar.jsx';
import { ShotDetailsCard } from './ShotDetailsCard';

function getCompareDetailTabKey(entry, index) {
  return entry?.key || entry?.shot?.id || entry?.shotName || index;
}

export function ShotDetailsPanel({
  entries = [],
  isCompareActive = false,
  activeCompareIndex = 0,
  onActiveCompareIndexChange = () => {},
}) {
  const tabsId = useId();
  const validEntries = entries.filter(entry => entry?.shot);
  if (validEntries.length === 0) return null;

  if (isCompareActive) {
    const resolvedActiveIndex =
      activeCompareIndex >= 0 && activeCompareIndex < validEntries.length ? activeCompareIndex : 0;
    const activeEntry = validEntries[resolvedActiveIndex];
    // Two panels can be on the page at once (the column and the phone's page), so each names its
    // own tabs.
    const tabs = validEntries.map((entry, index) => ({
      id: `${tabsId}-${index}`,
      label: `Shot ${index + 1}`,
    }));
    const activeTab = tabs[resolvedActiveIndex].id;

    return (
      <div className='flex flex-col gap-2 lg:gap-3'>
        {tabs.length > 1 ? (
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={id => onActiveCompareIndexChange(tabs.findIndex(tab => tab.id === id))}
          />
        ) : null}
        <div
          key={getCompareDetailTabKey(activeEntry, resolvedActiveIndex)}
          id={`panel-${activeTab}`}
          role='tabpanel'
          aria-labelledby={tabs.length > 1 ? `tab-${activeTab}` : undefined}
        >
          <ShotDetailsCard entry={activeEntry} isCompare={isCompareActive} />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-2 lg:gap-3'>
      {validEntries.map((entry, index) => (
        <ShotDetailsCard
          key={getCompareDetailTabKey(entry, index)}
          entry={entry}
          isCompare={false}
        />
      ))}
    </div>
  );
}
