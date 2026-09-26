/**
 * MA COLLECTION — Custom Collection Builder
 * Client-side application logic
 */

// Application State
let database = [];
let selectedMap = {}; window.selectedMap = selectedMap;  // { folderKey: { sourceTitle: boolean } }
window.database = database;
window.selectedMap = selectedMap;
let currentCategoryIdx = 0;
let isGuideActive = false;
let isPreviewActive = false;
let currentSearch = '';
let gridSize = 210;
let activeDrawerFolder = null;

// Bump this alongside the style.css?v=NN / app.js?v=NN cache-busters in index.html
const KAPTAIN_VERSION = 'v0.92';
const KAPTAIN_UPDATED = 'v0.92 • Sep 2026';

// Newest entry first. Bump KAPTAIN_VERSION above whenever a new entry is added here —
// the title-screen "what's new" banner compares a visitor's last-seen version against this list.
const CHANGELOG = [
  {
    version: 'v23',
    items: [
      'AIO Streams setup is now a guided step-by-step flow, matching Native Mode',
      'Sending to an existing profile now lets you fully reorder every row, not just top/bottom',
      'Fixed old rows silently sticking around after you deselected them and re-sent',
      'Added bulk genre selection (e.g. select "Horror" everywhere at once) in the Quick Editor',
      'Fixed the Quick Editor "‹ Menu" button wiping your selections',
      'Kept cinematic and Quick Editor selections/order in sync when switching between them',
      'Fixed broken artwork for French, Indian, and Korean Cinema',
      'Added a no-signin "Export for Bingecat" option',
      'Dozens of smaller fixes and polish across the setup wizard',
    ],
  },
];

// Human-readable labels for TMDB sort_by API strings shown in source drawer badges
const SORT_LABEL_MAP = {
  'primary_release_date.desc': 'By Release Date ↓',
  'primary_release_date.asc': 'By Release Date ↑',
  'vote_average.desc': 'By Rating ↓',
  'vote_average.asc': 'By Rating ↑',
  'popularity.desc': 'By Popularity ↓',
  'popularity.asc': 'By Popularity ↑',
  'revenue.desc': 'By Revenue ↓',
  'revenue.asc': 'By Revenue ↑',
  'first_air_date.desc': 'By Air Date ↓',
  'first_air_date.asc': 'By Air Date ↑',
  'vote_count.desc': 'By Vote Count ↓',
  'vote_count.asc': 'By Vote Count ↑',
};
function sortLabel(raw) {
  if (!raw) return '';
  return SORT_LABEL_MAP[raw.toLowerCase()] ?? raw;
}

// Nuvio TV/Mobile emulator (Preview) state
let previewDevice = (() => { try { return localStorage.getItem('kaptain_preview_device') || 'tv'; } catch (e) { return 'tv'; } })();
// Whether the mobile-only "more options" panel (device toggle / reorder /
// editor view / layout / help) is expanded above the slim phone bottom bar.
let previewMoreOpen = false;
// Whether the mobile-only preview bar itself (Download / Send to Nuvio / ⋯,
// plus whatever the ⋯ reveals) is expanded out of its collapsed FAB.
let previewBarOpen = false;
let featuredKey = null;            // folderKey shown in the preview hero
let previewRows = [];              // array of arrays of focusable elements (focus engine)
let previewPos = { r: 0, c: 0 };   // current focus position
let activeCatIdx = 0;              // sidebar jump-nav highlight
const categorySort = {};           // { catIdx: 'custom'|'az'|'za'|'selected' } — per-row sort preset
let drawerSearch = '';             // filter text for the open drawer's source list

const CARD_PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
const CARD_MINUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

// Ordering State
let reorderMode = false;   // when true, up/down arrows appear at every level


// Keeps the persistent top-bar reorder indicator in sync with reorderMode,
// regardless of which toggle (Browse or Preview) flipped it, and across
// category switches / view re-renders.
function updateReorderBanner() {
  const banner = document.getElementById('reorder-banner');
  if (banner) banner.hidden = !reorderMode;
}

// View Mode State (per-browser; never shared with other visitors)
let selectedViewMode = localStorage.getItem('kaptain_view_mode') || 'FOLLOW_LAYOUT';
let lastExportOptimize = false;  // decided per-export by the mobile-compat gate

// Hover-GIF preference (per-browser). Affects the real exported/pushed
// collection, not just the local preview — Nuvio itself renders focusGifUrl.
let gifDisableStreaming = (() => { try { return localStorage.getItem('kaptain_gif_disable_streaming') === '1'; } catch (e) { return false; } })();
let gifDisableOther = (() => { try { return localStorage.getItem('kaptain_gif_disable_other') === '1'; } catch (e) { return false; } })();
function gifsAllowedForCategory(category) {
  const isStreaming = category && category.title === 'Streaming Services';
  return isStreaming ? !gifDisableStreaming : !gifDisableOther;
}

const KAPTAIN_THEMES = ['dark', 'light', 'high-contrast'];
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}
function applyTheme(theme) {
  const next = KAPTAIN_THEMES.includes(theme) ? theme : 'dark';
  if (next === 'dark') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('kaptain_theme', next); } catch (e) { /* ignore */ }
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.dataset.theme = next;
    btn.title = 'Theme: ' + (next === 'high-contrast' ? 'High contrast' : next.charAt(0).toUpperCase() + next.slice(1)) + ' — click to cycle';
  });
}
function cycleTheme() {
  const cur = currentTheme();
  applyTheme(KAPTAIN_THEMES[(KAPTAIN_THEMES.indexOf(cur) + 1) % KAPTAIN_THEMES.length]);
}
function bindThemeToggles() {
  const stored = (function () { try { return localStorage.getItem('kaptain_theme') || 'dark'; } catch (e) { return 'dark'; } })();
  applyTheme(stored);
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', cycleTheme);
  });
}
bindThemeToggles();

// Walkthrough State
let walkthroughActive = false;
let walkthroughStep = 0;
let preWalkthroughState = null;

// Sidebar overlay helpers (module-scope so walkthrough can open it)
function openSidebar() {
  document.querySelector('.sidebar')?.classList.add('open');
  document.getElementById('sidebar-backdrop')?.classList.add('open');
  document.getElementById('sidebar-toggle')?.setAttribute('aria-expanded', 'true');
}
function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('open');
  document.getElementById('sidebar-toggle')?.setAttribute('aria-expanded', 'false');
}

const WALKTHROUGH_STEPS = [
  {
    title: "Here's the Lay of the Land",
    body: "What you're looking at is your actual Nuvio home screen. Pick your folders and it updates live: this is the real thing.",
    target: null,
    position: 'center',
    nextLabel: 'Show Me Around'
  },
  {
    title: 'Jump to a Section',
    body: 'Each section in the list maps to a row on your home screen. Click one to jump to it. The toggle on the right grabs the whole section at once.',
    target: '#category-scroller',
    position: 'right',
    nextLabel: 'Next'
  },
  {
    title: 'Add & Remove Folders',
    body: "Every folder shows up as a card. Green border means it's in your collection. Click the + to add one, − to remove it, or open the gear for finer control.",
    target: '.nv-card',
    position: 'right',
    nextLabel: 'Next'
  },
  {
    title: 'Pick Exact Sources',
    body: "Click the gear on any card to open its source drawer, then toggle individual Trakt & TMDB lists on or off within that folder instead of all-or-nothing.",
    target: null,
    position: 'center',
    nextLabel: 'Next'
  },
  {
    title: 'TV or Phone',
    body: "Flip between how your collection will look on a TV and on a phone. Use your arrow keys to move around just like a real remote, and the focused card becomes the hero up top.",
    target: '.nv-device-toggle',
    position: 'bottom',
    nextLabel: 'Next'
  },
  {
    title: 'Layout, Sort & Reorder',
    body: "Switch how everything lays out inside Nuvio (Rows, Tabbed Grid, or Auto), and turn on Reorder to drag sections and folders into your own order. On a phone, tap the ⋯ button to find these.",
    target: '.nv-preview-secondary',
    position: 'bottom',
    nextLabel: 'Next'
  },
  {
    title: 'Send Straight to Nuvio',
    body: "When you're happy, Send to Nuvio signs you in (or creates an account) and loads your collection instantly, synced to all your devices. Prefer to keep it to yourself? Download the file and import it manually.",
    target: '#preview-send',
    position: 'bottom',
    nextLabel: 'Got It'
  }
];

// ==========================================================================
// 1. BOOTSTRAP
// ==========================================================================

