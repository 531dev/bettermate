import './style.css';
import { initializeTheme } from './utils/themeManager.js';

if (import.meta.env.DEV) {
  // Dev-only Preact warnings; stripped from production builds.
  import('preact/debug');
}

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { LocationProvider, Router, Route, ErrorBoundary, useLocation } from 'preact-iso';
import lazy from 'preact-iso/lazy';

import ApiService, { ApiServiceContext } from './services/ApiService.js';
import { AppBar } from './components/AppBar.jsx';
import { ModeBar, ModeDock, ModeDockSpacer } from './components/ModeNav.jsx';
import { Navigation } from './components/Navigation.jsx';
import { Spinner } from './components/Spinner.jsx';

// Each page lazy-loads as its own Vite chunk so the initial bundle stays small.
// Chart.js and the analyzer/statistics views are too
// large to ship up-front on the ESP32's slow WiFi pipe.
const Home = lazy(() => import('./pages/Home/index.jsx').then(m => m.Home));
const NotFound = lazy(() => import('./pages/_404.jsx').then(m => m.NotFound));
const Settings = lazy(() => import('./pages/Settings/index.jsx').then(m => m.Settings));
const ProfileList = lazy(() => import('./pages/ProfileList/index.jsx').then(m => m.ProfileList));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit/index.jsx').then(m => m.ProfileEdit));
const ShotHistory = lazy(() => import('./pages/ShotHistory/index.jsx').then(m => m.ShotHistory));
const ShotAnalyzer = lazy(() => import('./pages/ShotAnalyzer/index.jsx').then(m => m.ShotAnalyzer));
const StatisticsPage = lazy(() =>
  import('./pages/Statistics/index.jsx').then(m => m.StatisticsPage),
);
const Setup = lazy(() => import('./pages/Setup/index.jsx').then(m => m.Setup));
const DashboardSettings = lazy(() =>
  import('./pages/DashboardSettings/index.jsx').then(m => m.DashboardSettings),
);

const apiService = new ApiService();
const DESKTOP_NAV_COLLAPSED_STORAGE_KEY = 'gaggimate.desktopNavCollapsed';

// Phones (either orientation) open on the page, never on the navigation.
const isPhoneViewport = () =>
  !!globalThis.window?.matchMedia('(max-width: 767px), (max-height: 500px)').matches;

function readInitialDesktopNavCollapsed() {
  const storage = globalThis.window?.localStorage;
  if (!storage || isPhoneViewport()) return true;

  try {
    return storage.getItem(DESKTOP_NAV_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
}

const RedirectTo = to =>
  function Redirect() {
    const loc = useLocation();
    useEffect(() => {
      loc.route(to, true);
    }, [loc]);
    return null;
  };

function RouteFallback() {
  return (
    <div className='flex w-full flex-row items-center justify-center py-16'>
      <Spinner size={8} />
    </div>
  );
}

export function App() {
  const [navCollapsed, setNavCollapsed] = useState(readInitialDesktopNavCollapsed);

  useEffect(() => {
    const storage = globalThis.window?.localStorage;
    if (!storage || isPhoneViewport()) return;

    try {
      storage.setItem(DESKTOP_NAV_COLLAPSED_STORAGE_KEY, String(navCollapsed));
    } catch {
      // Ignore storage write failures so the navigation still works in restricted browsers.
    }
  }, [navCollapsed]);

  useEffect(() => {
    const handleOpenNav = () => setNavCollapsed(false);
    window.addEventListener('open-mobile-nav', handleOpenNav);
    return () => window.removeEventListener('open-mobile-nav', handleOpenNav);
  }, []);

  return (
    <LocationProvider>
      <ApiServiceContext.Provider value={apiService}>
        <a
          href='#main'
          className='btn btn-primary sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[10001]'
        >
          Skip to content
        </a>
        <div className='flex h-dvh overflow-hidden bg-[var(--surface-0)]'>
          <Navigation
            collapsed={navCollapsed}
            onToggleCollapsed={() => setNavCollapsed(collapsed => !collapsed)}
          />
          <div className='relative flex min-w-0 flex-1 flex-col'>
            <AppBar onOpenNav={() => setNavCollapsed(false)} />
            <main
              id='main'
              tabIndex={-1}
              className='flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto outline-none'
            >
              <div className='flex w-full flex-1 flex-col p-2 pr-[max(0.5rem,env(safe-area-inset-right))]'>
                <div className='grid flex-1 grid-cols-1'>
                  <div className='min-w-0'>
                    <ErrorBoundary>
                      <Router>
                        <Route path='/' component={Home} />
                        <Route path='/setup' component={Setup} />
                        <Route path='/dashboard-settings' component={DashboardSettings} />
                        <Route path='/profiles' component={ProfileList} />
                        <Route path='/profiles/:id' component={ProfileEdit} />
                        <Route path='/settings/:tab?' component={Settings} />
                        {/* Legacy routes now live in settings tabs */}
                        <Route path='/ota' component={RedirectTo('/settings/system')} />
                        <Route path='/scales' component={RedirectTo('/settings/bluetooth')} />
                        <Route path='/pidtune' component={RedirectTo('/settings/calibration')} />
                        <Route path='/history' component={ShotHistory} />
                        <Route path='/analyzer' component={ShotAnalyzer} />
                        <Route path='/statistics' component={StatisticsPage} />
                        <Route
                          path='/statistics/:sourceAlias/:profileName'
                          component={StatisticsPage}
                        />
                        <Route path='/analyzer/:source/:id' component={ShotAnalyzer} />{' '}
                        {/*deep-link route (sorce & ID)*/}
                        <Route default component={NotFound} />
                      </Router>
                    </ErrorBoundary>
                  </div>
                </div>
                <ModeDockSpacer />
              </div>
            </main>
            <ModeBar />
            <ModeDock />
          </div>
        </div>
      </ApiServiceContext.Provider>
    </LocationProvider>
  );
}

// Must be called before render
initializeTheme();

render(<App />, document.getElementById('app'));
