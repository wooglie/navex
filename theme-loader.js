// Apply dark mode immediately to prevent flash (using localStorage for instant sync access)
(function() {
  'use strict';
  try {
    if (localStorage.getItem('darkMode') === 'true') {
      document.documentElement.classList.add('dark-mode');
    }
  } catch (e) {
    // Silently fail if localStorage is not available
    console.error('Failed to load dark mode preference:', e);
  }
})();
