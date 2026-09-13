const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#main-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });
}

const navigatorSearch = document.querySelector('[data-navigator-search]');
if (navigatorSearch) {
  const input = navigatorSearch.querySelector('input[name="q"]');
  const scopeButtons = navigatorSearch.querySelectorAll('[data-search-scope]');
  const actions = {
    tools: navigatorSearch.dataset.toolsAction,
    strategies: navigatorSearch.dataset.strategiesAction,
  };
  const placeholders = {
    tools: 'Search tools, functions, platforms…',
    strategies: 'Search strategies, objectives, methods…',
  };

  scopeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const scope = button.dataset.searchScope;
      if (!actions[scope]) return;
      navigatorSearch.action = actions[scope];
      if (input) input.placeholder = placeholders[scope];
      scopeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
    });
  });
}
