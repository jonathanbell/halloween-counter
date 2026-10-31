/* Shared chrome for the static admin tools (remote / settings).
   Loaded by a plain <script> tag - these pages are served straight from
   public/ and are deliberately not part of the Vite bundle. */

(function () {
  var TABS = [
    { id: 'remote', href: '/remote.html', label: 'Remote', icon: '📱' },
    { id: 'settings', href: '/settings.html', label: 'Settings', icon: '⚙️' },
  ];

  // Each tool has its own token, so a tab link cannot carry the right one.
  // Instead each page caches the token it was opened with, keyed per tool,
  // and the tabs work once both QR codes have been scanned on this device.
  // sessionStorage (not local) so it dies with the tab.
  function readToken(key) {
    var fromUrl = new URLSearchParams(window.location.search).get('token');

    try {
      if (fromUrl) {
        window.sessionStorage.setItem(key, fromUrl);
        return fromUrl;
      }
      return window.sessionStorage.getItem(key);
    } catch (err) {
      // Private mode, or site data blocked - fall back to the URL alone.
      return fromUrl;
    }
  }

  function renderTabs(active) {
    var nav = document.createElement('nav');
    nav.className = 'page-nav';

    // Links to the other tools only - the title already says where you are
    nav.innerHTML = TABS.filter(function (tab) {
      return tab.id !== active;
    }).map(function (tab) {
      return (
        '<a class="pill" href="' + tab.href + '">' +
        '<span aria-hidden="true">' + tab.icon + '</span>' +
        '<span>' + tab.label + '</span>' +
        '</a>'
      );
    }).join('');

    document.body.prepend(nav);
  }

  // Replaces the whole page when there is no usable token - the tools are
  // useless without one and every write would 401.
  function requireToken(key, label) {
    var token = readToken(key);
    if (token) return token;

    document.body.innerHTML =
      '<div class="token-missing">' +
      '<h1 class="page-title">🎃 Token needed</h1>' +
      '<p>Scan the ' + label + ' QR code to open this page.</p>' +
      '</div>';

    return null;
  }

  window.AdminChrome = { renderTabs: renderTabs, requireToken: requireToken };
})();
