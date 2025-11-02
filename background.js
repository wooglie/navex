// Background service worker for handling omnibox and navigation

// Helper function to escape XML/HTML special characters
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Listen for omnibox input changes
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  chrome.storage.sync.get(["shortcuts"], (result) => {
    const shortcuts = result.shortcuts || {};
    const suggestions = [];
    const trimmedText = text.trim();

    // Check for --delete flag
    if (trimmedText.includes(' --delete')) {
      const shortcutName = trimmedText.replace(/\s+--delete\s*$/i, '').trim();
      const matchedShortcut = findBestMatch(shortcutName, shortcuts);

      if (matchedShortcut) {
        const url = shortcuts[matchedShortcut].url;
        suggestions.push({
          content: `__DELETE__:${matchedShortcut}`,
          description: `Delete shortcut: <match>${escapeXml(matchedShortcut)}</match> - ${escapeXml(url)}`,
        });
      } else {
        suggestions.push({
          content: text,
          description: `No shortcut found matching "${escapeXml(shortcutName)}"`,
        });
      }

      suggest(suggestions);
      return;
    }

    // Check for --rename flag
    const renameMatch = trimmedText.match(/^(.+?)\s+--rename\s+(.+)$/i);
    if (renameMatch) {
      const oldName = renameMatch[1].trim();
      const newName = renameMatch[2].trim();
      const matchedShortcut = findBestMatch(oldName, shortcuts);

      if (matchedShortcut) {
        suggestions.push({
          content: `__RENAME__:${matchedShortcut}:${newName}`,
          description: `Rename "<match>${escapeXml(matchedShortcut)}</match>" to "<match>${escapeXml(newName)}</match>"`,
        });
      } else {
        suggestions.push({
          content: text,
          description: `No shortcut found matching "${escapeXml(oldName)}"`,
        });
      }

      suggest(suggestions);
      return;
    }

    // Normal search behavior
    const lowerText = trimmedText.toLowerCase();

    // Separate matches by priority
    const exactMatches = [];
    const startsWithMatches = [];
    const wordStartsWithMatches = [];
    const containsMatches = [];

    for (const [name, data] of Object.entries(shortcuts)) {
      const lowerName = name.toLowerCase();
      const url = data.url;

      if (lowerName === lowerText) {
        // Exact match - highest priority
        exactMatches.push({
          content: name,
          description: `Navigate to: <match>${escapeXml(name)}</match> - ${escapeXml(url)}`,
        });
      } else if (lowerName.startsWith(lowerText)) {
        // Starts with the search text - high priority
        startsWithMatches.push({
          content: name,
          description: `Shortcut: <match>${escapeXml(name)}</match> - ${escapeXml(url)}`,
        });
      } else {
        // Check if any word in the name starts with the search text
        const words = lowerName.split(/[\s\-_]+/); // Split by space, hyphen, or underscore
        const wordMatches = words.some(word => word.startsWith(lowerText));

        if (wordMatches) {
          // Any word starts with search text - medium priority
          wordStartsWithMatches.push({
            content: name,
            description: `Shortcut: <match>${escapeXml(name)}</match> - ${escapeXml(url)}`,
          });
        } else if (lowerName.includes(lowerText)) {
          // Contains the search text anywhere - lower priority
          containsMatches.push({
            content: name,
            description: `Shortcut: <match>${escapeXml(name)}</match> - ${escapeXml(url)}`,
          });
        }
      }
    }

    // Add suggestions in priority order: exact, starts with, word starts with, contains
    suggestions.push(...exactMatches, ...startsWithMatches, ...wordStartsWithMatches, ...containsMatches);

    // If no exact match exists, show option to save current page at the end
    if (exactMatches.length === 0 && trimmedText) {
      suggestions.push({
        content: `__SAVE__:${trimmedText}`,
        description: `Save current page as: <match>${escapeXml(trimmedText)}</match>`,
      });
    }

    suggest(suggestions);
  });
});

// Listen for omnibox input entered (user selected a suggestion or pressed Enter)
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  // Check if this is a delete command
  if (text.startsWith('__DELETE__:')) {
    const shortcutName = text.substring(11).trim();
    deleteShortcut(shortcutName);
    return;
  }

  // Check if this is a rename command
  if (text.startsWith('__RENAME__:')) {
    const parts = text.substring(11).split(':');
    if (parts.length >= 2) {
      const oldName = parts[0].trim();
      const newName = parts.slice(1).join(':').trim(); // Handle colons in new name
      renameShortcut(oldName, newName);
    }
    return;
  }

  // Check if this is a save command
  if (text.startsWith('__SAVE__:')) {
    const shortcutName = text.substring(9).trim();
    saveCurrentPageAsShortcut(shortcutName);
    return;
  }

  // Check for --delete flag in raw text (when user presses Enter without selecting)
  if (text.includes(' --delete')) {
    const shortcutName = text.replace(/\s+--delete\s*$/i, '').trim();
    chrome.storage.sync.get(["shortcuts"], (result) => {
      const shortcuts = result.shortcuts || {};
      const matchedShortcut = findBestMatch(shortcutName, shortcuts);

      if (matchedShortcut) {
        deleteShortcut(matchedShortcut);
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Shortcut Not Found',
          message: `Could not find a shortcut matching "${shortcutName}"`
        });
      }
    });
    return;
  }

  // Check for --rename flag in raw text (when user presses Enter without selecting)
  const renameMatch = text.match(/^(.+?)\s+--rename\s+(.+)$/i);
  if (renameMatch) {
    const oldName = renameMatch[1].trim();
    const newName = renameMatch[2].trim();

    chrome.storage.sync.get(["shortcuts"], (result) => {
      const shortcuts = result.shortcuts || {};
      const matchedShortcut = findBestMatch(oldName, shortcuts);

      if (matchedShortcut) {
        renameShortcut(matchedShortcut, newName);
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Shortcut Not Found',
          message: `Could not find a shortcut matching "${oldName}"`
        });
      }
    });
    return;
  }

  // Check if the text is a shortcut name
  chrome.storage.sync.get(["shortcuts"], (result) => {
    const shortcuts = result.shortcuts || {};

    // If exact match exists, navigate to it
    if (shortcuts[text]) {
      const url = shortcuts[text].url;
      navigateToUrl(url, disposition);
      return;
    }

    // Try to find a partial match using the same logic as suggestions
    const matchedShortcut = findBestMatch(text, shortcuts);

    if (matchedShortcut) {
      // Found a match - navigate to it
      const url = shortcuts[matchedShortcut].url;
      navigateToUrl(url, disposition);
    } else {
      // No match found - save the current page as this shortcut
      saveCurrentPageAsShortcut(text);
    }
  });
});

