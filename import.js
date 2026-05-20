/**
 *  ----------------------------------------------------
 *  Zen Browser HTML Bookmarks Import
 *  ----------------------------------------------------
 *  Restores pinned tabs, essentials, and folders from
 *  the HTML bookmark files exported by main.js.
 *
 *  Usage in Browser Console (Ctrl+Shift+J):
 *    zenImport()                     — pick a file
 *    zenImport('<html content>')     — from string
 *  ----------------------------------------------------
 */

async function zenImport(source) {
  const stats = { created: 0, skipped: 0, folders: 0 };

  // ------------------------------------------------------------------
  //  Helpers
  // ------------------------------------------------------------------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function tabUrl(tab) {
    return (
      tab._originalUrl ||
      (tab.linkedBrowser &&
        tab.linkedBrowser.currentURI &&
        tab.linkedBrowser.currentURI.spec) ||
      null
    );
  }

  function isDuplicate(url, wsId, essential) {
    return Array.from(
      gBrowser.tabContainer.querySelectorAll(".tabbrowser-tab"),
    ).some((tab) => {
      const u = tabUrl(tab);
      if (!u || u !== url) return false;
      if (essential) return tab.getAttribute("zen-essential") === "true";
      return (
        tab.hasAttribute("pinned") &&
        tab.getAttribute("zen-workspace-id") === wsId
      );
    });
  }

  function createTab(url, title) {
    return gBrowser.addTrustedTab(url, {
      inBackground: true,
      createLazyBrowser: true,
      lazyTabTitle: title || url,
      skipAnimation: true,
    });
  }

  async function pickFiles() {
    try {
      const fp = Cc["@mozilla.org/filepicker;1"].createInstance(
        Ci.nsIFilePicker,
      );
      fp.init(
        Cu.getGlobalForObject(gBrowser),
        "Select exported bookmark HTML file(s)",
        Ci.nsIFilePicker.modeOpenMultiple,
      );
      fp.appendFilter("HTML files", "*.html;*.htm");
      fp.appendFilters(Ci.nsIFilePicker.filterAll);
      const result = await fp.open();
      if (result === Ci.nsIFilePicker.returnCancel) return [];

      const files = [];
      for (const file of fp.files) {
        files.push({ name: file.leafName, html: await IOUtils.readUTF8(file.path) });
      }
      return files;
    } catch (e) {
      console.warn("File picker failed, falling back to path prompt.", e.message);
      return pickFilesViaPrompt();
    }
  }

  async function pickFilesViaPrompt() {
    const input = prompt(
      "Paste the path to the bookmark HTML file(s), comma-separated for multiple:",
    );
    if (!input) return [];
    const paths = input.split(",").map((p) => p.trim()).filter(Boolean);
    const files = [];
    for (const p of paths) {
      try {
        files.push({
          name: p.replace(/^.*[/\\]/, ""),
          html: await IOUtils.readUTF8(p),
        });
      } catch (e) {
        console.warn(`  Could not read: ${p}`, e.message);
      }
    }
    return files;
  }

  function pickWorkspace() {
    const ws = gZenWorkspaces.getWorkspaces();
    console.log("");
    console.log("Available workspaces:");
    ws.forEach((w, i) =>
      console.log(`  ${i + 1}. ${w.name}${w.icon ? " " + w.icon : ""}`),
    );
    const input = prompt(
      `Target workspace (1\u2013${ws.length})  [Cancel = abort]:`,
    );
    if (input === null) return null;
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= ws.length) {
      console.warn("Invalid choice, try again.");
      return pickWorkspace();
    }
    return ws[idx];
  }

  // ------------------------------------------------------------------
  //  HTML bookmark parser (Netscape format)
  // ------------------------------------------------------------------

  function parseSections(dl, into) {
    const kids = Array.from(dl.childNodes).filter((n) => n.nodeType === 1);

    for (let i = 0; i < kids.length; i++) {
      if (kids[i].nodeName !== "DT") continue;

      const h3 = kids[i].querySelector("H3");
      const a = kids[i].querySelector("A");

      if (h3) {
        const name = h3.textContent.trim();
        const contentDL = kids[i].querySelector("DL");
        if (!contentDL) continue;

        if (name === "Essentials") {
          flatLinks(contentDL, into.essentials);
        } else if (name === "Pinned Tabs") {
          flatLinks(contentDL, into.pinnedOutside);
        } else {
          const folder = { name, tabs: [], folders: [] };
          parseSections(contentDL, folder);
          into.folders.push(folder);
        }
      } else if (a && Array.isArray(into.tabs)) {
        into.tabs.push({
          title: a.textContent,
          url: a.getAttribute("HREF") || "",
        });
      }
    }
  }

  function flatLinks(dl, target) {
    for (const child of dl.childNodes) {
      if (child.nodeType === 1 && child.nodeName === "DT") {
        const a = child.querySelector("A");
        if (a) {
          target.push({
            title: a.textContent,
            url: a.getAttribute("HREF") || "",
          });
        }
      }
    }
  }

  function parseBookmarkHTML(html) {
    const xml = html.replace(/<p\s*\/?>/gi, "<p/>");
    const doc = new DOMParser().parseFromString(xml, "text/html");
    const rootDL = doc.querySelector("DL");
    if (!rootDL) return null;
    const result = { essentials: [], pinnedOutside: [], folders: [] };
    parseSections(rootDL, result);
    return result;
  }

  // ------------------------------------------------------------------
  //  Restoration logic
  // ------------------------------------------------------------------

  async function importEssentials(items, wsId) {
    for (const item of items) {
      if (isDuplicate(item.url, wsId, true)) {
        console.log(`  \u2514 Skipped (exists): ${item.title}`);
        stats.skipped++;
        continue;
      }
      const tab = createTab(item.url, item.title);
      await sleep(40);
      tab.setAttribute("zen-essential", "true");
      tab.removeAttribute("zen-workspace-id");
      gBrowser.pinTab(tab);
      stats.created++;
    }
  }

  async function importPinned(items, wsId) {
    for (const item of items) {
      if (isDuplicate(item.url, wsId, false)) {
        console.log(`  \u2514 Skipped (exists): ${item.title}`);
        stats.skipped++;
        continue;
      }
      const tab = createTab(item.url, item.title);
      await sleep(40);
      gBrowser.pinTab(tab);
      gZenWorkspaces.moveTabsToWorkspace([tab], wsId);
      stats.created++;
    }
  }

  async function importFolder(folderData, wsId, parentFolder) {
    const tabs = [];

    for (const item of folderData.tabs) {
      if (isDuplicate(item.url, wsId, false)) {
        console.log(`  \u2514 Skipped (exists): ${item.title}`);
        stats.skipped++;
        continue;
      }
      const tab = createTab(item.url, item.title);
      await sleep(40);
      tabs.push(tab);
      stats.created++;
    }

    let folder;
    if (parentFolder) {
      folder = gZenFolders.createFolder(tabs, {
        label: folderData.name,
        insertAfter: parentFolder.groupContainer.lastElementChild,
      });
    } else {
      folder = gZenFolders.createFolder(tabs, {
        label: folderData.name,
        workspaceId: wsId,
      });
    }
    await sleep(80);
    console.log(`  \u2514 Folder: ${folderData.name} (${tabs.length} tab(s))`);
    stats.folders++;

    for (const sub of folderData.folders) {
      await importFolder(sub, wsId, folder);
    }
  }

  // ------------------------------------------------------------------
  //  Entry point
  // ------------------------------------------------------------------

  // 1.  Read source(s)
  const sources = [];
  if (source && typeof source === "string") {
    sources.push({ name: "<string>", html: source });
  } else {
    console.log("Select the exported bookmark HTML file(s)\u2026");
    const picked = await pickFiles();
    if (!picked.length) {
      console.log("Import cancelled.");
      return;
    }
    sources.push(...picked);
  }

  // 2.  Parse all files
  const parsedFiles = [];
  for (const s of sources) {
    const data = parseBookmarkHTML(s.html);
    if (!data) {
      console.warn(`  Skipped (parse failed): ${s.name}`);
      continue;
    }
    const total =
      data.essentials.length +
      data.pinnedOutside.length +
      countFolderTabs(data.folders);
    console.log(
      `  ${s.name}: ${data.essentials.length} essential(s), ` +
        `${data.pinnedOutside.length} pinned, ` +
        `${countFolders(data.folders)} folder(s) (${total} tab(s))`,
    );
    if (total > 0) parsedFiles.push(data);
  }

  if (!parsedFiles.length) {
    console.log("Nothing to import.");
    return;
  }

  // 3.  Pick workspace (once for all files)
  const target = pickWorkspace();
  if (!target) {
    console.log("Import cancelled.");
    return;
  }
  console.log(`Target workspace: ${target.name} (${target.uuid})`);

  // 4.  Execute
  console.log("\nImporting\u2026");
  gZenFolders._sessionRestoring = true;

  for (const data of parsedFiles) {
    if (data.essentials.length) {
      console.log("  Essentials\u2026");
      await importEssentials(data.essentials, target.uuid);
    }
    if (data.pinnedOutside.length) {
      console.log("  Pinned tabs\u2026");
      await importPinned(data.pinnedOutside, target.uuid);
    }
    if (data.folders.length) {
      console.log("  Folders\u2026");
      for (const fd of data.folders) {
        await importFolder(fd, target.uuid, null);
      }
    }
  }

  gZenFolders._sessionRestoring = false;
  gBrowser.tabContainer._invalidateCachedTabs();

  // 5.  Report
  console.log(
    `\nDone. Created ${stats.created} tab(s), ` +
      `${stats.folders} folder(s). ` +
      `Skipped ${stats.skipped} existing tab(s).`,
  );
}

// ------------------------------------------------------------------
//  Count helpers (used before import for progress info)
// ------------------------------------------------------------------

function countFolders(folders) {
  let n = folders.length;
  for (const f of folders) n += countFolders(f.folders);
  return n;
}

function countFolderTabs(folders) {
  let n = 0;
  for (const f of folders) {
    n += f.tabs.length;
    n += countFolderTabs(f.folders);
  }
  return n;
}
