import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useQuery } from 'preact-fetching';
import { dashboardModeSignal } from '../../utils/dashboardManager.js';
import { isSetupDismissed } from '../../utils/setupState.js';
import { Dashboard } from './Dashboard.jsx';

// A machine without Wi-Fi details is on its first run, so open guided setup once.
function useFirstRunSetup() {
  const { route } = useLocation();
  const { data: settings } = useQuery(
    'settings-cache',
    async () => (await fetch('/api/settings')).json(),
    { staleTime: 30000, refetchOnWindowFocus: false },
  );
  const firstRun = !!settings && !settings.wifiSsid && !isSetupDismissed();
  useEffect(() => {
    if (firstRun) route('/setup', true);
  }, [firstRun, route]);
}

// Simple, Advanced or Customize: the view is picked in Settings and remembered on this device.
export function Home() {
  useFirstRunSetup();
  return <Dashboard view={dashboardModeSignal.value} />;
}
