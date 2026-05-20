# Zen Browser Pinned Tabs — Export & Import

Two scripts to export pinned tabs (essentials, folders, subfolders) from Zen Browser into standard HTML bookmarks and restore them back.

> [!WARNING]
> Tested on Zen v1.16t

> [!IMPORTANT]
> Set `devtools.chrome.enabled` to `true` in `about:config`

---

## Export — `main.js`

Copies all pinned tabs, essentials, and folder structures into one HTML bookmark file per workspace.

### Usage

1. Open the **Browser Console**:
   - <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd> (Linux/Windows)
   - <kbd>Command ⌘</kbd> + <kbd>Shift ⇧</kbd> + <kbd>J</kbd> (Mac)
2. Paste the entire contents of `main.js` and press Enter.
3. One `.html` file downloads per workspace.

### Output

Each file is a standard Netscape bookmark HTML, importable into any browser:
```
zen-bookmarks-<workspace-uuid>-<YYYYMMDD>.html
```

The file contains:
- **Essentials** – tabs marked as essential (shown in every workspace)
- **Pinned Tabs** – pinned tabs not inside any folder
- **Folders** – Zen folders with their tabs (including nested subfolders)

---

## Import — `import.js`

Restores tabs, essentials, and folder structures from an exported HTML file back into Zen.

### Usage

1. Open the **Browser Console**.
2. Paste the entire contents of `import.js` and press Enter.
3. Call the function:

   ```js
   zenImport()  // opens a native file picker
   ```

   Or pass the HTML content directly:

   ```js
   zenImport('<!DOCTYPE NETSCAPE-Bookmark-file-1>...')
   ```

4. A numbered list of workspaces appears in the console — type the number of the target workspace in the `prompt()` dialog.
5. The script restores essentials, pinned tabs, and folders with subfolders.

### Behaviour

- **Idempotent** — tabs whose URL already exists as a pinned tab in the target workspace (or as an essential globally) are skipped.
- **Folders** are recreated including their full nested subfolder tree.
- **Essentials** are restored as global essential tabs.
- **Animations are suppressed** during import for performance.

---

## Files

| File | Purpose |
|------|---------|
| `main.js` | Export: paste & run — downloads one HTML bookmark file per workspace |
| `import.js` | Import: paste & run + call `zenImport()` — restores from an exported HTML file |
