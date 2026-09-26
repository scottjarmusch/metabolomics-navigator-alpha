const educationDirectory = document.querySelector('[data-education-directory]');
if (educationDirectory) {
  const search = educationDirectory.querySelector('[data-education-search]');
  const tool = educationDirectory.querySelector('[data-education-tool]');
  const sort = educationDirectory.querySelector('[data-education-sort]');
  const list = educationDirectory.querySelector('.education-list');
  const items = [...educationDirectory.querySelectorAll('[data-education-item]')];
  const count = educationDirectory.querySelector('[data-education-count]');
  const empty = educationDirectory.querySelector('[data-education-empty]');
  const update = () => {
    const q = (search?.value || '').trim().toLowerCase();
    const selected = tool?.value || '';
    const ordered = sort?.value === 'newest' ? [...items].sort((a,b) => Number(b.dataset.year || 0) - Number(a.dataset.year || 0)) : items;
    ordered.forEach(item => list.appendChild(item));
    let visible = 0;
    items.forEach((item) => {
      const matchesText = !q || (item.dataset.search || '').includes(q);
      const tools = (item.dataset.tools || '').split(/\s+/).filter(Boolean);
      const matchesTool = !selected || tools.includes(selected);
      const show = matchesText && matchesTool;
      item.hidden = !show;
      if (show) visible += 1;
    });
    if (count) count.textContent = String(visible);
    if (empty) empty.hidden = visible !== 0;
  };
  search?.addEventListener('input', update);
  tool?.addEventListener('change', update);
  sort?.addEventListener('change', update);
}