// Public, no-auth hit counter (countapi.xyz died in 2024 — this is Miles
// Hilliard's drop-in fork, same no-signup/no-key model, different URL shape:
// one flat key instead of namespace+key, so the namespace is baked into the
// key name). Fire-and-forget, never blocks or throws into the UI. No PII,
// just an integer increment.
const TELEMETRY_DOM_IDS = {
  visits: ['visitor-count'],
  deployments: ['collections-generated-count'],
};

window.KaptainTelemetry = {
  async hit(key) {
    try {
      const res = await fetch(`https://countapi.mileshilliard.com/api/v1/hit/kaptain-collection_${key}`);
      const data = await res.json();
      this._render(key, data.value);
      return data.value;
    } catch (e) { return null; }
  },
  async get(key) {
    try {
      const res = await fetch(`https://countapi.mileshilliard.com/api/v1/get/kaptain-collection_${key}`);
      const data = await res.json();
      this._render(key, data.value);
      return data.value;
    } catch (e) { return null; }
  },
  _render(key, value) {
    if (typeof value !== 'number') return;
    // Still update hidden spans for any code that reads them
    const ids = TELEMETRY_DOM_IDS[key] || [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value.toLocaleString();
    });
    // Rebuild the sentence display
    this._renderSentence();
  },
  _renderSentence() {
    const sentenceEl = document.getElementById('telemetry-sentence');
    if (!sentenceEl) return;
    const visitEl = document.getElementById('visitor-count');
    const collEl = document.getElementById('collections-generated-count');
    const visits = visitEl && visitEl.textContent && visitEl.textContent !== '—' ? visitEl.textContent : null;
    const colls = collEl && collEl.textContent && collEl.textContent !== '—' ? collEl.textContent : null;
    if (!visits && !colls) {
      sentenceEl.innerHTML = 'Loading stats…';
    } else if (visits && colls) {
      sentenceEl.innerHTML = `<strong>${visits}</strong> people visited · <strong>${colls}</strong> collections built`;
    } else if (visits) {
      sentenceEl.innerHTML = `<strong>${visits}</strong> people have visited`;
    } else {
      sentenceEl.innerHTML = `<strong>${colls}</strong> collections built`;
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  bootstrapKaptain().catch((err) => {
    console.error('[Kaptain] bootstrap failed', err);
    initializeDatabase();
    bindGlobalEvents();
  });
});

async function bootstrapKaptain() {
  await maybeActivateTestChannelFromUrl();
  initializeDatabase();
  bindGlobalEvents();
  updateBetaBanner();
  window.KaptainTelemetry.hit('visits');
  window.KaptainTelemetry.get('deployments');
}

// ==========================================================================
// TEST CODE / BETA CHANNELS
// Soft gate: invite codes unlock a side-loaded catalog (database.beta.js).
// Not cryptographic — rotate codes when a beta ends.
// ==========================================================================

const TEST_CHANNEL_STORAGE_KEY = 'kaptain_test_channel';
const BETA_BANNER_HIDE_KEY = 'kaptain_beta_banner_hidden';

function getTestChannels() {
  return window.KAPTAIN_TEST_CHANNELS || {};
}

/**
 * True only while a test code is active. This is the gate for preview FEATURES,
 * the way `databaseUrl` is the gate for preview CATALOG data - a test code should
 * unlock both, and a visitor without one should get behaviour identical to what
 * shipped before the feature landed.
 *
 * Security fixes are deliberately NOT gated on this - they apply to everyone.
 */
function isPreviewFeature() {
  return !!window.KAPTAIN_TEST_CHANNEL;
}
window.KaptainPreview = isPreviewFeature;

function getFriendChannels() {
  const channels = getTestChannels();
  return Object.keys(channels)
    .map((k) => channels[k])
    .filter((ch) => ch && ch.friendPack);
}

function showFriendsOfKaptainChooser() {
  const existing = document.getElementById('friends-chooser-overlay');
  if (existing) existing.remove();

  const friends = getFriendChannels();
  const cards = friends.length
    ? friends.map((ch) => {
        const name = (ch.friendPack && ch.friendPack.creatorName) || ch.label || ch.id;
        const blurb = ch.blurb || '';
        return `
    </div>
    <div class="nv-preview-actions">
      
        <button class="se-mini-btn ${seStreamingSort === 'az' ? 'is-active' : ''}" data-streamsort="az">A–Z</button>` : '';
    html += `<div class="se-cat" data-ci="${ci}">
      <div class="se-cat-head">
        <span class="se-cat-name">${escapeHtml((cat.emoji ? cat.emoji + ' ' : '') + (cat.title || ''))}</span>
        <span class="se-cat-count" id="se-catcount-${ci}">${stats.selectedFolders}/${stats.totalFolders}</span>
        ${sortBtns}
        <button class="se-mini-btn" data-catall="${ci}">All</button>
        <button class="se-mini-btn" data-catnone="${ci}">None</button>
      </div>
      <div class="se-folders">${folders.map(f => seFolderRowHtml(f, ci)).join('')}</div>
    </div>`;
  });
  host.innerHTML = html || '<div class="se-empty">No folders match your search.</div>';
}

function seFolderRowHtml(folder, ci) {
  const key = getFolderKey(folder);
  const st = getFolderSourceCountStats(folder);
  const on = st.active > 0;
  const expanded = seExpanded.has(key);
  return `<div class="se-folder ${on ? 'on' : ''}" data-fkey="${escapeHtml(key)}" data-ci="${ci}">
    <div class="se-folder-row">
      <label class="se-folder-main">
        <input type="checkbox" class="se-folder-check" ${on ? 'checked' : ''}>
        <span class="se-folder-title">${escapeHtml(folder.title || 'Untitled')}</span>
      </label>
      <span class="se-folder-count">${st.active}/${st.total}</span>
      <button class="se-folder-expand" title="Edit sources">${expanded ? '▾' : '▸'}</button>
    </div>
    <div class="se-sources" ${expanded ? '' : 'hidden'}>${expanded ? seSourcesHtml(folder) : ''}</div>
  </div>`;
}

function seSourcesHtml(folder) {
  const fkey = getFolderKey(folder);
  return (folder.sources || []).map(src => {
    const skey = getSourceKey(src);
    const on = selectedMap[fkey] && selectedMap[fkey][skey];
    return `<label class="se-source">
      <input type="checkbox" class="se-source-check" data-skey="${escapeHtml(skey)}" ${on ? 'checked' : ''}>
      <span class="se-source-title">${escapeHtml(getSourceName(src))}</span>
      <span class="se-source-meta">${escapeHtml(src.provider === 'addon' ? getProviderLabel(src) : [src.provider, src.mediaType].filter(Boolean).join(' · '))}</span>
    </label>`;
  }).join('');
}

function seUpdateFolderRow(row, folder, ci) {
  const st = getFolderSourceCountStats(folder);
  row.classList.toggle('on', st.active > 0);
  const cnt = row.querySelector('.se-folder-count');
  if (cnt) cnt.textContent = `${st.active}/${st.total}`;
  const chk = row.querySelector('.se-folder-check');
  if (chk) chk.checked = st.active > 0;
  const el = document.getElementById('se-catcount-' + ci);
  if (el) { const s = getCategorySelectionStats(ci); el.textContent = `${s.selectedFolders}/${s.totalFolders}`; }
}

function seToggleSources(row) {
  const fkey = row.dataset.fkey;
  const folder = seFindFolder(fkey, +row.dataset.ci);
  const box = row.querySelector('.se-sources');
  const exp = row.querySelector('.se-folder-expand');
  if (seExpanded.has(fkey)) {
    seExpanded.delete(fkey); box.hidden = true; box.innerHTML = ''; exp.textContent = '▸';
  } else {
    seExpanded.add(fkey); box.innerHTML = seSourcesHtml(folder); box.hidden = false; exp.textContent = '▾';
  }
}

