(() => {
  const input = document.querySelector('#ask-query');
  const searchButton = document.querySelector('#ask-search-button');
  const results = document.querySelector('#ask-strategy-results');
  const cards = [...document.querySelectorAll('.ask-strategy-card')];
  const count = document.querySelector('#ask-result-count');
  const empty = document.querySelector('#ask-empty');
  const examples = [...document.querySelectorAll('[data-ask-example]')];
  const guidance = document.querySelector('#ask-guidance');
  const mixedPanel = document.querySelector('#ask-mixed');
  const intentButtons = [...document.querySelectorAll('[data-ask-intent]')];
  // Deliberately narrow labels for existing curated searches, not inferred workflows.
  const intents = [
    {id:'qc', pattern:/\b(?:qc|quality control|drift|batch correction)\b/i},
    {id:'flux', pattern:/\bflux(?:es)?\b/i},
    {id:'pathways', pattern:/\bpathway(?:s)?\b/i},
    {id:'families', pattern:/\b(?:molecular networking|molecular families|related molecules)\b/i},
  ];
  if (!input || !cards.length) return;

  const stop = new Set(['a','an','and','are','for','from','i','in','into','my','of','on','the','to','with','have','has','want','need','find','using','use','can','how','what','when','most','is','am','do','me','data','metabolomics']);
  const tokenize = value => [...new Set(value.toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').split(/\s+/)
    .filter(x => x.length > 1 && !stop.has(x))
    .map(x => x.length > 4 && x.endsWith('s') ? x.slice(0,-1) : x))];
  const metadata = new Map(cards.map(card => [card, {
    words: new Set(tokenize(card.dataset.search || '')),
    name: new Set(tokenize(card.dataset.name || '')),
    keywords: new Set(tokenize(card.dataset.keywords || '')),
  }]));
  const weight = token => 1 + Math.log((cards.length+1)/(1+cards.filter(c=>metadata.get(c).words.has(token)).length));
  function scoreCard(card, tokens) {
    const data=metadata.get(card);
    return tokens.reduce((score,token)=>score + (data.words.has(token) ? weight(token)*(1 + (data.name.has(token)?1:0) + (data.keywords.has(token)?1:0)) : 0),0);
  }

  function runSearch(value) {
    const tokens = tokenize(value);
    let eligible=cards;
    const nmrOnly=/\bnmr\b/i.test(value) && !/\b(?:ms|lc-ms|mass spectrometry)\b/i.test(value);
    if(nmrOnly) eligible=[];
    const flux=/\bflux(?:es)?\b/i.test(value);
    const generalOnly=tokens.length && tokens.every(t=>['new','compare','treated','untreated','cell','study','experiment','start','begin','research'].includes(t));
    const novice = generalOnly || /\b(?:beginner|can metabolomics help|where (?:do|should) we (?:start|begin)|before (?:i|we) collect|tell me which pathways changed)\b/i.test(value) || /\b(?:new to (?:metabolomics|lc-ms|mass spectrometry)|never used metabolomics|first metabolomics (?:study|experiment)|not sure|(?:do not|don['’]?t) (?:know|understand)|(?:where|how) (?:do|should) i (?:start|begin))\b/i.test(value);
    // Exclusion and missing-input requests need clarification, not positive keyword matches.
    const constrained = !novice && /\b(?:forgot|failed) to (?:measure|acquire|collect|include)|\b(?:no|not|without|avoid|exclude|excluding|cannot|can['’]?t|don['’]?t|doesn['’]?t|isn['’]?t)\b/i.test(value);
    const generalStatistics = /\b(?:statistics|statistical analysis)\b/i.test(value) && /\b(?:locally|local|r|python)\b/i.test(value) && !/\b(?:flux|loess|chemrich|enrichment|drift|pls|pca)\b/i.test(value);
    const requestedIntents = intents.filter(intent => intent.pattern.test(value));
    const separateAims = /\b(?:and|then|plus|also|compare)\b|[+;]/i.test(value);
    const mixed = !nmrOnly && !novice && !constrained && separateAims && requestedIntents.length > 1;
    intentButtons.forEach(button => { button.hidden = !requestedIntents.some(intent => intent.id === button.dataset.askIntent); });
    if (mixedPanel) mixedPanel.hidden = !mixed;
    if (mixed || novice || constrained || generalStatistics) eligible=[];
    if ((novice || constrained) && !nmrOnly && guidance) guidance.open=true;
    if(flux) eligible=eligible.filter(card=>(card.dataset.objectives || '').split(' ').includes('flux_analysis'));
    const scored = eligible.map(card => ({card, score: scoreCard(card,tokens)}))
      .filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score || Number(b.card.dataset.year||0) - Number(a.card.dataset.year||0));

    // Relative lexical cutoff suppresses incidental overlaps; it is not a confidence score.
    const recognized = tokens.filter(token => eligible.some(card => metadata.get(card).words.has(token)));
    const cutoff = recognized.length > 1 && scored.length ? scored[0].score * 0.4 : 0;
    const ranked = scored.filter(x => x.score >= cutoff);

    cards.forEach(card => card.hidden = true);
    ranked.slice(0,6).forEach(x => {
      results.appendChild(x.card);
      x.card.hidden = false;
    });

    const shown = Math.min(ranked.length,6);
    if (!tokens.length) {
      count.textContent = 'Choose an example or describe your question.';
      empty.hidden = true;
    } else if (shown) {
      count.textContent = shown + (ranked.length > shown ? ` of ${ranked.length}` : '') + ' matching published Strateg' + (shown === 1 ? 'y' : 'ies') + '.';
      empty.hidden = true;
    } else {
      count.textContent = nmrOnly ? 'Navigator covers MS-based metabolomics; NMR-only workflows are outside scope.' : novice ? 'Please use the study guide to clarify your scientific aim and available measurements.' : constrained ? 'Your question includes an exclusion or missing input. This search cannot reliably apply those constraints; use the study guide to specify your available measurements before selecting a method.' : generalStatistics ? 'Local analysis in R or Python is an option. Use the tool catalogue statistics filter to explore packages; the analysis depends on your study design, metadata and processed measurements. This request does not identify a specific published Strategy.' : mixed ? 'Your question spans several aims. Choose one to explore separately.' : flux && !eligible.length ? 'No curated flux-analysis Strategy is available yet. Isotope networking is not a substitute for flux inference.' : 'No matching published Strategy in the current collection.';
      empty.hidden = !nmrOnly && (mixed || novice || constrained);
    }
  }

  document.querySelector('#ask-guide-button')?.addEventListener('click', () => {
    const stage = document.querySelector('#ask-stage').value;
    const data = document.querySelector('#ask-data').value;
    const aim = document.querySelector('#ask-aim').value;
    const message = document.querySelector('#ask-guide-message');
    // Starting a new guided request clears prior recommendations.
    runSearch('');
    if (!stage || !data || !aim) {
      message.textContent = 'Choose a study stage, measurement type and aim. It is fine to select that you are not sure.';
    } else if (stage === 'planning') {
      message.textContent = 'Start with the guide and your MS facility: define the comparison, sample handling, controls and suitable measurements before choosing an analysis workflow.';
    } else if (data === 'unknown' || data === 'other' || aim === 'unsure') {
      message.textContent = 'Use the guide to clarify your measurement type and scientific aim. Your MS facility can help identify the files and measurements you have.';
    } else if (stage === 'raw') {
      message.textContent = 'First prepare and quality-check your raw files. Explore data-processing tools in the catalogue and check instrument and file-format compatibility before selecting a downstream Strategy.';
    } else if (aim === 'families' && data !== 'msms') {
      message.textContent = 'Spectral molecular families need fragmentation spectra linked to precursors. A feature table alone does not provide that evidence; check whether MS/MS was acquired.';
    } else {
      const queries = {families:'feature based molecular networking', pathways:'pathway enrichment unidentified features', qc:'pooled QC LOESS signal drift', flux:'isotope labeling time course flux'};
      input.value = queries[aim];
      runSearch(input.value);
      message.textContent = aim === 'flux' ? 'These flux methods require a suitable tracer experiment, time courses and model assumptions; ordinary group-comparison data are insufficient.' : aim === 'qc' ? 'QC drift correction requires repeated representative QC injections and recorded injection order. Check these requirements before using the published method.' : 'These are published precedents for your next analytical step. Review their requirements; they are not a complete study plan.';
    }
  });

  searchButton?.addEventListener('click', () => runSearch(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); runSearch(input.value); }
  });
  examples.forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.askExample || button.textContent.trim();
    runSearch(input.value);
    input.focus();
  }));
})();
