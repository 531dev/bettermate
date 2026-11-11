import { useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

/**
 * The sections of a page as a segmented control: the selected tab is ink. When the tabs outgrow
 * the row, the track scrolls sideways.
 *   tabs       [{ id, label, icon?, preload? }]: `preload` runs on hover and touch
 *   activeTab  the selected tab's id
 *   basePath   each tab is a route, `basePath/id`
 *   onTabChange(id)  for tabs that are not routes
 */
export default function TabBar({ tabs, activeTab, onTabChange, basePath, className }) {
  const location = useLocation();
  const active = useRef(null);

  // A selected tab that starts off screen is brought into view.
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  const handleTabClick = (tabId, event) => {
    event.preventDefault();
    if (basePath) location.route(`${basePath}/${tabId}`);
    else onTabChange?.(tabId);
  };

  return (
    <div role='tablist' className={cx('bm-seg bm-seg--scroll self-start', className)}>
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <a
            key={tab.id}
            ref={isActive ? active : undefined}
            href={basePath ? `${basePath}/${tab.id}` : '#'}
            onClick={event => handleTabClick(tab.id, event)}
            onMouseEnter={() => tab.preload?.()}
            onTouchStart={() => tab.preload?.()}
            role='tab'
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            className='bm-seg__item'
          >
            {tab.icon && <Icon name={tab.icon} size={18} className='max-xl:hidden' />}
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}
