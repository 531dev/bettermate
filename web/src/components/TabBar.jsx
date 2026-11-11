import { Icon } from './Icon.jsx';
import { useLocation } from 'preact-iso';

export default function TabBar({ tabs, activeTab, onTabChange, basePath, className = '' }) {
  const location = useLocation();

  const handleTabClick = (tabId, event) => {
    if (basePath) {
      event.preventDefault();
      location.route(`${basePath}/${tabId}`);
    } else if (onTabChange) {
      onTabChange(tabId);
    }
  };

  return (
    <div className={`scrollbar-none -mx-2 overflow-x-auto px-2 ${className}`}>
      <div role='tablist' className='flex min-w-full flex-nowrap gap-1.5'>
        {tabs.map(tab => {
          const isActive = tab.id === activeTab;
          const href = basePath ? `${basePath}/${tab.id}` : '#';

          return (
            <a
              key={tab.id}
              href={href}
              onClick={e => handleTabClick(tab.id, e)}
              onMouseEnter={() => tab.preload?.()}
              onTouchStart={() => tab.preload?.()}
              role='tab'
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={`flex h-11 shrink-0 flex-row flex-nowrap items-center justify-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                isActive
                  ? 'bg-primary text-primary-content'
                  : 'hover:text-base-content bg-[var(--surface-1)] text-[var(--ink-muted)]'
              }`}
            >
              {tab.icon && (
                <span className='hidden md:inline-flex'>
                  <Icon name={tab.icon} />
                </span>
              )}
              {tab.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