// Helper function to find the best matching shortcut name
function findBestMatch(searchText, shortcuts) {
  const lowerText = searchText.toLowerCase();

  // Try exact match first
  for (const name of Object.keys(shortcuts)) {
    if (name.toLowerCase() === lowerText) {
      return name;
    }
  }

  // Try starts with
  for (const name of Object.keys(shortcuts)) {
    if (name.toLowerCase().startsWith(lowerText)) {
      return name;
    }
  }

  // Try word starts with
  for (const name of Object.keys(shortcuts)) {
    const lowerName = name.toLowerCase();
    const words = lowerName.split(/[\s\-_]+/);
    if (words.some(word => word.startsWith(lowerText))) {
      return name;
    }
  }

  // Try contains
  for (const name of Object.keys(shortcuts)) {
    if (name.toLowerCase().includes(lowerText)) {
      return name;
    }
  }

  return null; // No match found
}

// Helper function to fetch and cache favicon
async function fetchAndCacheFavicon(url) {
  try {
    const urlObj = new URL(url);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;

    const response = await fetch(faviconUrl);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(getDefaultFavicon());
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return getDefaultFavicon();
  }
}

// Helper function to get default favicon
function getDefaultFavicon() {
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239ca3af"%3E%3Cpath d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/%3E%3C/svg%3E';
}

// Helper function to save current page as a shortcut
async function saveCurrentPageAsShortcut(shortcutName) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tabs[0]) {
    const currentUrl = tabs[0].url;

    // Don't save chrome:// or extension pages
    if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Cannot Save Shortcut',
        message: `Cannot save Chrome internal pages as shortcuts.`
      });
      return;
    }

    // Fetch favicon
    const favicon = await fetchAndCacheFavicon(currentUrl);

    // Save the shortcut with cached favicon
    chrome.storage.sync.get(["shortcuts"], (result) => {
      const shortcuts = result.shortcuts || {};
      shortcuts[shortcutName] = {
        url: currentUrl,
        favicon: favicon
      };
      chrome.storage.sync.set({ shortcuts }, () => {
        // Show success notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Shortcut Saved!',
          message: `"${shortcutName}" now points to:\n${currentUrl}`
        });
      });
    });
  }
}

// Helper function to delete a shortcut
function deleteShortcut(shortcutName) {
  chrome.storage.sync.get(["shortcuts"], (result) => {
    const shortcuts = result.shortcuts || {};

    if (shortcuts[shortcutName]) {
      const deletedUrl = shortcuts[shortcutName];
      delete shortcuts[shortcutName];

      chrome.storage.sync.set({ shortcuts }, () => {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Shortcut Deleted!',
          message: `"${shortcutName}" has been deleted.\nURL was: ${deletedUrl}`
        });
      });
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Shortcut Not Found',
        message: `Could not find shortcut "${shortcutName}"`
      });
    }
  });
}

// Helper function to rename a shortcut
function renameShortcut(oldName, newName) {
  chrome.storage.sync.get(["shortcuts"], (result) => {
    const shortcuts = result.shortcuts || {};

    if (!shortcuts[oldName]) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Shortcut Not Found',
        message: `Could not find shortcut "${oldName}"`
      });
      return;
    }

    if (shortcuts[newName]) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Name Already Exists',
        message: `A shortcut named "${newName}" already exists. Choose a different name.`
      });
      return;
    }

    // Copy the URL to the new name and delete the old one
    const url = shortcuts[oldName];
    shortcuts[newName] = url;
    delete shortcuts[oldName];

    chrome.storage.sync.set({ shortcuts }, () => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Shortcut Renamed!',
        message: `"${oldName}" renamed to "${newName}"\nURL: ${url}`
      });
    });
  });
}

// Helper function to navigate to URL
function navigateToUrl(url, disposition) {
  // Ensure URL has proper protocol
  if (!url.match(/^https?:\/\//i)) {
    url = "http://" + url;
  }

  // Navigate based on disposition
  switch (disposition) {
    case "currentTab":
      chrome.tabs.update({ url: url });
      break;
    case "newForegroundTab":
      chrome.tabs.create({ url: url });
      break;
    case "newBackgroundTab":
      chrome.tabs.create({ url: url, active: false });
      break;
  }
}

// Set default text in omnibox
chrome.omnibox.setDefaultSuggestion({
  description: "Type a shortcut name to navigate or save a new one",
});
