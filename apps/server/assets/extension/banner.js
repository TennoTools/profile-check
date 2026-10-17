// Content script: in-site banner (see banner.css) — placed in the page flow right under the fixed header.
const banner = document.createElement('div');
banner.id = 'tt-banner';
banner.innerHTML =
  '<div class="tt">TennoTools</div>' +
  '<div class="text">Temporary browser opened by the get-id script — all data (cookies, session) is erased when this window closes. Sites see it as an "automated" browser: Warframe may reject your first login — just log in again.</div>';

// First child of #mainContent: its padding-top (--page-header-height) reserves the fixed header's space,
// so the banner lands right under the header and pushes the page content down without covering anything.
const mount = () => {
  if (!document.body || document.getElementById('tt-banner')) return;
  (document.querySelector('#mainContent') ?? document.body).prepend(banner);
};
mount();
document.addEventListener('DOMContentLoaded', mount);
addEventListener('load', mount); // one-shot re-checks after hydration/re-renders
for (const event of ['turbo:load', 'livewire:navigated']) document.addEventListener(event, mount);