// ----- settings panel -----
function seEnsureAddons() {
  if (!seAddons) {
    const src = (window.NuvioWizard && window.NuvioWizard.SUGGESTED_ADDONS) || [];
    seAddons = src.map(a => ({ name: a.name, url: a.url, note: a.note || '', checked: !!a.recommended }));
  }
  return seAddons;
}
function seGatherSettings() {
  const g = id => document.getElementById(id);
  if (g('se-profile-name')) seSettings.profileName = g('se-profile-name').value.trim();
  if (g('se-avatar-url')) seSettings.avatarUrl = g('se-avatar-url').value.trim();
  if (g('se-torbox-key')) seSettings.torboxKey = g('se-torbox-key').value.trim();
  if (g('se-tmdb-key')) seSettings.tmdbKey = g('se-tmdb-key').value.trim();
  if (g('se-mdblist-key')) seSettings.mdblistKey = g('se-mdblist-key').value.trim();
  notifyAccountSave();
}
function seAddonRowHtml(a, i) {
  return `<label class="se-addon">
    <input type="checkbox" class="se-addon-check" data-i="${i}" ${a.checked ? 'checked' : ''}>
    <span class="se-addon-name">${escapeHtml(a.name)}</span>
    <button class="se-addon-rm" data-rm="${i}" title="Remove">&times;</button>
  </label>`;
}
function renderSimpleSettings() {
  const host = document.getElementById('se-settings');
  if (!host) return;
  const addons = seEnsureAddons();
  const v = s => escapeHtml(s || '').replace(/"/g, '&quot;');
  // Same definitions the wizard uses, so a term never means two things.
  const tip = (key, label) => (window.NuvioWizard && window.NuvioWizard.glossaryTip)
    ? window.NuvioWizard.glossaryTip(key, label)
    : escapeHtml(label);
  const adv = html => (seAdvanced ? html : '');
  host.innerHTML = `
    <p class="se-settings-intro">The full settings panel: edit folders, sources, and API keys directly. No wizard steps.</p>
    <div class="se-mode-toggle" role="group" aria-label="Settings detail level">
      <button type="button" class="se-mode-btn ${seAdvanced ? '' : 'active'}" id="se-mode-basic" aria-pressed="${!seAdvanced}">Basic</button>
      <button type="button" class="se-mode-btn ${seAdvanced ? 'active' : ''}" id="se-mode-advanced" aria-pressed="${seAdvanced}">Advanced</button>
    </div>
    <h3 class="se-sec-title">Profile</h3>
    <label class="se-field">Profile name
      <input id="se-profile-name" class="se-input" value="${v(seSettings.profileName)}" placeholder="MA COLLECTION">
    </label>
    <label class="se-field">Profile image URL <span class="se-hint">(public link)</span>
      <input id="se-avatar-url" class="se-input" value="${v(seSettings.avatarUrl)}" placeholder="https://…/image.jpg">
    </label>
    <div class="se-avatar-wrap"><img id="se-avatar-preview" class="se-avatar-preview" alt=""></div>

    <h3 class="se-sec-title">Scrapers <span class="se-sec-sub">— where streams come from</span></h3>
    <p class="se-note" style="margin-bottom:10px;">${tip('scraper', 'Scrapers')} find playable links for whatever you open. Torrentio alone is plenty to start with.</p>
    <div class="se-field">
      <div id="se-addon-list" class="se-addon-list">${addons.map((a, i) => seAddonRowHtml(a, i)).join('')}</div>
    </div>
    ${adv(`
    <div class="se-field se-advanced-block">
      <span class="se-field-label">Add your own ${tip('addon', 'addon')}</span>
      <p class="se-note" style="margin:2px 0 8px;">Paste the ${tip('manifest', 'manifest URL')} the addon's own site gives you — it ends in <code>manifest.json</code>.</p>
      <div class="se-addon-add">
        <input id="se-addon-name" class="se-input" placeholder="Name (e.g. Torrentio)">
        <input id="se-addon-url" class="se-input" placeholder="https://…/manifest.json">
        <button id="se-addon-add-btn" class="se-mini-btn">Add</button>
      </div>
    </div>`)}

    <h3 class="se-sec-title">Recommendations <span class="se-sec-sub">— what fills "For You"</span></h3>
    <p class="se-note">${tip('trakt', 'Trakt')} is connected inside the Nuvio app itself (it needs a sign-in there, not here).</p>
    ${seAdvanced ? '' : '<p class="se-note">API keys for Torbox, TMDB and MDBList live under <strong>Advanced</strong> at the top.</p>'}
    ${adv(`
    <label class="se-field se-advanced-block">${tip('mdblist', 'MDBList')} API key <span class="se-hint">(optional)</span>
      <span class="se-input-wrap">
        <input id="se-mdblist-key" class="se-input" value="${v(seSettings.mdblistKey)}" placeholder="MDBList key" autocomplete="off">
        <button type="button" class="se-key-test" id="se-mdblist-test">Test</button>
      </span>
    </label>`)}

    ${adv(`
    <h3 class="se-sec-title">Playback &amp; artwork</h3>
    <label class="se-field se-advanced-block">${tip('torbox', 'Torbox')} API key
      <span class="se-input-wrap">
        <input id="se-torbox-key" class="se-input" value="${v(seSettings.torboxKey)}" placeholder="xxxxxxxx-xxxx-…" autocomplete="off" spellcheck="false">
        <button type="button" class="se-key-test" id="se-torbox-test">Test</button>
      </span>
    </label>
    <div class="se-key-status" id="se-torbox-status"></div>
    <label class="se-field se-advanced-block">${tip('tmdb', 'TMDB')} API key <span class="se-hint">(optional)</span>
      <span class="se-input-wrap">
        <input id="se-tmdb-key" class="se-input" value="${v(seSettings.tmdbKey)}" placeholder="TMDB v4 key" autocomplete="off">
        <button type="button" class="se-key-test" id="se-tmdb-test">Test</button>
      </span>
    </label>`)}

    <h3 class="se-sec-title">Genres</h3>
    <p class="se-note" style="margin-bottom:8px;">Toggle a genre on/off everywhere it appears — Streaming Services, Genres, Networks, all at once.</p>
    <div class="se-genre-list">${getAllGenres().map(g => {
      const st = getGenreSelectionState(g);
      return `<label class="se-genre-row">
        <input type="checkbox" class="se-genre-check" data-genre="${v(g)}" ${st ? 'checked' : ''} ${st === null ? 'data-indeterminate="1"' : ''}>
        <span>${v(g)}</span>
      </label>`;
    }).join('')}</div>

    <h3 class="se-sec-title">Hover Effects</h3>
    <p class="se-note" style="margin-bottom:8px;">Turn off the animated hover/focus effect on folder cards, in Nuvio itself as well as here.</p>
    <div class="se-genre-list">
      <label class="se-genre-row">
        <input type="checkbox" id="se-gif-disable-streaming" ${gifDisableStreaming ? 'checked' : ''}>
        <span>Disable on Streaming Services</span>
      </label>
      <label class="se-genre-row">
        <input type="checkbox" id="se-gif-disable-other" ${gifDisableOther ? 'checked' : ''}>
        <span>Disable everywhere else</span>
      </label>
    </div>

    <h3 class="se-sec-title">Film Collections Duplicates</h3>
    <p class="se-note" style="margin-bottom:8px;">Some franchises appear both inside a genre folder (e.g. "War Collections") and as their own standalone folder. Pick a side to hide the duplicates in one click — this only changes your current selection, nothing is deleted.</p>
    <div class="se-dedup-actions">
      <button type="button" id="se-dedup-hide-buckets" class="se-mini-btn">Hide genre-bucket copies</button>
      <button type="button" id="se-dedup-hide-standalone" class="se-mini-btn">Hide standalone copies</button>
    </div>`;
  wireSimpleSettings();
  document.querySelectorAll('.se-genre-check[data-indeterminate]').forEach(cb => { cb.indeterminate = true; });
}
// Live "does this key actually work" check, matching the wizard's own Test
// buttons so a key can't be silently accepted here and rejected there.
function wireSeKeyTest(buttonId, fieldId, testFnName) {
  const btn = document.getElementById(buttonId);
  const field = document.getElementById(fieldId);
  const testFn = window.NuvioWizard && window.NuvioWizard[testFnName];
  if (!btn || !field || !testFn) return;
  btn.addEventListener('click', async () => {
    const key = field.value.trim();
    if (!key) { showToast('Enter a key first.', 'error'); return; }
    const original = btn.textContent;
    btn.textContent = '…';
    btn.disabled = true;
    const result = await testFn(key);
    btn.disabled = false;
    btn.textContent = original;
    if (result.unreachable) showToast('Could not reach the server to check that key. Try again in a moment.', 'error');
    else if (result.ok) showToast('✓ That key works.', 'success');
    else showToast('That key was rejected. Double-check it.', 'error');
  });
}

function wireSimpleSettings() {
  ['se-mode-basic', 'se-mode-advanced'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const wantAdvanced = id === 'se-mode-advanced';
      if (wantAdvanced === seAdvanced) return;
      seGatherSettings();   // don't lose anything typed before the switch
      seAdvanced = wantAdvanced;
      renderSimpleSettings();
    });
  });
  wireSeKeyTest('se-torbox-test', 'se-torbox-key', 'testTorboxKeyLive');
  wireSeKeyTest('se-tmdb-test', 'se-tmdb-key', 'testTmdbKeyLive');
  wireSeKeyTest('se-mdblist-test', 'se-mdblist-key', 'testMdblistKeyLive');
  const tk = document.getElementById('se-torbox-key');
  const stat = document.getElementById('se-torbox-status');
  if (tk && stat) {
    const upd = () => { stat.innerHTML = (window.NuvioWizard && window.NuvioWizard.torboxStatusHtml) ? window.NuvioWizard.torboxStatusHtml(tk.value) : ''; };
    tk.addEventListener('input', upd); upd();
  }
  const av = document.getElementById('se-avatar-url');
  const img = document.getElementById('se-avatar-preview');
  if (av && img) {
    const upd = () => { const u = av.value.trim(); if (u) { img.src = u; img.style.display = 'block'; } else { img.style.display = 'none'; } };
    av.addEventListener('input', upd); upd();
  }
  const list = document.getElementById('se-addon-list');
  if (list) {
    list.addEventListener('change', e => {
      if (e.target.classList.contains('se-addon-check')) { const i = +e.target.dataset.i; if (seAddons[i]) seAddons[i].checked = e.target.checked; }
    });
    list.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { seGatherSettings(); seAddons.splice(+rm.dataset.rm, 1); renderSimpleSettings(); }
    });
  }
  const addBtn = document.getElementById('se-addon-add-btn');
  if (addBtn) addBtn.addEventListener('click', () => {
    const n = document.getElementById('se-addon-name');
    const u = document.getElementById('se-addon-url');
    const url = (u && u.value || '').trim();
    if (!url) { showToast('Enter the addon’s manifest link to add it.', 'error'); return; }
    seGatherSettings();
    seEnsureAddons().push({ name: (n && n.value || '').trim() || url, url, note: '', checked: true });
    renderSimpleSettings();
  });
  document.querySelectorAll('.se-genre-check').forEach(cb => {
    cb.addEventListener('change', () => {
      applyGenreToggle(cb.dataset.genre, cb.checked);
      renderSimpleSettings();
      renderSimpleCollection();
    });
  });
  const gifStreamingCb = document.getElementById('se-gif-disable-streaming');
  if (gifStreamingCb) gifStreamingCb.addEventListener('change', () => {
    gifDisableStreaming = gifStreamingCb.checked;
    try { localStorage.setItem('kaptain_gif_disable_streaming', gifDisableStreaming ? '1' : '0'); } catch (e) {}
    renderFolderGrid();
    renderSimpleCollection();
  });
  const gifOtherCb = document.getElementById('se-gif-disable-other');
  if (gifOtherCb) gifOtherCb.addEventListener('change', () => {
    gifDisableOther = gifOtherCb.checked;
    try { localStorage.setItem('kaptain_gif_disable_other', gifDisableOther ? '1' : '0'); } catch (e) {}
    renderFolderGrid();
    renderSimpleCollection();
  });
  const dedupBuckets = document.getElementById('se-dedup-hide-buckets');
  if (dedupBuckets) dedupBuckets.addEventListener('click', () => {
    const { bucketDuplicates } = getFilmCollectionDuplicates();
    hideFilmCollectionBucketDuplicates();
    renderSimpleCollection();
    showToast(`Hid ${bucketDuplicates.length} genre-bucket ${bucketDuplicates.length === 1 ? 'copy' : 'copies'}.`, 'success');
  });
  const dedupStandalone = document.getElementById('se-dedup-hide-standalone');
  if (dedupStandalone) dedupStandalone.addEventListener('click', () => {
    const { standaloneDuplicates } = getFilmCollectionDuplicates();
    hideFilmCollectionStandaloneDuplicates();
    renderSimpleCollection();
    showToast(`Hid ${standaloneDuplicates.length} standalone ${standaloneDuplicates.length === 1 ? 'copy' : 'copies'}.`, 'success');
  });
}

