export function mountNavigation() {
  const menu = document.querySelector<HTMLDetailsElement>('#page-menu')!;
  const route = () => {
    const requested = new URLSearchParams(location.search).get('page');
    const active = requested === 'import-grid' || requested === 'techniques' || requested === 'simulation' ? requested : 'generate';
    for (const [name, id] of [['generate', 'maker-page'], ['import-grid', 'import-page'], ['techniques', 'techniques-page'], ['simulation', 'simulation-page']]) {
      document.getElementById(id)!.hidden = active !== name;
    }
    document.querySelectorAll<HTMLAnchorElement>('.page-nav a').forEach(a => {
      if (new URL(a.href).searchParams.get('page') === active) {
        a.setAttribute('aria-current', 'page'); menu.querySelector('summary')!.textContent = a.textContent;
      } else a.removeAttribute('aria-current');
    });
    menu.open = false;
    window.dispatchEvent(new Event('pagechange'));
  };
  const migrate = () => {
    const url = new URL(location.href);
    if (['#maker', '#import-grid', '#techniques'].includes(url.hash)) { url.searchParams.set('page', url.hash.slice(1)); url.hash = ''; }
    if (url.searchParams.get('page') === 'maker') url.searchParams.set('page', 'generate');
    if (url.href !== location.href) history.replaceState(null, '', url);
  };
  document.querySelectorAll<HTMLAnchorElement>('.page-nav a').forEach(a => a.addEventListener('click', event => {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); history.pushState(null, '', a.href); route(); menu.querySelector('summary')!.focus();
  }));
  document.addEventListener('click', event => { if (!menu.contains(event.target as Node)) menu.open = false; });
  menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary')!.focus(); } });
  window.addEventListener('popstate', () => { migrate(); route(); });
  window.addEventListener('hashchange', () => { migrate(); route(); });
  migrate(); route();
}
