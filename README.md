# Navex - Chrome Extension

A Chrome extension that allows you to save webpage shortcuts and navigate to them using the URL bar with the `@` symbol.

**Created by Ivan Magaš @ 800**
Website: [800.hr](https://800.hr)

## Features

- **Quick Navigation**: Type `@` in the URL bar, then your shortcut name to navigate instantly
- **Partial Matching**: Type part of a multi-word shortcut (e.g., type `@` then `maps` for "google maps")
- **Auto-Save from URL Bar**: Type `@` then a new name on any page to save it as a shortcut
- **URL Bar Management**: Delete with `--delete` flag or rename with `--rename` flag
- **Popup Interface**: Save, edit, and delete shortcuts through a clean popup
- **Search Shortcuts**: Quickly find shortcuts in the popup using the search bar
- **Auto-suggestions**: Get suggestions as you type, with hints for new shortcuts
- **Desktop Notifications**: Get visual feedback when managing shortcuts from the URL bar
- **Dark Mode**: Toggle between light and dark themes in settings
- **Favicon Caching**: Automatically caches website favicons for better performance
- **Import/Export**: Backup and restore your shortcuts via JSON files
- **Settings Page**: Manage preferences, appearance, and data

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right corner)
3. Click "Load unpacked"
4. Select the `chrome-shortcuts-addon` folder
5. The extension should now be installed and active

## Usage

### Saving a Shortcut

**Method 1: From the URL Bar (Quick Save)**
1. Navigate to the page you want to save
2. Click in the Chrome URL bar (or press `Ctrl+L` / `Cmd+L`)
3. Type `@` (this activates the extension)
4. Type a new shortcut name (e.g., `gmail`)
5. Press Enter
6. A notification will confirm the shortcut was saved
7. You'll remain on the same page

**Method 2: From the Popup**
1. Click the extension icon in your Chrome toolbar
2. The current page URL will be automatically filled in
3. Enter a shortcut name (e.g., "gmail", "github", "docs")
4. Click "Save Shortcut"

### Navigating with Shortcuts

1. Click in the Chrome URL bar (or press `Ctrl+L` / `Cmd+L`)
2. Type `@` (this activates the extension)
3. Type your shortcut name (e.g., `gmail`)
4. You'll see suggestions as you type:
   - Existing shortcuts will show "Navigate to: [name]"
   - New names will show "Save current page as: [name]"
5. Press Enter to navigate (if shortcut exists) or save (if new)

**Note:** You type `@` first to activate the extension, then type the name. The URL bar will show the `@` symbol followed by your input.

### Managing Shortcuts

**From the Popup:**
- **Search**: Use the search bar to quickly find shortcuts by name or URL
- **Edit**: Click "Edit" to modify a shortcut's name or URL
- **Delete**: Click "Delete" to remove a shortcut

**From the URL Bar:**

All commands start with `@` followed by the command:

1. **Delete a shortcut**:
   - Type `@` then `shortcutname --delete`
   - Example: Type `@`, then `gmail --delete` to delete the "gmail" shortcut
   - Works with partial matching: `maps --delete` can delete "google maps"

2. **Rename a shortcut**:
   - Type `@` then `oldname --rename newname`
   - Example: Type `@`, then `gh --rename github` to rename "gh" to "github"
   - Works with partial matching: `maps --rename gmaps` can rename "google maps" to "gmaps"

## File Structure

```
chrome-shortcuts-addon/
├── manifest.json       # Extension configuration
├── background.js       # Background service worker (omnibox handling)
├── popup.html         # Popup interface structure
├── popup.js           # Popup functionality
├── popup.css          # Popup styling
├── theme-loader.js    # Dark mode theme loader
├── icons/             # Extension icons
│   ├── icon.svg       # Source SVG icon
│   ├── icon16.png     # 16x16 icon
│   ├── icon48.png     # 48x48 icon
│   └── icon128.png    # 128x128 icon
└── README.md          # This file
```

## Icons

The extension includes icon files in three sizes (16x16, 48x48, and 128x128 pixels) in the `icons/` folder. The icons feature a minimal, flat design with the `@` symbol in blue (#3b82f6) on a rounded square background. The source SVG file (`icon.svg`) can be edited to customize the design.

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension format)
- **Storage**: Uses Chrome's `sync` storage (syncs across devices) and localStorage for theme preferences
- **Permissions**:
  - `storage`: To save shortcuts and preferences
  - `tabs`: To get current tab URL and navigate
  - `notifications`: To show save confirmation notifications
- **Host Permissions**:
  - `https://www.google.com/*`: For fetching favicons
  - `https://*.gstatic.com/*`: For favicon CDN access
- **APIs Used**:
  - Omnibox API: For URL bar integration with `@` keyword
  - Storage API: For persisting shortcuts and settings
  - Tabs API: For navigation and getting current page URL
  - Notifications API: For visual feedback on save
  - Fetch API: For caching website favicons

## Troubleshooting

**Issue**: Extension doesn't show up after installation
- Make sure Developer mode is enabled in `chrome://extensions/`
- Check for any errors in the extension card

**Issue**: `@` trigger doesn't work in URL bar
- Make sure the extension is enabled
- Try reloading the extension from `chrome://extensions/`
- Click in the URL bar and type `@` followed by a space

**Issue**: Shortcuts not saving
- Check Chrome storage limits (100KB for sync storage)
- Open the popup and check the browser console for errors
- For URL bar saves: Make sure you're not on a `chrome://` page (these cannot be saved)

**Issue**: No notification when saving from URL bar
- Check that you've granted notification permissions to the extension
- Check Chrome's notification settings in your OS
- Try reloading the extension

**Issue**: Typing `@name` navigates instead of saving
- If `name` already exists as a shortcut, it will navigate to that URL
- Use a different name, or delete the old shortcut first from the popup

## Future Enhancements

Possible improvements for future versions:
- Organize shortcuts into folders/categories
- Keyboard shortcuts for quick access
- Custom URL bar trigger (instead of `@`)
- Shortcut usage statistics
- Cloud sync across browsers
- Tags for better organization

## Author

**Ivan Magaš @ 800**
Website: [800.hr](https://800.hr)

## License

Free to use and modify.
