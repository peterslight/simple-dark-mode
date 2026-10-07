// Simple Dark Mode — content script (runs in every page and frame).
//
// How it works: the whole page is colour-inverted with a CSS filter, and
// images / video / canvas / iframes are inverted a second time so they keep
// their real colours. Because it is pure CSS, it automatically covers content
// that JavaScript adds later (SPAs, infinite scroll, etc.).
// Pages that already have a dark theme are detected and left alone.

(() => {
  const STYLE_ID = 'simple-dark-mode-style';
  const IS_TOP = window === window.top;
  const CACHE_KEY = 'dark:' + (location.host || location.protocol); // remembers sites that are already dark

  const INVERT = 'invert(1) hue-rotate(180deg)';

  // Things that should keep their original colours (inverted twice = unchanged).
  // Iframes are flipped back too, because each frame runs its own copy of this script.
  const KEEP = [
    'img', 'video', 'canvas', 'embed', 'object', 'iframe', 'svg image',
    '[style*="background" i][style*="url(" i]', // background images set inline / by JS
  ].join(', ');

  const CSS = `
    html { filter: ${INVERT} !important; }
    ${IS_TOP ? ':where(html) { background-color: Canvas; }' : '' /* so blank page backgrounds get inverted too */}
    ${KEEP} { filter: ${INVERT} !important; }
    :is(${KEEP}) :is(${KEEP}) { filter: none !important; }

    /* Fullscreen video players, modal dialogs and popovers render outside the
       page's filter, so they need their own handling. */
    :not(html):fullscreen:is(${KEEP}),
    :not(html):fullscreen :is(${KEEP}) { filter: none !important; }
    dialog:modal { filter: ${INVERT} !important; }
    :popover-open { filter: ${INVERT} !important; }
  `;

  let enabled = false;    // the global on/off switch
  let nativeDark = false; // this page already has a dark theme
  let cachedDark = false; // what we remembered about this site last time
  let sawDark = false;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;

  // Re-attach our style if the page replaces <html> or wipes it (e.g. document.write).
  let watchedRoot = null;
  const observer = new MutationObserver(() => { watchRoot(); render(); });
  function watchRoot() {
    const root = document.documentElement;
    if (root && root !== watchedRoot) {
      watchedRoot = root;
      observer.observe(root, { childList: true });
    }
  }

  // False once the extension is reloaded/removed; this old copy then cleans up after itself.
  const alive = () => {
    try { return !!chrome.runtime?.id; } catch { return false; }
  };

  function render() {
    if (!alive()) { style.remove(); observer.disconnect(); return; }
    if (!enabled || nativeDark) { style.remove(); return; }
    if (!style.isConnected && document.documentElement) document.documentElement.appendChild(style);
  }

  // ---- Detecting pages that are already dark ------------------------------

  let ctx;
  function parseColor(color) { // works for any CSS colour format (rgb, oklch, lab, ...)
    ctx ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, alpha: a / 255 };
  }

  function backgroundLum(el) {
    for (; el; el = el.parentElement) {
      const { lum, alpha } = parseColor(getComputedStyle(el).backgroundColor);
      if (alpha >= 0.5) return lum;
    }
    return null;
  }

  function pageLooksDark() {
    let dark = 0, light = 0;
    for (const [x, y] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
      const lum = backgroundLum(document.elementFromPoint(innerWidth * x, innerHeight * y));
      if (lum === null) continue;
      lum < 0.4 ? dark++ : light++;
    }
    if (dark || light) return dark > light;
    // No solid background anywhere: light text means a dark page.
    const el = document.body || document.documentElement;
    return el ? parseColor(getComputedStyle(el).color).lum > 0.6 : false;
  }

  // "dark" wins as soon as it is seen once; "light" only wins on the final check,
  // so pages that render their dark theme late (SPAs) aren't flipped back and forth.
  function check(final) {
    if (!enabled || !alive()) return render();
    if (pageLooksDark()) sawDark = true;
    const dark = sawDark || (!final && nativeDark);
    if (dark !== nativeDark) { nativeDark = dark; render(); }
    if (IS_TOP && dark !== cachedDark) {
      cachedDark = dark;
      dark ? chrome.storage.local.set({ [CACHE_KEY]: true }) : chrome.storage.local.remove(CACHE_KEY);
    }
  }

  function startChecks() {
    const afterLoad = () => {
      check(false);
      setTimeout(check, 1000, false);
      setTimeout(check, 3000, true);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => check(false), { once: true });
    }
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
  }

  // ---- Start ---------------------------------------------------------------

  document.getElementById(STYLE_ID)?.remove(); // leftover from a previous version of the extension
  observer.observe(document, { childList: true });
  watchRoot();

  chrome.storage.local.get(IS_TOP ? ['enabled', CACHE_KEY] : ['enabled']).then((data) => {
    enabled = !!data.enabled;
    nativeDark = cachedDark = !!data[CACHE_KEY];
    render();
    startChecks();
  });

  // Toolbar toggle: applies instantly in every open tab, no reload needed.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('enabled' in changes)) return;
    enabled = !!changes.enabled.newValue;
    if (enabled) {
      sawDark = false;
      check(document.readyState === 'complete');
    }
    render();
  });
})();