function seSend() {
  seGatherSettings();
  let compiled = [];
  try { compiled = assembleFilteredDatabase(); } catch (e) { /* ignore */ }
  if (!compiled.length) { showToast('Pick at least one folder before sending.', 'error'); return; }

  // Close the Quick Editor before opening wizard/compat overlays — they sit
  // at lower z-indexes (200/250) than the Quick Editor overlay (900) and would
  // otherwise appear hidden behind it.
  document.getElementById('simple-editor-overlay')?.classList.remove('open');
  hideTitleScreen();
  isPreviewActive = true;
  renderPreviewCollection();

  const prefill = {
    profileName: seSettings.profileName || undefined,
    avatarUrl: seSettings.avatarUrl || undefined,
    torboxKey: seSettings.torboxKey || undefined,
    tmdbKey: seSettings.tmdbKey || undefined,
    tmdbEnabled: !!seSettings.tmdbKey,
    mdblistKey: seSettings.mdblistKey || undefined,
    addons: seEnsureAddons(),
  };
  const launch = () => { if (window.NuvioWizard) window.NuvioWizard.open({ skipChoose: true, prefill }); };
  if (window.KaptainExport && typeof window.KaptainExport.ensureMobileCompat === 'function') {
    window.KaptainExport.ensureMobileCompat(launch);
  } else { launch(); }
}

function bindSimpleEditorEvents() {
  // Guided Customize card → startCustomize (was wrongly wired to Quick Editor)
  document.getElementById('title-screen-simple')?.addEventListener('click', () => {
    if (window.startCustomize) window.startCustomize();
  });
  document.getElementById('btn-shortcuts-hint')?.addEventListener('click', () => toggleShortcutPanel(true));
  document.getElementById('se-back')?.addEventListener('click', backToCinematicEditor);
  document.getElementById('se-cinematic')?.addEventListener('click', backToCinematicEditor);
  document.getElementById('se-send')?.addEventListener('click', seSend);
  document.getElementById('se-bingecat')?.addEventListener('click', () => {
    seGatherSettings();   // keep anything typed in the settings panel
    exportForBingecat();
  });
  document.getElementById('se-selfhost')?.addEventListener('click', () => {
    seGatherSettings();
    exportForSelfHost();
  });
  document.getElementById('se-search')?.addEventListener('input', renderSimpleCollection);
  document.getElementById('se-all')?.addEventListener('click', () => { database.forEach((_, ci) => seSetCategory(ci, true)); renderSimpleCollection(); updateControlCenterStats(); renderSidebar(); });
  document.getElementById('se-none')?.addEventListener('click', () => { database.forEach((_, ci) => seSetCategory(ci, false)); renderSimpleCollection(); updateControlCenterStats(); renderSidebar(); });

  const host = document.getElementById('se-collection');
  if (host) {
    host.addEventListener('change', e => {
      const row = e.target.closest('.se-folder');
      if (!row) return;
      const ci = +row.dataset.ci;
      const folder = seFindFolder(row.dataset.fkey, ci);
      if (!folder) return;
      if (e.target.classList.contains('se-folder-check')) {
        seSetFolder(folder, e.target.checked);
        // refresh source checkboxes if expanded
        if (seExpanded.has(row.dataset.fkey)) row.querySelector('.se-sources').innerHTML = seSourcesHtml(folder);
        seUpdateFolderRow(row, folder, ci);
        updateControlCenterStats();
        renderSidebar();
      } else if (e.target.classList.contains('se-source-check')) {
        const fkey = getFolderKey(folder);
        if (!selectedMap[fkey]) selectedMap[fkey] = {};
        selectedMap[fkey][e.target.dataset.skey] = e.target.checked;
        seUpdateFolderRow(row, folder, ci);
        updateControlCenterStats();
        renderSidebar();
        notifyAccountSave();
      }
    });
    host.addEventListener('click', e => {
      const exp = e.target.closest('.se-folder-expand');
      if (exp) { seToggleSources(exp.closest('.se-folder')); return; }
      const streamSort = e.target.closest('[data-streamsort]');
      if (streamSort) {
        seStreamingSort = streamSort.dataset.streamsort;
        renderSimpleCollection();
        return;
      }
      const all = e.target.closest('[data-catall]');
      if (all) { seSetCategory(+all.dataset.catall, true); renderSimpleCollection(); updateControlCenterStats(); renderSidebar(); return; }
      const none = e.target.closest('[data-catnone]');
      if (none) { seSetCategory(+none.dataset.catnone, false); renderSimpleCollection(); updateControlCenterStats(); renderSidebar(); return; }
    });
  }
}

// ==========================================================================
// 11. GUIDED WALKTHROUGH ENGINE
// ==========================================================================

function startWalkthrough() {
  // Capture view state before starting the walkthrough
  preWalkthroughState = {
    currentCategoryIdx: currentCategoryIdx,
    isPreviewActive: isPreviewActive,
    isGuideActive: isGuideActive
  };
  walkthroughActive = true;
  walkthroughStep = 0;
  showWalkthroughStep(0);
}

