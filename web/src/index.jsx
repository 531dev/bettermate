import './style.css';
import { initializeTheme } from './utils/themeManager.js';

if (import.meta.env.DEV) {
  // Dev-only Preact warnings; stripped from production builds.
  import('preact/debug');
}

import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { LocationProvider, Router, Route, ErrorBoundary, useLocation } from 'preact-iso';
import lazy from 'preact-iso/lazy';

import ApiService, { ApiServiceContext } from './services/ApiService.js';
import { AppBar } from './components/AppBar.jsx';
import { cx } from './components/cx.js';
import { ModeBar, hidesModeBar } from './components/ModeNav.jsx';
import { Navigation } from './components/Navigation.jsx';
import { LiveRegions, Toasts } from './components/Toast.jsx';
import { startAnnouncer } from './utils/announcer.js';

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

const RedirectTo = to =>
  function Redirect() {
    const loc = useLocation();
    useEffect(() => {
      loc.route(to, true);
    }, [loc]);
    return null;
  };

// Setup covers the whole window until it is done, so the shell's own controls are left out there:
// nothing behind the page can take focus, a key press or a screen reader's cursor.
const coversShell = path => path === '/setup' || path === '/setup/';

// The shell stays while pages change: the navigation (a sidebar tile from 1024px, the top bar's
// menu below that), the scrolling page, and the mode bar floating over its bottom edge.
function Shell() {
  const { path } = useLocation();
  const bare = coversShell(path);
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  // From 1024px the navigation is the sidebar, so a menu left open across a resize closes.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const onChange = () => wide.matches && setNavOpen(false);
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      {!bare && (
        <a
          href='#main'
          className='bm-btn bm-btn--primary sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-90'
        >
          Skip to content
        </a>
      )}
      <div className='flex h-dvh overflow-hidden'>
        {!bare && <Navigation open={navOpen} onClose={closeNav} />}
        <div className='relative flex min-w-0 flex-1 flex-col' inert={navOpen}>
          {!bare && <AppBar onOpenNav={() => setNavOpen(true)} navOpen={navOpen} />}
          <main
            id='main'
            tabIndex={-1}
            className='min-h-0 flex-1 overflow-x-hidden overflow-y-auto outline-none'
          >
            <div className={cx('bm-page', !hidesModeBar(path) && 'bm-page--modebar')}>
              <div className='grid min-w-0 flex-1 grid-cols-1'>
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
                      {/* Deep link to one shot by source and id */}
                      <Route path='/analyzer/:source/:id' component={ShotAnalyzer} />
                      <Route default component={NotFound} />
                    </Router>
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          </main>
          {!bare && <ModeBar />}
        </div>
      </div>
      <Toasts />
      <LiveRegions />
    </>
  );
}

export function App() {
  return (
    <LocationProvider>
      <ApiServiceContext.Provider value={apiService}>
        <Shell />
      </ApiServiceContext.Provider>
    </LocationProvider>
  );
}

// Must be called before render
initializeTheme();
startAnnouncer();

render(<App />, document.getElementById('app'));
