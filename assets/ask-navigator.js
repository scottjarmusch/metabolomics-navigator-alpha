(async function () {
  'use strict';
  const root = document.getElementById('ask-builder');
  if (!root) return;
  const engine = window.NavigatorWorkflow, $ = id => document.getElementById(id);
  const base = new URL(root.dataset.base, location.origin);
  const exportBase = new URL(root.dataset.exportBase || base, location.origin);
  function el(tag, text, cls) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function button(text, action, cls) {
    const node = el('button', text, cls);
    node.type = 'button'; node.addEventListener('click', action); return node;
  }
  try {
    const [graph, catalogue] = await Promise.all(['assets/workflow-compatibility.json','tool-data.json'].map(async path => {
      const response = await fetch(new URL(path+'?v='+root.dataset.version,base));
      if (!response.ok) throw new Error('Could not load planning data.');
      return response.json();
    }));
    const tools = engine.validate(graph, catalogue);
    let choices = [], profile = null, started = false, state = engine.replay(graph, choices);
    const smallScreen = matchMedia('(max-width: 900px)'), details = $('workflow-details');
    details.open = !smallScreen.matches;
    smallScreen.addEventListener('change', () => { details.open = !smallScreen.matches; });
    function toolLink(slug) {
      const link = el('a', tools.get(slug).name+' · full entry');
      link.href = new URL('tools/'+slug+'/',base).href;
      link.target = '_blank'; link.rel = 'noopener';
      link.setAttribute('aria-label',tools.get(slug).name+' full entry (opens in a new tab)');
      return link;
    }
    function currentPlan() {
      const plan=engine.exportPlan(graph,state,tools,exportBase);
      if(profile) plan.experiment={id:profile.id,name:profile.name,outline:profile.outline,checks:profile.checks,limitation:profile.limitation || null};
      return plan;
    }
    function render(focus = true) {
      $('workflow-panel').hidden=!started; $('ask-controls').hidden=!started;
      $('ask-entry').hidden=started;
      if(!started) {
        $('ask-history').replaceChildren(); $('ask-question').replaceChildren();
        const entry=$('ask-entry'); entry.replaceChildren();
        const heading=el('h2','How would you like to start?');heading.tabIndex=-1;entry.append(heading);
        entry.append(el('p','Choose a common experiment for tailored guidance, or build your own. You can review every choice.'));
        const cards=el('div',null,'starter-grid');
        for(const item of graph.profiles) {
          const card=el('article',null,'ask-choice');
          const select=button(item.name,()=>{profile=item;started=true;choices=[];render();},'ask-option');
          select.dataset.profile=item.id;card.append(select,el('p',item.summary));cards.append(card);
        }
        entry.append(cards,button('Build my own workflow',()=>{profile=null;started=true;choices=[];render();},'button'));
        if(focus) heading.focus();
        return;
      }
      state = engine.replay(graph, choices);
      $('ask-history').replaceChildren(); $('workflow-list').replaceChildren();
      $('copy-fallback').hidden = true; $('export-status').textContent = '';
      state.history.forEach(({stage, option}, index) => {
        const history = el('div', null, 'ask-answer');
        history.append(el('span', stage.title+' · '+option.label));
        const change = button('Change', () => { choices = choices.slice(0,index); render(); });
        change.setAttribute('aria-label','Change '+stage.title.toLowerCase());
        history.append(change); $('ask-history').append(history);
        const item = el('li');
        item.append(el('strong',stage.title),el('p',option.label));
        if (option.tool) item.append(toolLink(option.tool));
        item.append(el('span','Purpose: '+option.why),el('span','Input: '+option.input),el('span','Planned output: '+option.output));
        if (option.caution) item.append(el('span','Check: '+option.caution));
        $('workflow-list').append(item);
      });
      $('workflow-count').textContent = '· '+choices.length+' choices'+(state.complete ? ' · ready to export' : '');
      $('workflow-empty').hidden = !!choices.length;
      $('ask-back').disabled = !choices.length; $('ask-reset').disabled = !choices.length;
      ['copy-plan','markdown-plan','json-plan','print-plan'].forEach(id => { $(id).disabled = !choices.length; });
      const question = $('ask-question'); question.replaceChildren();
      if(profile) {
        const context=el('details',null,'starter-context');context.open=!choices.length;
        context.append(el('summary','Starting point: '+profile.name),el('p',profile.outline));
        const checks=el('ul');profile.checks.forEach(x=>checks.append(el('li',x)));context.append(checks);
        if(profile.limitation)context.append(el('p',profile.limitation));
        question.append(context);
      }
      const title = el('h2', state.blocked ? state.blocked.title : state.complete ? 'Your workflow draft is ready to review.' : state.stage.question);
      title.tabIndex = -1; title.id = 'current-question'; question.append(title);
      if (state.blocked) {
        question.append(el('p',state.blocked.nextAction,'ask-checkpoint'));
        if (state.blocked.guide) {
          const link=el('a','Explore the relevant guide');
          link.href=new URL(state.blocked.guide,base).href; question.append(link);
        }
        question.append(button('Export clarification checklist', () => { details.open=true; details.scrollIntoView({block:'start'}); $('copy-plan').focus(); },'button'));
      } else if (state.complete) {
        question.append(el('p','Export this draft for discussion with your team. Changing an earlier choice clears the downstream selections.'));
        question.append(button('Review and export workflow', () => { details.open=true; details.scrollIntoView({block:'start'}); $('copy-plan').focus(); },'button'));
      } else {
        question.append(el('p',state.stage.intro));
        if(profile && profile.guidance[state.stage.id]) question.append(el('p',profile.guidance[state.stage.id],'starter-guidance'));
        const options = el('div', null, 'ask-options'); options.setAttribute('aria-labelledby','current-question');
        state.options.forEach(option => {
          const card = el('article', null, 'ask-choice');
          const choose = button(option.label, () => { choices.push(option.id); render(); },'ask-option');
          choose.dataset.choice = option.id;
          if(profile && profile.suggestions && profile.suggestions[state.stage.id]===option.id) card.append(el('p','Suggested for this starting point · review before choosing','starter-suggestion'));
          card.append(choose, el('p',option.why));
          const why = el('details', null, 'method-detail');
          why.append(el('summary','Why this option? Inputs and checks'),el('p','Input: '+option.input),el('p','Planned output: '+option.output));
          if (option.caution) why.append(el('p',option.caution));
          if (option.tool) why.append(toolLink(option.tool));
          for (const source of option.sources || []) {
            const url = new URL(source);
            if (!url.href.startsWith('https://')) continue;
            const link = el('a','Documentation · '+url.hostname);
            link.href = url.href; link.target='_blank'; link.rel='noopener';
            why.append(el('br'),link);
          }
          card.append(why); options.append(card);
        });
        question.append(options);
      }
      if (focus) title.focus();
      const printable = $('workflow-print');
      const exported = currentPlan();
      printable.replaceChildren(el('p','METABOLOMICS NAVIGATOR','print-brand'),el('h1',exported.title),el('p',(state.blocked ? 'Needs clarification before proceeding' : state.complete ? 'Planning steps selected' : 'Unfinished draft')+' · Rules reviewed '+graph.reviewed));
      if(exported.experiment) {
        printable.append(el('h2','Starting point: '+profile.name),el('p',profile.outline));
        profile.checks.forEach(x=>printable.append(el('p','Review: '+x)));
        if(profile.limitation)printable.append(el('p',profile.limitation));
      }
      if (exported.nextAction) printable.append(el('p','Next action: '+exported.nextAction,'print-next-action'));
      exported.steps.forEach((step,index) => {
        const section=el('section',null,'print-step');
        if (step.toolName) {
          section.append(el('p',(index+1)+'. '+step.stage,'print-stage'));
          section.append(el('h2',step.toolName,'print-tool-name'));
          section.append(el('p',step.choice,'print-choice'));
        } else {
          section.append(el('h2',(index+1)+'. '+step.stage));
          section.append(el('p',step.choice));
        }
        for(const [label,value] of [['Purpose',step.purpose],['Input',step.input],['Planned output',step.output],['Check before use',step.requirements]]) {
          if(value) { const p=el('p');p.append(el('strong',label+': '),document.createTextNode(value));section.append(p); }
        }
        if(step.url) { const link=el('a',step.url);link.href=step.url;section.append(link); }
        for (const source of step.sources) {
          const link=el('a','Documentation: '+source);link.href=source;const p=el('p');p.append(link);section.append(p);
        }
        printable.append(section);
      });
      printable.append(el('p',graph.disclaimer,'print-disclaimer'));
    }
    const plan = currentPlan;
    function download(content, type, filename) {
      const url = URL.createObjectURL(new Blob([content],{type}));
      const link = el('a'); link.href=url; link.download=filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      $('export-status').textContent='Downloaded '+filename;
    }
    $('ask-start-over').addEventListener('click', () => { started=false; profile=null; choices=[]; render(); });
    $('ask-back').addEventListener('click', () => { choices.pop(); render(); });
    $('ask-reset').addEventListener('click', () => { choices=[]; render(); });
    $('copy-plan').addEventListener('click', async () => {
      const text = engine.textPlan(plan());
      try { await navigator.clipboard.writeText(text); $('export-status').textContent='Workflow copied.'; }
      catch { $('copy-fallback').hidden=false; $('workflow-text').value=text; $('workflow-text').focus(); $('workflow-text').select(); $('export-status').textContent='Clipboard unavailable. Select and copy the text below.'; }
    });
    $('markdown-plan').addEventListener('click', () => download(engine.textPlan(plan(),true),'text/markdown;charset=utf-8','metabolomics-workflow.md'));
    $('json-plan').addEventListener('click', () => download(JSON.stringify(plan(),null,2),'application/json','metabolomics-workflow.json'));
    $('print-plan').addEventListener('click', () => window.print());
    $('ask-load').hidden=true; $('ask-controls').hidden=false; render(false);
  } catch (error) {
    $('ask-load').textContent='The workflow builder could not load. Reload this page or use the tool catalogue while it is unavailable.';
    $('ask-controls').hidden=true; console.error('Ask Navigator:',error);
  }
})();