function showWalkthroughStep(index) {
  const step = WALKTHROUGH_STEPS[index];
  if (!step) return;

  walkthroughStep = index;

  // Walkthrough UX integration: automatically switch to the Preview view on the preview step
  if (step.view === 'preview') {
    isPreviewActive = true;
    isGuideActive = false;
    switchCategory(-2);
  } else {
    // If we are on other steps but the preview view was temporarily activated, restore the previous state
    if (isPreviewActive && preWalkthroughState && !preWalkthroughState.isPreviewActive) {
      isPreviewActive = preWalkthroughState.isPreviewActive;
      isGuideActive = preWalkthroughState.isGuideActive;
      currentCategoryIdx = preWalkthroughState.currentCategoryIdx;
      switchCategory(currentCategoryIdx);
    }
  }

  const overlay = document.getElementById('walkthrough-overlay');
  const spotlight = document.getElementById('walkthrough-spotlight');
  const tooltip = document.getElementById('walkthrough-tooltip');
  const titleEl = document.getElementById('wt-title');
  const bodyEl = document.getElementById('wt-body');
  const dotsEl = document.getElementById('wt-dots');
  const labelEl = document.getElementById('wt-step-label');
  const miniCounter = document.getElementById('wt-mini-counter');
  const btnNext = document.getElementById('wt-btn-next');
  const btnPrev = document.getElementById('wt-btn-prev');
  const btnSkip = document.getElementById('wt-btn-skip');

  // Show overlay
  overlay.classList.add('active');

  // Fade out tooltip while repositioning
  tooltip.classList.remove('visible');

  // Resolve the target now (sidebar contents are always in the DOM, just
  // translated off-screen when closed) so we can open/close the sidebar
  // immediately and give its slide transition time to finish before any
  // position is measured below.
  const targetEl = step.target ? document.querySelector(step.target) : null;
  const needsSidebar = !!(targetEl && targetEl.closest('.sidebar'));
  if (needsSidebar) openSidebar(); else closeSidebar();

  // On phones, the entire preview bar (⋯ / Download / Send to Nuvio, plus
  // whatever ⋯ reveals) lives behind a FAB — expand it before checking the
  // nested "more" panel below. No-op on desktop (always visible there).
  const needsPreviewBar = !!(targetEl && targetEl.closest('.nv-preview-content'));
  if (needsPreviewBar) openPreviewBar(); else closePreviewBar();

  // On phones, the device toggle / reorder / layout / help controls live
  // inside the collapsed "more" panel — expand it before measuring so the
  // spotlight lands on a visible target. No-op on desktop (panel is always
  // visible there regardless of the .open class).
  const needsPreviewSecondary = !!(targetEl && targetEl.closest('#nv-preview-secondary'));
  if (needsPreviewSecondary) openPreviewSecondary(); else closePreviewSecondary();

  // The sidebar's slide transition is --transition-normal (300ms); give it
  // room to finish so we never measure a target mid-animation.
  const delay = needsSidebar ? 360 : 130;

  setTimeout(() => {
    // Update content
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    btnNext.textContent = step.nextLabel || 'Next';

    // Mini counter (replaces old "Step X of N" label)
    if (miniCounter) {
      miniCounter.textContent = index === 0 ? '' : `${index} · ${WALKTHROUGH_STEPS.length - 1}`;
    }
    if (labelEl) labelEl.textContent = '';

    // Dots
    dotsEl.innerHTML = WALKTHROUGH_STEPS.map((_, i) =>
      `<span class="wt-dot ${i === index ? 'active' : i < index ? 'done' : ''}"></span>`
    ).join('');

    // Show/hide prev
    btnPrev.style.display = index > 0 ? 'inline-flex' : 'none';

    // Show/hide skip (not on last step)
    btnSkip.style.display = index < WALKTHROUGH_STEPS.length - 1 ? 'inline-flex' : 'none';

    if (!step.target || !targetEl) {
      // Centered modal, no spotlight. Compute the centered position in JS
      // (rather than a CSS `transform: translate(-50%,-50%)`) so it never
      // fights the entrance fade's own transform when switching steps.
      spotlight.classList.add('hidden');
      tooltip.classList.add('wt-centered');
      tooltip.style.top = '';
      tooltip.style.left = '';
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      tooltip.style.top = Math.max(20, (window.innerHeight - th) / 2) + 'px';
      tooltip.style.left = Math.max(20, (window.innerWidth - tw) / 2) + 'px';
    } else {
      tooltip.classList.remove('wt-centered');

      // Scroll target element into view so it is completely visible and not clipped by overflow containers
      targetEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });

      spotlight.classList.remove('hidden');
      const rect = targetEl.getBoundingClientRect();
      const pad = 14;

      spotlight.style.top = (rect.top - pad) + 'px';
      spotlight.style.left = (rect.left - pad) + 'px';
      spotlight.style.width = (rect.width + pad * 2) + 'px';
      spotlight.style.height = Math.min(rect.height + pad * 2, window.innerHeight * 0.7) + 'px';

      // Position tooltip so it never overlaps the spotlighted box
      positionWalkthroughTooltip(rect, step.position, pad);
    }

    // Fade tooltip in
    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
  }, delay);
}

function positionWalkthroughTooltip(targetRect, position, pad) {
  const tooltip = document.getElementById('walkthrough-tooltip');
  const gap = 24;
  const margin = 20;

  // Reset before measuring so the tooltip's own (responsive) size is current
  tooltip.style.top = '';
  tooltip.style.left = '';

  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // The spotlight is padded outward from the raw target rect; that's the
  // box the tooltip must stay clear of.
  const box = {
    top: targetRect.top - pad,
    bottom: targetRect.bottom + pad,
    left: targetRect.left - pad,
    right: targetRect.right + pad
  };

  const spaceRight = vw - box.right;
  const spaceLeft = box.left;
  const spaceBelow = vh - box.bottom;
  const spaceAbove = box.top;

  // Flip to the opposite side when the requested side doesn't have room
  let side = position;
  if (side === 'right' && spaceRight < tw + gap && spaceLeft >= tw + gap) side = 'left';
  if (side === 'left' && spaceLeft < tw + gap && spaceRight >= tw + gap) side = 'right';
  if (side === 'bottom' && spaceBelow < th + gap && spaceAbove >= th + gap) side = 'top';
  if (side === 'top' && spaceAbove < th + gap && spaceBelow >= th + gap) side = 'bottom';

  let top, left;
  switch (side) {
    case 'right':
      left = box.right + gap;
      top = targetRect.top;
      break;
    case 'left':
      left = box.left - gap - tw;
      top = targetRect.top;
      break;
    case 'top':
      top = box.top - gap - th;
      left = targetRect.left;
      break;
    case 'bottom':
    default:
      top = box.bottom + gap;
      left = targetRect.left;
      break;
  }

  // Clamp to the viewport
  left = Math.max(margin, Math.min(left, vw - tw - margin));
  top = Math.max(margin, Math.min(top, vh - th - margin));

  // If clamping pulled the tooltip back over the spotlighted box, nudge it
  // clear on whichever axis still has room rather than let it overlap.
  const overlaps = left < box.right && left + tw > box.left && top < box.bottom && top + th > box.top;
  if (overlaps) {
    if (side === 'left' || side === 'right') {
      top = (box.bottom + gap + th <= vh - margin) ? box.bottom + gap : Math.max(margin, box.top - gap - th);
    } else {
      left = (box.right + gap + tw <= vw - margin) ? box.right + gap : Math.max(margin, box.left - gap - tw);
    }
  }

  tooltip.style.top = top + 'px';
  tooltip.style.left = left + 'px';
}

function walkthroughNext() {
  if (walkthroughStep < WALKTHROUGH_STEPS.length - 1) {
    showWalkthroughStep(walkthroughStep + 1);
  } else {
    endWalkthrough();
  }
}

function walkthroughPrev() {
  if (walkthroughStep > 0) {
    showWalkthroughStep(walkthroughStep - 1);
  }
}

