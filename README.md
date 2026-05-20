# Zen Pinned Tabs to HTML Bookmarks Converter

## Overview

This project provides scripts for converting pinned tabs in the **Zen Browser** to standard HTML bookmarks files and restoring them back. Export produces one file per workspace with embedded workspace metadata; import reads that metadata and restores each file into its original workspace.

> [!WARNING]
> Tested on Zen 1.19.13b

## Usage

Copy and paste the contents of the script into the Browser Console.

> [!IMPORTANT]
> Set `devtools.chrome.enabled` to `true` in `about:config`

The Browser Console can be accessed via:
- **Command ⌘ + Shift ⇧ + J** on Mac
- **Ctrl + Shift + J** on Linux/Windows

### Export - `export.js`
Paste the script - one `.html` file downloads per workspace.

### Import - `import.js`
Paste the script - select the exported HTML file(s). Each file is restored into the workspace it was exported from. Tabs that already exist are skipped.

To quickly copy the exported file paths to your clipboard:

```bash
# Linux (Wayland)
ls -m ~/Downloads/zen-bookmarks*.html | wl-copy

# Linux (X11)
ls -m ~/Downloads/zen-bookmarks*.html | xclip -selection clipboard

# macOS
ls -m ~/Downloads/zen-bookmarks*.html | pbcopy

# Windows (PowerShell)
Get-ChildItem ~\Downloads\zen-bookmarks*.html | Join-String -Separator ", " | Set-Clipboard
```

You can also pass HTML content directly:

```js
zenImport('<!DOCTYPE NETSCAPE-Bookmark-file-1>...')
```

## How It Works

1. **Discover Workspaces** - Scans all open tabs and Zen‑folder groups, extracting the `zen-workspace-id` attribute to identify each distinct workspace.
2. **Collect Bookmark Data** - Builds a workspace‑specific map that separates essentials, pinned tabs outside folders, and folder‑grouped tabs.
3. **Build Hierarchical Trees** - Converts the collected data into a nested bookmark structure ready for HTML conversion.
4. **Export to HTML** - Creates a Netscape‑Bookmark‑file for every workspace with embedded workspace metadata and triggers a download.
5. **Import from HTML** - Parses the workspace metadata from the file, resolves it against the current session, and restores essentials, pinned tabs, and nested folders into the correct workspace. Skips tabs that already exist.
