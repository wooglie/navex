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
  chrome.storage.local.get(["shortcuts"], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      suggest([]);
      return;
    }
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
    chrome.storage.local.get(["shortcuts"], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        return;
      }
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

    chrome.storage.local.get(["shortcuts"], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        return;
      }
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
  chrome.storage.local.get(["shortcuts"], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      return;
    }
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

    // Save the shortcut
    chrome.storage.local.get(["shortcuts"], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Error',
          message: 'Failed to save shortcut. Storage error occurred.'
        });
        return;
      }
      const shortcuts = result.shortcuts || {};
      shortcuts[shortcutName] = { url: currentUrl };

      chrome.storage.local.set({ shortcuts }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Error',
            message: 'Failed to save shortcut. Storage quota may be exceeded.'
          });
          return;
        }
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
  chrome.storage.local.get(["shortcuts"], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      return;
    }
    const shortcuts = result.shortcuts || {};

    if (shortcuts[shortcutName]) {
      const deletedUrl = shortcuts[shortcutName].url || shortcuts[shortcutName];
      delete shortcuts[shortcutName];

      chrome.storage.local.set({ shortcuts }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Error',
            message: 'Failed to delete shortcut.'
          });
          return;
        }
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
  chrome.storage.local.get(["shortcuts"], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      return;
    }
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

    // Copy the data to the new name and delete the old one
    const data = shortcuts[oldName];
    shortcuts[newName] = data;
    delete shortcuts[oldName];

    chrome.storage.local.set({ shortcuts }, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Error',
          message: 'Failed to rename shortcut.'
        });
        return;
      }
      const url = data.url || data;
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