function endWalkthrough() {
  walkthroughActive = false;
  closeSidebar();
  closePreviewSecondary();
  closePreviewBar();

  const overlay = document.getElementById('walkthrough-overlay');
  const tooltip = document.getElementById('walkthrough-tooltip');
  const spotlight = document.getElementById('walkthrough-spotlight');

  if (tooltip) tooltip.classList.remove('visible');

  setTimeout(() => {
    if (overlay) overlay.classList.remove('active');
    if (spotlight) spotlight.classList.add('hidden');
    if (tooltip) tooltip.classList.remove('wt-centered');
  }, 500);

  // Restore pre-walkthrough view if we were in the preview step
  if (preWalkthroughState) {
    isPreviewActive = preWalkthroughState.isPreviewActive;
    isGuideActive = preWalkthroughState.isGuideActive;
    currentCategoryIdx = preWalkthroughState.currentCategoryIdx;
    switchCategory(currentCategoryIdx);
    preWalkthroughState = null;

    // Smoothly reset sidebar scroll position to top
    const scroller = document.getElementById('category-scroller');
    if (scroller) {
      scroller.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }

  // Mark as completed
  localStorage.setItem('kaptain_tour_done', '1');

  showToast("Pick your folders and customize away.", "success");

  // One-time navigation hint (shown only after the very first tour completion)
  if (!localStorage.getItem('kaptain_nav_hint_shown')) {
    localStorage.setItem('kaptain_nav_hint_shown', '1');
    setTimeout(() => showToast('Tip: use arrow keys or swipe to navigate sections.', 'success'), 3500);
  }
}

function showUndoToast(folder) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-undo';

  const name = folder.title || 'Folder';
  toast.innerHTML = `
    <div class="toast-message">Removed <strong>${name}</strong></div>
    <button class="toast-undo-btn">Undo</button>
    <button class="toast-close">&times;</button>
  `;

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  };

  toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
    toggleWholeFolderSelection(folder, true);
    dismiss();
  });
  toast.querySelector('.toast-close').addEventListener('click', dismiss);

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(dismiss, 5000);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success'
    ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-message">${message}</div>
    <button class="toast-close">&times;</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  });

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }
  }, 4500);
}

// ==========================================================================
// FEATURE B: SYNC STATE INDICATOR
// ==========================================================================

function getSelectedFolderIds() {
  return Object.keys(selectedMap).filter(key => {
    const sources = selectedMap[key];
    return sources && Object.values(sources).some(Boolean);
  });
}

function checkSyncState() {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;
  const raw = localStorage.getItem('kaptain_last_push');
  if (!raw) { dot.className = 'sync-dot'; dot.title = ''; return; }
  try {
    const saved = JSON.parse(raw);
    const savedIds = (saved.folderIds || []).slice().sort().join('\n');
    const currentIds = getSelectedFolderIds().slice().sort().join('\n');
    if (savedIds === currentIds) {
      dot.className = 'sync-dot synced';
      const mins = Math.round((Date.now() - saved.timestamp) / 60000);
      const timeStr = mins < 2 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
      dot.title = `Nuvio is up to date · Pushed ${timeStr}`;
    } else {
      dot.className = 'sync-dot out-of-sync';
      const current = new Set(getSelectedFolderIds());
      const prev = new Set(saved.folderIds || []);
      const added = [...current].filter(id => !prev.has(id)).length;
      const removed = [...prev].filter(id => !current.has(id)).length;
      const parts = [];
      if (added) parts.push(`+${added} folder${added !== 1 ? 's' : ''}`);
      if (removed) parts.push(`-${removed} folder${removed !== 1 ? 's' : ''}`);
      dot.title = (parts.length ? parts.join(', ') + ' since last push.' : 'Selection changed.') + ' Click to update.';
    }
  } catch (e) {
    dot.className = 'sync-dot'; dot.title = '';
  }
}

function handleSendToNuvioClick() {
  const dot = document.getElementById('sync-dot');
  if (dot && dot.classList.contains('out-of-sync')) {
    openQuickPushModal();
  } else {
    if (window.NuvioWizard && typeof window.NuvioWizard.open === 'function') {
      window.NuvioWizard.open();
    }
  }
}

function openQuickPushModal() {
  const overlay = document.getElementById('quick-push-overlay');
  const desc = document.getElementById('quick-push-desc');
  if (!overlay) return;

  const raw = localStorage.getItem('kaptain_last_push');
  if (desc && raw) {
    try {
      const saved = JSON.parse(raw);
      const current = new Set(getSelectedFolderIds());
      const prev = new Set(saved.folderIds || []);
      const added = [...current].filter(id => !prev.has(id)).length;
      const removed = [...prev].filter(id => !current.has(id)).length;
      const parts = [];
      if (added) parts.push(`${added} folder${added !== 1 ? 's' : ''} added`);
      if (removed) parts.push(`${removed} folder${removed !== 1 ? 's' : ''} removed`);
      desc.textContent = parts.length ? parts.join(', ') + ' since your last push.' : 'Your selection has changed since the last push.';
    } catch (e) { desc.textContent = 'Your selection has changed since the last push.'; }
  }

  overlay.hidden = false;
}

function closeQuickPushModal() {
  const overlay = document.getElementById('quick-push-overlay');
  if (overlay) overlay.hidden = true;
}

function mergeCategoryUnionForQuickPush(existingCat, incomingCat) {
  const sourceUnionKey = (s) => {
    if (!s) return '';
    if (s.provider === 'addon') return `addon|${s.addonId || ''}|${s.catalogId || ''}|${s.type || ''}`;
    if (s.provider === 'tmdb') {
      const g = (s.filters && s.filters.withGenres) || s.genre || '';
      const tmdbId = s.tmdbId || s.tmdbSourceId || '';
      const media = s.mediaType || s.type || '';
      return `tmdb|${tmdbId}|${s.tmdbSourceType || ''}|${g}|${s.title || s.name || ''}|${media}`;
    }
    if (s.provider === 'trakt') return `trakt|${s.traktListId || ''}|${s.title || s.name || ''}|${s.mediaType || s.type || ''}`;
    return `${s.provider || ''}|${s.catalogId || s.title || s.name || ''}|${s.type || s.mediaType || ''}`;
  };

  const merged = { ...existingCat };
  const folderList = (existingCat.folders || []).filter(Boolean).map((f) => ({ ...f }));
  const byFolderId = new Map(folderList.map((f) => [f.id, f]));
  const norm = (t) => (t || '').trim().toLowerCase();
  const byFolderTitle = new Map(folderList.map((f) => [norm(f.title), f]));

  (incomingCat.folders || []).forEach((incFolder) => {
    if (!incFolder || (!incFolder.id && !incFolder.title)) return;
    const titleKey = norm(incFolder.title);
    const existingFolder = (incFolder.id && byFolderId.get(incFolder.id)) || (titleKey && byFolderTitle.get(titleKey));
    if (!existingFolder) {
      folderList.push(incFolder);
      if (incFolder.id) byFolderId.set(incFolder.id, incFolder);
      if (titleKey) byFolderTitle.set(titleKey, incFolder);
      return;
    }
    const existingKeys = new Set((existingFolder.sources || []).map(sourceUnionKey));
    const missingSources = (incFolder.sources || []).filter((s) => !existingKeys.has(sourceUnionKey(s)));
    if (missingSources.length) {
      existingFolder.sources = [...(existingFolder.sources || []), ...missingSources];
      const existingCatKeys = new Set((existingFolder.catalogSources || []).map(sourceUnionKey));
      const missingCatSources = (incFolder.catalogSources || []).filter((s) => !existingCatKeys.has(sourceUnionKey(s)));
      existingFolder.catalogSources = [...(existingFolder.catalogSources || []), ...missingCatSources];
    }
  });
  merged.folders = folderList;
  return merged;
}

function mergeCollectionsSafe(existingList, incomingList) {
  const existing = Array.isArray(existingList) ? existingList : [];
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  if (!existing.length) return incoming.map((c) => ({ ...c }));

  const norm = (t) => (t || '').trim().toLowerCase();
  const incomingIds = new Set(incoming.map((c) => c && c.id).filter(Boolean));
  const incomingTitles = new Set(incoming.map((c) => c && norm(c.title)).filter(Boolean));

  const allKnownDb = (typeof database !== 'undefined' && Array.isArray(database)) ? database : [];
  const allKnownIds = new Set(allKnownDb.map((c) => c && c.id).filter(Boolean));
  const allKnownTitles = new Set(allKnownDb.map((c) => c && norm(c.title)).filter(Boolean));

  const result = [];
  const handledExisting = new Set();
  const handledIncoming = new Set();

  // Step 1: Walk existing list to preserve original row order and custom rows
  existing.forEach((existingCat) => {
    if (!existingCat) return;
    const catId = existingCat.id;
    const catTitleNorm = norm(existingCat.title);

    const incMatch = incoming.find((inc) => (catId && inc.id === catId) || (catTitleNorm && norm(inc.title) === catTitleNorm));
    if (incMatch) {
      result.push(mergeCategoryUnionForQuickPush(existingCat, incMatch));
      handledExisting.add(existingCat);
      handledIncoming.add(incMatch);
    } else {
      const isCustomCategory = !allKnownIds.has(catId) && !allKnownTitles.has(catTitleNorm);
      if (isCustomCategory) {
        // User custom category created in Nuvio — ALWAYS PRESERVE!
        result.push({ ...existingCat });
        handledExisting.add(existingCat);
      }
      // If it was a recognized category in Kaptain DB that the user deselected, leave it dropped
    }
  });

  // Step 2: Append newly selected incoming categories not previously on the profile
  incoming.forEach((incCat) => {
    if (incCat && !handledIncoming.has(incCat)) {
      result.push({ ...incCat });
    }
  });

  return result;
}

