// The web's themes are Light and Dark on <html data-theme>; System follows the OS. The stored
// value keeps the key and the values of earlier releases.
const THEME_STORAGE_KEY = 'gaggimate-daisyui-theme';
const AVAILABLE_THEMES = ['system', 'light', 'dark'];
const LEGACY_THEMES = { coffee: 'dark', nord: 'light' };

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function getSystemTheme() {
  return mediaQuery.matches ? 'dark' : 'light';
}

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const theme = LEGACY_THEMES[stored] || stored;
    return AVAILABLE_THEMES.includes(theme) ? theme : 'system';
  } catch (error) {
    console.warn('Failed to get stored theme:', error);
    return 'system';
  }
}

export function setStoredTheme(theme) {
  try {
    if (AVAILABLE_THEMES.includes(theme)) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      applyTheme(theme);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to set stored theme:', error);
    return false;
  }
}

export function applyTheme(theme) {
  if (!AVAILABLE_THEMES.includes(theme)) {
    return;
  }
  const root = document.documentElement;
  root.setAttribute('data-theme', theme === 'system' ? getSystemTheme() : theme);
  // The browser's own chrome takes the page ground, which index.html sets for each theme.
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = getComputedStyle(root).backgroundColor;
}

export function getAvailableThemes() {
  return AVAILABLE_THEMES.map(theme => ({
    value: theme,
    label: theme.charAt(0).toUpperCase() + theme.slice(1),
  }));
}

function onSystemThemeChange() {
  if (getStoredTheme() === 'system') {
    applyTheme('system');
  }
}

// Initialize theme on load
export function initializeTheme() {
  const theme = getStoredTheme();
  mediaQuery.addEventListener('change', onSystemThemeChange);
  applyTheme(theme);
}

// Simple function to handle theme change from select element
export function handleThemeChange(event) {
  const theme = event.target.value;
  setStoredTheme(theme);
}
