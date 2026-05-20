/**
 *  ----------------------------------------------------
 *  Zen Browser Pinned Tabs to HTML Bookmarks Converter
 *  ----------------------------------------------------
 */

(function () {
  function getWorkspaceId(el) {
    const id = el.getAttribute("zen-workspace-id");
    return id ? id.replace(/[{}]/g, "") : "default";
  }

  const workspaces = new Map();

  function getUrl(item) {
    return (
      item._originalUrl ||
      (item.linkedBrowser &&
        item.linkedBrowser.currentURI &&
        item.linkedBrowser.currentURI.spec) ||
      null
    );
  }

  function getTitle(item, fallbackUrl) {
    return (
      item.getAttribute("label") ||
      (item.linkedBrowser && item.linkedBrowser.contentTitle) ||
      fallbackUrl
    );
  }

  function ensureWorkspace(wsId) {
    if (!workspaces.has(wsId)) {
      workspaces.set(wsId, {
        essentials: [],
        pinnedOutside: [],
        folders: [],
      });
    }
    return workspaces.get(wsId);
  }

  /** Recursively extract a folder tree node */
  function collectFolder(group) {
    const name = group.getAttribute("label") || group.id || "Untitled";
    const tabs = [];
    const folders = [];

    const items = group.allItems || [];
    items.forEach((item) => {
      if (item.hasAttribute("zen-empty-tab")) return;

      if (item.isZenFolder) {
        folders.push(collectFolder(item));
      } else if (item.tagName.toLowerCase() === "tab") {
        const rawUrl = getUrl(item);
        if (!rawUrl || rawUrl === "about:blank") return;
        tabs.push({ title: getTitle(item, rawUrl), url: rawUrl });
      }
    });

    return { name, tabs, folders };
  }

  /** Render a folder tree node to HTML */
  function renderFolder(folder, indent) {
    const i = "  ".repeat(indent);
    let html = `${i}<DT><H3>${folder.name}</H3>\n`;
    html += `${i}<DL><p>\n`;
    folder.tabs.forEach(({ title, url }) => {
      const safeTitle = title.replace(/"/g, "&quot;");
      const safeUrl = url.replace(/"/g, "&quot;");
      html += `${i}  <DT><A HREF="${safeUrl}">${safeTitle}</A>\n`;
    });
    folder.folders.forEach((sub) => {
      html += renderFolder(sub, indent + 1);
    });
    html += `${i}</DL><p>\n`;
    return html;
  }

  /** Scan all individual tabs */
  const allTabs = gBrowser.tabContainer.querySelectorAll(".tabbrowser-tab");
  allTabs.forEach((tab) => {
    const rawUrl = getUrl(tab);
    if (!rawUrl || rawUrl === "about:blank") return;

    const wsId = getWorkspaceId(tab);
    const ws = ensureWorkspace(wsId);

    if (tab.getAttribute("zen-essential") === "true") {
      ws.essentials.push({ title: getTitle(tab, rawUrl), url: rawUrl });
    } else if (!tab.group?.isZenFolder && tab.hasAttribute("pinned")) {
      ws.pinnedOutside.push({ title: getTitle(tab, rawUrl), url: rawUrl });
    }
  });

  /** Scan all Zen Folder tab groups */
  const allGroups = gBrowser.tabContainer.allGroups || [];
  allGroups.forEach((group) => {
    if (!group.isZenFolder) return;

    const wsId = getWorkspaceId(group);
    const ws = ensureWorkspace(wsId);
    ws.folders.push(collectFolder(group));
  });

  /** Generate a bookmark file for each workspace */
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  workspaces.forEach((wsData, wsId) => {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Zen Browser Bookmarks – Workspace ${wsId}</TITLE>
<H1>Zen Browser Bookmarks – Workspace ${wsId}</H1>
<DL><p>
`;

    if (wsData.essentials.length) {
      html += `  <DT><H3>Essentials</H3>\n`;
      html += `  <DL><p>\n`;
      wsData.essentials.forEach(({ title, url }) => {
        const safeTitle = title.replace(/"/g, "&quot;");
        const safeUrl = url.replace(/"/g, "&quot;");
        html += `    <DT><A HREF="${safeUrl}">${safeTitle}</A>\n`;
      });
      html += `  </DL><p>\n`;
    }

    if (wsData.pinnedOutside.length) {
      html += `  <DT><H3>Pinned Tabs</H3>\n`;
      html += `  <DL><p>\n`;
      wsData.pinnedOutside.forEach(({ title, url }) => {
        const safeTitle = title.replace(/"/g, "&quot;");
        const safeUrl = url.replace(/"/g, "&quot;");
        html += `    <DT><A HREF="${safeUrl}">${safeTitle}</A>\n`;
      });
      html += `  </DL><p>\n`;
    }

    wsData.folders.forEach((folder) => {
      html += renderFolder(folder, 1);
    });

    html += `</DL><p>\n`;

    /** Download the bookmark file for each workspace */
    const blob = new Blob([html], { type: "text/html" });
    const objectURL = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const fileWsId = wsId.replace(/[{}]/g, "");
    a.href = objectURL;
    a.download = `zen-bookmarks-${fileWsId}-${yyyy}${mm}${dd}.html`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectURL);
  });

  console.log(`Exported ${workspaces.size} workspace(s).`);
})();