async function performQuickPush() {
  const btn = document.getElementById('quick-push-confirm');
  if (btn) { btn.disabled = true; btn.textContent = 'Pushing…'; }

  try {
    const raw = localStorage.getItem('kaptain_last_push');
    if (!raw) throw new Error('no_state');
    const saved = JSON.parse(raw);
    const { profileId } = saved;
    // Token lives in sessionStorage, not localStorage - see the note in wizard.js.
    // A new tab or a returning visitor has no token and is sent back through
    // Send to Nuvio to sign in again.
    let token = null;
    try { token = sessionStorage.getItem('kaptain_push_token'); } catch (e) {}
    if (!token || !profileId) throw new Error('no_auth');

    const incoming = assembleFilteredDatabase();
    if (!incoming || !incoming.length) throw new Error('Nothing selected.');

    // 1. Pull existing collections to protect user custom categories & folders
    let existing = [];
    try {
      if (window.NuvioPush && typeof window.NuvioPush.pullCollections === 'function') {
        existing = await window.NuvioPush.pullCollections(token, profileId);
      }
    } catch (pullErr) {
      console.warn('Could not pull existing collections before quick push:', pullErr);
    }

    // 2. Safely merge without destroying custom categories or folders
    const merged = mergeCollectionsSafe(existing, incoming);
    (merged || []).forEach((cat) => {
      if (!cat) return;
      if (typeof cat.pinToTop !== 'boolean') cat.pinToTop = true;
      cat.focusGlowEnabled = true;
    });

    await window.NuvioPush.pushCollections(token, profileId, merged);

    localStorage.setItem('kaptain_last_push', JSON.stringify({
      ...saved, timestamp: Date.now(), folderIds: getSelectedFolderIds(),
    }));
    checkSyncState();
    closeQuickPushModal();
    showToast('Nuvio updated.', 'success');
  } catch (e) {
    closeQuickPushModal();
    const msg = (e && e.message) || '';
    const isAuthErr = msg === 'no_auth' || msg === 'no_state' || /401|403|unauthorized|expired/i.test(msg);
    showToast(isAuthErr ? 'Session expired. Running full Setup.' : `Couldn't reach Nuvio. Trying full Setup.`, 'error');
    setTimeout(() => {
      if (window.NuvioWizard && typeof window.NuvioWizard.open === 'function') window.NuvioWizard.open();
    }, 600);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Update Now'; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const qpCancel = document.getElementById('quick-push-cancel');
  const qpConfirm = document.getElementById('quick-push-confirm');
  if (qpCancel) qpCancel.addEventListener('click', () => {
    closeQuickPushModal();
    if (window.NuvioWizard && typeof window.NuvioWizard.open === 'function') window.NuvioWizard.open();
  });
  if (qpConfirm) qpConfirm.addEventListener('click', performQuickPush);
  const qpOverlay = document.getElementById('quick-push-overlay');
  if (qpOverlay) qpOverlay.addEventListener('click', (e) => { if (e.target === qpOverlay) closeQuickPushModal(); });
});

// ==========================================================================
// FEATURE C: COMMAND PALETTE
// ==========================================================================

let _commandPaletteOpen = false;
let _commandHighlightIdx = 0;

function _buildCommandRegistry() {
  const reg = [];
  database.forEach((cat, i) => {
    reg.push({
      label: `Go to ${cat.title}`,
      keywords: [cat.title.toLowerCase(), 'go', 'jump'],
      icon: cat.icon || '📁', group: 'Navigate',
      action: () => { switchCategory(i); closeSidebar(); }
    });
  });
  reg.push({ label: 'Select All in this section', keywords: ['select', 'all', 'check'], icon: '✓', group: 'Selection', action: () => { toggleCategorySelection(currentCategoryIdx, true); renderCategoryActions(); renderFolderGrid(); updateControlCenterStats(); } });
  reg.push({ label: 'Select None in this section', keywords: ['none', 'uncheck', 'deselect', 'clear', 'remove'], icon: '○', group: 'Selection', action: () => { toggleCategorySelection(currentCategoryIdx, false); renderCategoryActions(); renderFolderGrid(); updateControlCenterStats(); } });
  reg.push({ label: 'View: Rows', keywords: ['view', 'rows', 'layout', 'tv'], icon: '▬', group: 'View', action: () => { const s = document.getElementById('viewmode-select'); if (s) { s.value = 'ROWS'; s.dispatchEvent(new Event('change')); } } });
  reg.push({ label: 'View: Tabbed Grid', keywords: ['view', 'tabbed', 'grid', 'mobile', 'phone'], icon: '▦', group: 'View', action: () => { const s = document.getElementById('viewmode-select'); if (s) { s.value = 'TABBED_GRID'; s.dispatchEvent(new Event('change')); } } });
  reg.push({ label: 'View: Auto', keywords: ['view', 'auto'], icon: '⊞', group: 'View', action: () => { const s = document.getElementById('viewmode-select'); if (s) { s.value = 'FOLLOW_LAYOUT'; s.dispatchEvent(new Event('change')); } } });
  reg.push({ label: 'Sort: Custom order', keywords: ['sort', 'custom'], icon: '↕', group: 'Sort', action: () => { const s = document.getElementById('folder-sort'); if (s) { s.value = 'custom'; s.dispatchEvent(new Event('change')); } } });
  reg.push({ label: 'Sort: Popular first', keywords: ['sort', 'popular', 'popularity'], icon: '★', group: 'Sort', action: () => { const s = document.getElementById('folder-sort'); if (s) { s.value = 'popular'; s.dispatchEvent(new Event('change')); } } });
  reg.push({ label: 'Sort: A–Z', keywords: ['sort', 'alphabetical', 'a-z', 'az'], icon: 'A', group: 'Sort', action: () => { const s = document.getElementById('folder-sort'); if (s) { s.value = 'az'; s.dispatchEvent(new Event('change')); } } });
  reg.push({ label: 'Sort: Selected first', keywords: ['sort', 'selected', 'checked', 'first'], icon: '★', group: 'Sort', action: () => { const s = document.getElementById('folder-sort'); if (s) { s.value = 'selected'; s.dispatchEvent(new Event('change')); } } });
  reg.push({ label: 'Send to Nuvio', keywords: ['send', 'push', 'nuvio', 'upload', 'stream'], icon: '📡', group: 'Actions', action: () => handleSendToNuvioClick() });
  reg.push({ label: 'Save File', keywords: ['save', 'download', 'export', 'file'], icon: '💾', group: 'Actions', action: () => document.getElementById('btn-compile-download')?.click() });
  reg.push({ label: 'Export for Bingecat', keywords: ['bingecat', 'export', 'addon', 'cat'], icon: '🐱', group: 'Actions', action: () => exportForBingecat() });
  reg.push({ label: 'Start walkthrough', keywords: ['tour', 'walkthrough', 'guide', 'help', 'replay', 'walk'], icon: '?', group: 'Actions', action: () => document.getElementById('btn-replay-tour')?.click() });
  return reg;
}

function _fuzzyScore(query, cmd) {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const label = cmd.label.toLowerCase();
  const kws = (cmd.keywords || []).join(' ');
  if (label.startsWith(q)) return 4;
  if (label.includes(q)) return 3;
  if (kws.includes(q)) return 2;
  const words = q.split(/\s+/);
  if (words.length > 1 && words.every(w => (label + ' ' + kws).includes(w))) return 1;
  return 0;
}

