// Popup functionality for managing shortcuts

document.addEventListener("DOMContentLoaded", () => {
  // Main view elements
  const shortcutNameInput = document.getElementById("shortcut-name");
  const shortcutUrlInput = document.getElementById("shortcut-url");
  const saveBtn = document.getElementById("save-btn");
  const saveMessage = document.getElementById("save-message");
  const shortcutsList = document.getElementById("shortcuts-list");
  const searchInput = document.getElementById("search-shortcuts");

  // View navigation
  const mainView = document.getElementById("main-view");
  const settingsView = document.getElementById("settings-view");
  const settingsBtn = document.getElementById("settings-btn");
  const backBtn = document.getElementById("back-btn");

  // Settings elements
  const themeToggle = document.getElementById("theme-toggle");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  const clearAllBtn = document.getElementById("clear-all-btn");
  const settingsMessage = document.getElementById("settings-message");

  // Load dark mode preference (sync from chrome.storage to localStorage)
  chrome.storage.sync.get(["darkMode"], (result) => {
    const isDarkMode =
      result.darkMode || localStorage.getItem("darkMode") === "true";
    if (isDarkMode) {
      document.documentElement.classList.add("dark-mode");
      themeToggle.checked = true;
      localStorage.setItem("darkMode", "true");
    }
  });

  // Navigation handlers
  settingsBtn.addEventListener("click", () => {
    mainView.classList.add("hidden");
    settingsView.classList.remove("hidden");
  });

  backBtn.addEventListener("click", () => {
    settingsView.classList.add("hidden");
    mainView.classList.remove("hidden");
  });

  // Dark mode toggle
  themeToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      document.documentElement.classList.add("dark-mode");
      localStorage.setItem("darkMode", "true");
      chrome.storage.sync.set({ darkMode: true });
    } else {
      document.documentElement.classList.remove("dark-mode");
      localStorage.setItem("darkMode", "false");
      chrome.storage.sync.set({ darkMode: false });
    }
  });

  // Export shortcuts
  exportBtn.addEventListener("click", () => {
    chrome.storage.local.get(["shortcuts"], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        showSettingsMessage('Failed to export shortcuts', 'error');
        return;
      }
      const shortcuts = result.shortcuts || {};
      const dataStr = JSON.stringify(shortcuts, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `shortcuts-backup-${
        new Date().toISOString().split("T")[0]
      }.json`;
      link.click();
      URL.revokeObjectURL(url);

      showSettingsMessage(
        `Exported ${Object.keys(shortcuts).length} shortcuts`,
        "success"
      );
    });
  });

  // Import shortcuts
  importBtn.addEventListener("click", () => {
    importFile.click();
  });

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedShortcuts = JSON.parse(event.target.result);

        // Validate the imported data
        if (
          typeof importedShortcuts !== "object" ||
          Array.isArray(importedShortcuts)
        ) {
          throw new Error("Invalid format");
        }

        // Merge with existing shortcuts
        chrome.storage.local.get(["shortcuts"], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Storage error:', chrome.runtime.lastError);
            showSettingsMessage('Failed to import shortcuts', 'error');
            return;
          }
          const existingShortcuts = result.shortcuts || {};
          const mergedShortcuts = {
            ...existingShortcuts,
            ...importedShortcuts,
          };

          chrome.storage.local.set({ shortcuts: mergedShortcuts }, () => {
            if (chrome.runtime.lastError) {
              console.error('Storage error:', chrome.runtime.lastError);
              showSettingsMessage('Failed to import shortcuts. Storage quota may be exceeded.', 'error');
              return;
            }
            const newCount = Object.keys(importedShortcuts).length;
            showSettingsMessage(
              `Imported ${newCount} shortcuts successfully`,
              "success"
            );
            loadShortcuts();
          });
        });
      } catch (error) {
        showSettingsMessage(
          "Invalid file format. Please select a valid JSON file.",
          "error"
        );
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset file input
  });

  // Clear all shortcuts
  clearAllBtn.addEventListener("click", () => {
    if (
      confirm(
        "Are you sure you want to delete ALL shortcuts? This cannot be undone!"
      )
    ) {
      chrome.storage.local.set({ shortcuts: {} }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          showSettingsMessage('Failed to clear shortcuts', 'error');
          return;
        }
        showSettingsMessage("All shortcuts cleared", "success");
        loadShortcuts();
      });
    }
  });

  // Load current tab URL when popup opens
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      shortcutUrlInput.value = tabs[0].url;
    }
  });

  // Load and display existing shortcuts
  loadShortcuts();

  // Set current year in copyright
  const yearSpan = document.querySelector(".year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Save shortcut button click
  saveBtn.addEventListener("click", saveShortcut);

  // Allow Enter key to save
  shortcutNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") saveShortcut();
  });

  // Search shortcuts
  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const shortcutItems = document.querySelectorAll(".shortcut-item");

    shortcutItems.forEach((item) => {
      const name = item.dataset.name.toLowerCase();
      const url = item.querySelector(".shortcut-url").textContent.toLowerCase();

      if (name.includes(searchTerm) || url.includes(searchTerm)) {
        item.classList.remove("hidden");
      } else {
        item.classList.add("hidden");
      }
    });
  });

  function saveShortcut() {
    const name = shortcutNameInput.value.trim();
    const url = shortcutUrlInput.value.trim();

    // Validation
    if (!name) {
      showMessage("Please enter a shortcut name", "error");
      return;
    }

    if (!url) {
      showMessage("Please enter a URL", "error");
      return;
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      showMessage("Please enter a valid URL", "error");
      return;
    }

    // Show saving message
    showMessage("Saving shortcut...", "success");

    // Save to Chrome storage
    chrome.storage.local.get(["shortcuts"], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        showMessage('Failed to save shortcut. Storage error occurred.', 'error');
        return;
      }
      const shortcuts = result.shortcuts || {};
      shortcuts[name] = { url: url };

      chrome.storage.local.set({ shortcuts }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          showMessage('Failed to save shortcut. Storage quota may be exceeded.', 'error');
          return;
        }
        showMessage(`Shortcut "${name}" saved successfully!`, "success");
        shortcutNameInput.value = "";
        loadShortcuts();
      });
    });
  }

  function loadShortcuts() {
    chrome.storage.local.get(["shortcuts"], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        shortcutsList.innerHTML = '<p class="empty-state">Error loading shortcuts</p>';
        return;
      }
      const shortcuts = result.shortcuts || {};
      displayShortcuts(shortcuts);
    });
  }

  function displayShortcuts(shortcuts) {
    const entries = Object.entries(shortcuts);

    if (entries.length === 0) {
      shortcutsList.innerHTML =
        '<p class="empty-state">No shortcuts saved yet. Add one above!</p>';
      return;
    }

    shortcutsList.innerHTML = entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, data]) => {
        const url = data.url || data; // Support both old (string) and new (object) format
        return `
          <div class="shortcut-item" data-name="${escapeHtml(name)}">
            <div class="shortcut-info">
              <img src="${getDefaultFavicon()}" class="shortcut-favicon" alt="" data-url="${escapeHtml(url)}">
              <div class="shortcut-details">
                <div class="shortcut-name">${escapeHtml(name)}</div>
                <div class="shortcut-url">${escapeHtml(url)}</div>
              </div>
            </div>
            <div class="shortcut-actions">
              <button class="btn btn-small btn-edit" data-name="${escapeHtml(
                name
              )}" data-url="${escapeHtml(url)}">Edit</button>
              <button class="btn btn-small btn-delete" data-name="${escapeHtml(
                name
              )}">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");

    // Fetch favicons on-demand for all shortcuts
    document.querySelectorAll(".shortcut-favicon").forEach((img) => {
      const url = img.dataset.url;
      fetchFavicon(url).then(faviconUrl => {
        img.src = faviconUrl;
      });
    });

    // Add event listeners to edit and delete buttons
    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const name = e.target.dataset.name;
        const url = e.target.dataset.url;
        editShortcut(name, url);
      });
    });

    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const name = e.target.dataset.name;
        deleteShortcut(name);
      });
    });
  }

  function editShortcut(name, url) {
    // Populate the form with existing values
    shortcutNameInput.value = name;
    shortcutUrlInput.value = url;
    shortcutNameInput.focus();

    // Delete the old entry when saving (since we're updating)
    const originalSaveHandler = saveBtn.onclick;
    saveBtn.textContent = "Update Shortcut";

    const updateHandler = () => {
      const newName = shortcutNameInput.value.trim();
      const newUrl = shortcutUrlInput.value.trim();

      if (!newName || !newUrl || !isValidUrl(newUrl)) {
        showMessage("Please enter valid name and URL", "error");
        return;
      }

      showMessage("Updating shortcut...", "success");

      // Delete the old shortcut and save the new one
      chrome.storage.local.get(["shortcuts"], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          showMessage('Failed to update shortcut. Storage error occurred.', 'error');
          return;
        }
        const shortcuts = result.shortcuts || {};
        delete shortcuts[name];

        shortcuts[newName] = { url: newUrl };

        chrome.storage.local.set({ shortcuts }, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage error:', chrome.runtime.lastError);
            showMessage('Failed to update shortcut. Storage quota may be exceeded.', 'error');
            return;
          }
          showMessage(`Shortcut "${newName}" updated successfully!`, "success");
          shortcutNameInput.value = "";
          shortcutUrlInput.value = "";
          saveBtn.textContent = "Save Shortcut";
          saveBtn.onclick = originalSaveHandler;
          loadShortcuts();
        });
      });
    };

    saveBtn.onclick = updateHandler;
  }

  function deleteShortcut(name) {
    if (!confirm(`Are you sure you want to delete the shortcut "${name}"?`)) {
      return;
    }

    chrome.storage.local.get(["shortcuts"], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        showMessage('Failed to delete shortcut. Storage error occurred.', 'error');
        return;
      }
      const shortcuts = result.shortcuts || {};
      delete shortcuts[name];

      chrome.storage.local.set({ shortcuts }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          showMessage('Failed to delete shortcut.', 'error');
          return;
        }
        showMessage(`Shortcut "${name}" deleted`, "success");
        loadShortcuts();
      });
    });
  }

  function showMessage(text, type) {
    saveMessage.textContent = text;
    saveMessage.className = `message ${type}`;
    saveMessage.style.display = "block";

    setTimeout(() => {
      saveMessage.style.display = "none";
    }, 3000);
  }

  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  async function fetchFavicon(url) {
    try {
      const urlObj = new URL(url);
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
      return faviconUrl;
    } catch (e) {
      console.error("Invalid URL for favicon:", e);
      return getDefaultFavicon();
    }
  }

  function getDefaultFavicon() {
    // Return a default link icon as SVG data URL
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239ca3af"%3E%3Cpath d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/%3E%3C/svg%3E';
  }

  function showSettingsMessage(text, type) {
    settingsMessage.textContent = text;
    settingsMessage.className = `message ${type}`;
    settingsMessage.style.display = "block";

    setTimeout(() => {
      settingsMessage.style.display = "none";
    }, 3000);
  }
});
