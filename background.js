// Simple Dark Mode — background service worker.
// Holds one global on/off flag in chrome.storage; every tab listens to it.

const icons = (state) =>
  Object.fromEntries([16, 32, 48, 128].map((size) => [size, `icons/${state}-${size}.png`]));

async function isEnabled() {
  const { enabled = false } = await chrome.storage.local.get('enabled');
  return enabled;
}

function updateButton(enabled) {
  chrome.action.setIcon({ path: icons(enabled ? 'on' : 'off') });
  chrome.action.setTitle({ title: `Dark mode: ${enabled ? 'ON' : 'OFF'} (click to toggle)` });
}

// Toolbar click (or Alt+Shift+D) flips the flag.
// Clicks are queued so a fast double-click can't get out of sync.
let queue = Promise.resolve();
chrome.action.onClicked.addListener(() => {
  queue = queue
    .then(async () => chrome.storage.local.set({ enabled: !(await isEnabled()) }))
    .catch(console.error);
});

// Keep the toolbar icon in sync with the flag.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'enabled' in changes) updateButton(!!changes.enabled.newValue);
});

chrome.runtime.onStartup.addListener(async () => updateButton(await isEnabled()));

chrome.runtime.onInstalled.addListener(async () => {
  updateButton(await isEnabled());

  // Tabs that were open before the extension was loaded/reloaded don't have
  // the content script yet, so add it now (no need to refresh them).
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file:///*'] });
  for (const tab of tabs) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] })
      .catch(() => {}); // protected pages, discarded tabs, file:// without permission
  }
});