function _renderCommandResults(query) {
  const container = document.getElementById('command-results');
  if (!container) return;
  const registry = _buildCommandRegistry();
  const results = registry
    .map(cmd => ({ cmd, score: _fuzzyScore(query, cmd) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => x.cmd);

  if (!results.length) {
    container.innerHTML = '<div style="padding:14px 18px;color:var(--text-dark);font-size:0.85rem;">No commands match that.</div>';
    _commandHighlightIdx = 0;
    return;
  }

  _commandHighlightIdx = 0;
  let html = '', lastGroup = '';
  results.forEach((cmd, i) => {
    if (cmd.group !== lastGroup) {
      html += `<div class="command-group-label">${cmd.group}</div>`;
      lastGroup = cmd.group;
    }
    html += `<div class="command-result${i === 0 ? ' highlighted' : ''}" data-idx="${i}"><span class="command-result-icon">${cmd.icon || '·'}</span><span class="command-result-label">${cmd.label}</span></div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('.command-result').forEach((el, i) => {
    el.addEventListener('mouseenter', () => _setCommandHighlight(i));
    el.addEventListener('click', () => { closeCommandPalette(); setTimeout(() => results[i].action(), 50); });
  });

  return results;
}

let _cmdResultsCache = null;
function _setCommandHighlight(idx) {
  const els = document.querySelectorAll('.command-result');
  els.forEach((el, i) => el.classList.toggle('highlighted', i === idx));
  _commandHighlightIdx = idx;
}

function openCommandPalette() {
  if (_commandPaletteOpen) return;
  _commandPaletteOpen = true;
  const overlay = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-input');
  if (!overlay) return;
  overlay.hidden = false;
  if (input) { input.value = ''; input.focus(); }
  _cmdResultsCache = _renderCommandResults('');
}

function closeCommandPalette() {
  _commandPaletteOpen = false;
  const overlay = document.getElementById('command-palette-overlay');
  if (overlay) overlay.hidden = true;
}

function _isInputFocused() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('keydown', (e) => {
    const cmdK = (e.metaKey || e.ctrlKey) && e.key === 'k';
    const bareK = e.key === 'k' && !_isInputFocused() && !e.metaKey && !e.ctrlKey && !e.altKey;
    if (cmdK || bareK) {
      e.preventDefault();
      _commandPaletteOpen ? closeCommandPalette() : openCommandPalette();
      return;
    }
    if (!_commandPaletteOpen) return;
    if (e.key === 'Escape') { closeCommandPalette(); return; }
    const results = document.querySelectorAll('.command-result');
    if (e.key === 'ArrowDown') { e.preventDefault(); _setCommandHighlight(Math.min(_commandHighlightIdx + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _setCommandHighlight(Math.max(_commandHighlightIdx - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); document.querySelector('.command-result.highlighted')?.click(); }
  });

  const cmdInput = document.getElementById('command-input');
  if (cmdInput) cmdInput.addEventListener('input', () => { _cmdResultsCache = _renderCommandResults(cmdInput.value); });

  const cmdOverlay = document.getElementById('command-palette-overlay');
  if (cmdOverlay) cmdOverlay.addEventListener('click', (e) => { if (e.target === cmdOverlay) closeCommandPalette(); });
});

// ==========================================================================
// FEATURE A: SMART START QUIZ
// ==========================================================================

const _quizAnswers = {};

const _quizScorers = {
  movies:    (f) => (f.sources || []).some(s => s.type === 'movie' || !s.type) ? 2 : 0,
  series:    (f) => (f.sources || []).some(s => s.type === 'series') ? 2 : -1,
  action:    (f, cat) => /action|thriller|heist|spy|crime|adventure/i.test(f.title + cat.title) ? 3 : 0,
  comedy:    (f, cat) => /comedy|humor|sitcom/i.test(f.title + cat.title) ? 3 : 0,
  drama:     (f, cat) => /drama/i.test(f.title + cat.title) ? 3 : 0,
  scifi:     (f, cat) => /sci.fi|fantasy|marvel|dc|superhero/i.test(f.title + cat.title) ? 3 : 0,
  horror:    (f, cat) => /horror|scary|fear|terror/i.test(f.title + cat.title) ? 3 : 0,
  docs:      (f, cat) => /documentary|docuseries|true crime|nature/i.test(f.title + cat.title) ? 3 : 0,
  reality:   (f, cat) => /reality|competition|game show|dating/i.test(f.title + cat.title) ? 3 : 0,
  animation: (f, cat) => /animation|animated|pixar|cartoon/i.test(f.title + cat.title) ? 3 : 0,
  anime:     (f, cat) => /anime/i.test(cat.title) ? 5 : /anime/i.test(f.title) ? 3 : 0,
  international: (f, cat) => /international cinema/i.test(cat.title) ? 5 : 0,
  awards:    (f, cat) => /award/i.test(cat.title) ? 5 : /oscar|emmy|cannes|golden globe/i.test(f.title) ? 3 : 0,
  newreleases: (f) => /new|trending|popular/i.test(f.title) ? 2 : 0,
};

function _runSmartStart(answers) {
  const scored = [];
  database.forEach(cat => {
    (cat.folders || []).forEach(folder => {
      let score = 1;
      const ct = answers.contentType;
      if (ct === 'movies' || ct === 'series') score += _quizScorers[ct](folder);
      (answers.genres || []).forEach(g => { if (_quizScorers[g]) score += _quizScorers[g](folder, cat); });
      (answers.musthaves || []).forEach(m => { if (_quizScorers[m]) score += _quizScorers[m](folder, cat); });
      if (/discover/i.test(cat.title)) score += 2;
      scored.push({ folder, cat, score });
    });
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 20);

  database.forEach(cat => {
    (cat.folders || []).forEach(folder => {
      const key = getFolderKey(folder);
      if (selectedMap[key]) Object.keys(selectedMap[key]).forEach(sk => { selectedMap[key][sk] = false; });
    });
  });
  top.forEach(({ folder }) => {
    const key = getFolderKey(folder);
    if (!selectedMap[key]) selectedMap[key] = {};
    (folder.sources || []).forEach(s => { selectedMap[key][getSourceKey(s)] = true; });
  });

  const device = answers.device;
  const vmSelect = document.getElementById('viewmode-select');
  if (vmSelect && device) {
    if (device === 'tv') { vmSelect.value = 'ROWS'; vmSelect.dispatchEvent(new Event('change')); }
    else if (device === 'phone') { vmSelect.value = 'TABBED_GRID'; vmSelect.dispatchEvent(new Event('change')); }
  }

  try { localStorage.setItem('kaptain_quiz_answers', JSON.stringify(answers)); } catch (_) {}
  return top.length;
}

function initQuizScreen(num) {
  const overlay = document.getElementById('quiz-overlay');
  if (!overlay) return;
  overlay.querySelectorAll('.quiz-step').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-screen') === String(num));
  });
  const dots = overlay.querySelectorAll('.quiz-progress-dot');
  dots.forEach((d, i) => d.classList.toggle('done', i < num - 1));
}

document.addEventListener('DOMContentLoaded', () => {
  const quizOverlay = document.getElementById('quiz-overlay');
  if (!quizOverlay) return;

  // Build progress dots
  const progressEl = document.getElementById('quiz-progress');
  if (progressEl) progressEl.innerHTML = [1, 2, 3, 4].map(() => '<div class="quiz-progress-dot"></div>').join('');

  // Pill toggle
  quizOverlay.addEventListener('click', (e) => {
    const pill = e.target.closest('.quiz-pill');
    if (!pill) return;
    const grid = pill.closest('.quiz-pill-grid');
    if (!grid) return;
    if (grid.getAttribute('data-multi') !== 'true') {
      grid.querySelectorAll('.quiz-pill').forEach(p => p.classList.remove('selected'));
    }
    pill.classList.toggle('selected');
  });

  // Next / finish
  quizOverlay.addEventListener('click', (e) => {
    const btn = e.target.closest('.quiz-next');
    if (!btn) return;
    const nextScreen = btn.getAttribute('data-next');
    const activeStep = quizOverlay.querySelector('.quiz-step.active');
    if (activeStep) {
      const grid = activeStep.querySelector('.quiz-pill-grid');
      if (grid) {
        const key = grid.getAttribute('data-key');
        const isMulti = grid.getAttribute('data-multi') === 'true';
        const selected = [...grid.querySelectorAll('.quiz-pill.selected')].map(p => p.getAttribute('data-value'));
        _quizAnswers[key] = isMulti ? selected : (selected[0] || null);
      }
    }
    if (nextScreen === 'done') {
      initQuizScreen('loading');
      setTimeout(() => {
        const count = _runSmartStart(_quizAnswers);
        quizOverlay.hidden = true;
        hideTitleScreen();
        renderSidebar();
        renderFolderGrid();
        updateControlCenterStats();
        if (count > 0) setTimeout(() => showToast(`Picked ${count} folders to get you started. Swap any out.`, 'success'), 400);
      }, 1600);
    } else {
      initQuizScreen(parseInt(nextScreen));
    }
  });

  // Skip / close
  function skipQuiz() {
    quizOverlay.hidden = true;
    Object.keys(_quizAnswers).forEach(k => delete _quizAnswers[k]);
    hideTitleScreen();
  }
  quizOverlay.addEventListener('click', (e) => {
    if (e.target.closest('.quiz-skip')) skipQuiz();
    else if (e.target === quizOverlay) skipQuiz();
  });
});
