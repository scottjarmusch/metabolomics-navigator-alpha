(() => {
  const root = document.querySelector('[data-catalogue]');
  if (!root) return;
  const cards = [...root.querySelectorAll('[data-record-card]')];
  const search = root.querySelector('[data-search]');
  const filters = [...root.querySelectorAll('[data-filter]')];
  const sort = root.querySelector('[data-sort]');
  const grid = root.querySelector('[data-record-grid]');
  const count = root.querySelector('[data-result-count]');
  const empty = root.querySelector('[data-empty]');
  const active = root.querySelector('[data-active-filters]');
  const params = new URLSearchParams(location.search);
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const data = (card, key) => card.getAttribute(`data-${key}`) || '';
  const choose = (select, value) => {
    if ([...select.options].some(option => option.value === value)) select.value = value;
  };
  if (search) search.value = params.get('q') || '';
  filters.forEach(select => choose(select, params.get(select.dataset.filter) || ''));
  if (sort) choose(sort, params.get('sort') || 'az');
  function addChip(label, clear) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${label} ×`;
    button.setAttribute('aria-label', `Remove ${label}`);
    button.addEventListener('click', () => { clear(); apply(); search?.focus(); });
    active.appendChild(button);
  }
  function apply() {
    const query = (search?.value || '').trim();
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const visible = cards.filter(card => {
      const haystack = normalize(data(card, 'search-text'));
      if (!terms.every(term => haystack.includes(term))) return false;
      return filters.every(select => !select.value || data(card, select.dataset.filter).split(/\s+/).includes(select.value));
    });
    const mode = sort?.value || 'az';
    visible.sort((a, b) => {
      const byName = data(a, 'name').localeCompare(data(b, 'name'));
      if (mode === 'newest') return data(b, 'created').localeCompare(data(a, 'created')) || byName;
      if (mode === 'updated') return data(b, 'updated').localeCompare(data(a, 'updated')) || byName;
      return byName;
    });
    cards.forEach(card => { card.hidden = true; });
    visible.forEach(card => { card.hidden = false; grid.appendChild(card); });
    count.textContent = String(visible.length);
    empty.hidden = visible.length > 0;
    active.replaceChildren();
    if (query) addChip(`Search: ${query}`, () => { search.value = ''; });
    filters.forEach(select => {
      if (!select.value) return;
      const label = select.options[select.selectedIndex].text.replace(/ \(\d+\)$/, '');
      addChip(label, () => { select.value = ''; });
    });
    active.hidden = active.children.length === 0;
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    filters.forEach(select => { if (select.value) next.set(select.dataset.filter, select.value); });
    if (mode !== 'az') next.set('sort', mode);
    history.replaceState(null, '', `${location.pathname}${next.toString() ? '?' + next : ''}${location.hash}`);
  }
  let timer;
  search?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 100); });
  filters.forEach(select => select.addEventListener('change', apply));
  sort?.addEventListener('change', apply);
  root.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => {
    clearTimeout(timer);
    if (search) search.value = '';
    filters.forEach(select => { select.value = ''; });
    if (sort) sort.value = 'az';
    apply(); search?.focus();
  }));
  apply();
})();
