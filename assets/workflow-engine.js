/* Curated planning rules. Artifacts describe planned outputs, never executed analyses. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NavigatorWorkflow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const fits = (rule, facts) => (rule.requires || []).every(x => facts.has(x)) &&
    !(rule.excludes || []).some(x => facts.has(x));
  function apply(option, facts) {
    const result = new Set(facts);
    (option.produces || []).forEach(x => result.add(x));
    (option.conditionalProduces || []).forEach(rule => {
      if (fits(rule, result)) rule.produces.forEach(x => result.add(x));
    });
    return result;
  }
  function replay(graph, choices) {
    if (!Array.isArray(choices)) throw new Error('Workflow choices must be an array.');
    let facts = new Set(), cursor = 0;
    const history = [];
    for (const stage of graph.stages) {
      if (!fits(stage, facts)) continue;
      const options = stage.options.filter(o => fits(o, facts));
      if (!options.length) throw new Error('No compatible options for required stage: '+stage.id);
      const choice = choices[cursor];
      if (!choice) return {facts, history, stage, options, complete: false};
      const option = options.find(o => o.id === choice);
      if (!option) throw new Error('This choice is no longer compatible with the preceding plan.');
      history.push({stage, option});
      facts = apply(option, facts);
      cursor++;
      if (option.blocker) {
        if (cursor !== choices.length) throw new Error('Unexpected choices after a clarification checkpoint.');
        return {facts, history, stage: null, options: [], complete: false, blocked: option.blocker};
      }
    }
    if (cursor !== choices.length) throw new Error('Unexpected extra workflow choices.');
    return {facts, history, stage: null, options: [], complete: true};
  }
  function validate(graph, catalogue) {
    const tools = new Map(catalogue.map(t => [t.slug, t]));
    const ids = new Set(), stages = new Set();
    if (graph.version !== 1 || !Array.isArray(graph.stages)) throw new Error('Unsupported workflow rules.');
    if (!graph.stages.length) throw new Error('Workflow rules have no stages.');
    for (const stage of graph.stages) {
      if (!stage.id || stages.has(stage.id)) throw new Error('Missing or duplicate workflow stage.');
      stages.add(stage.id);
      if (!stage.question || !Array.isArray(stage.options) || !stage.options.length) throw new Error('Empty workflow stage: '+stage.id);
      for (const option of stage.options) {
        if (!option.id || ids.has(option.id)) throw new Error('Duplicate workflow option: '+option.id);
        ids.add(option.id);
        if (option.blocker && (!option.blocker.title || !option.blocker.nextAction)) throw new Error('Incomplete clarification checkpoint.');
        for (const source of option.sources || []) {
          if (!/^https:\/\//.test(source)) throw new Error('Documentation must use HTTPS: '+option.id);
        }
        for (const key of ['label','why','input','output']) {
          if (!option[key]) throw new Error('Missing '+key+' on '+option.id);
        }
        if (option.tool && (!tools.has(option.tool) || tools.get(option.tool).status.entry !== 'published')) {
          throw new Error('Unavailable catalogue tool: '+option.tool);
        }
      }
    }
    return tools;
  }
  function exportPlan(graph, state, tools, base) {
    return {
      title: 'Metabolomics workflow draft', rulesVersion: graph.version,
      rulesReviewed: graph.reviewed, rulesRevision: graph.revision || null, complete: state.complete,
      status: state.blocked ? 'needs_clarification' : state.complete ? 'draft_complete' : 'in_progress',
      nextAction: state.blocked ? state.blocked.nextAction : null,
      generatedAt: new Date().toISOString(),
      steps: state.history.map(({stage, option}) => ({
        stage: stage.title, choice: option.label, tool: option.tool || null,
        toolName: option.tool ? tools.get(option.tool).name : null,
        url: option.tool ? new URL('tools/'+option.tool+'/', base).href : null,
        purpose: option.why, input: option.input, output: option.output,
        requirements: option.caution || '', sources: option.sources || [],
      })),
      disclaimer: graph.disclaimer,
    };
  }
  function textPlan(plan, markdown = false) {
    const lines = [(markdown ? '# ' : '')+plan.title,
      plan.status === 'needs_clarification' ? 'Status: needs clarification before proceeding.' : plan.complete ? 'Status: planning steps selected.' : 'Status: unfinished draft.',
      'Rules reviewed: '+plan.rulesReviewed, ''];
    if(plan.experiment) {
      lines.push('Experiment: '+plan.experiment.name, 'Suggested outline: '+plan.experiment.outline);
      plan.experiment.checks.forEach(x=>lines.push('Review: '+x));
      if(plan.experiment.limitation) lines.push('Not yet covered: '+plan.experiment.limitation);
      lines.push('');
    }
    if (plan.nextAction) lines.push('Next action: '+plan.nextAction, '');
    plan.steps.forEach((s,i) => {
      if (s.toolName) {
        lines.push((markdown ? '## ' : '')+(i+1)+'. '+(markdown ? '**'+s.toolName+'**' : 'TOOL: '+s.toolName),
          'Stage: '+s.stage, 'Selected task: '+s.choice);
        if (s.url) lines.push(markdown ? '**['+s.toolName+' — Navigator entry]('+s.url+')**' : 'Navigator entry: '+s.url);
      } else {
        lines.push((markdown ? '## ' : '')+(i+1)+'. '+s.stage+' — '+s.choice);
      }
      lines.push('Purpose: '+s.purpose, 'Input: '+s.input, 'Planned output: '+s.output);
      if (s.requirements) lines.push('Check before use: '+s.requirements);
      if (s.sources.length) lines.push('Documentation: '+s.sources.join(' ; '));
      lines.push('');
    });
    lines.push('Generated by Metabolomics Navigator.',plan.disclaimer);
    return lines.join('\n');
  }
  return {fits, apply, replay, validate, exportPlan, textPlan};
});
