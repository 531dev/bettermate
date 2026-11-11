const SETUP_DISMISSED_KEY = 'bettermate.setupDismissed';

export const isSetupDismissed = () => {
  try {
    return localStorage.getItem(SETUP_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const dismissSetup = () => {
  try {
    localStorage.setItem(SETUP_DISMISSED_KEY, 'true');
  } catch {
    // Restricted browser: setup just offers itself again on the next visit.
  }
};
