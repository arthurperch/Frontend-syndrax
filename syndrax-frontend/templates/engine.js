/**
 * Syndrax template engine — shared helpers for catalog page + dashboard.
 * Steps 5–9: workflows, share meta, local remix, inspo refs, automation import.
 */
(function (root) {
  const META_KEY = 'syndrax_template_meta_v1';
  const REMIX_KEY = 'syndrax_template_remixes_v1';

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
  }
  function saveMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {}
  }
  function loadRemixes() {
    try { return JSON.parse(localStorage.getItem(REMIX_KEY) || '{}'); } catch { return {}; }
  }
  function saveRemixes(map) {
    try { localStorage.setItem(REMIX_KEY, JSON.stringify(map)); } catch {}
  }

  function getMeta(template) {
    const all = loadMeta();
    const o = all[template.id] || {};
    return {
      status: o.status || template.status || 'draft',
      sharedWith: Array.isArray(o.sharedWith) ? o.sharedWith : (template.sharedWith || []),
      notes: o.notes || '',
      updatedAt: o.updatedAt || template.updatedAt || null,
    };
  }

  function setMeta(templateId, patch) {
    const all = loadMeta();
    const cur = all[templateId] || {};
    all[templateId] = {
      ...cur,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    saveMeta(all);
    return all[templateId];
  }

  function fillBody(body, values) {
    if (!body) return '';
    return String(body).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const v = values[key];
      return (v === undefined || v === '') ? `{{${key}}}` : v;
    });
  }

  /** Offline-safe local remix: 3 variants from body + promptHint (no API keys in browser). */
  function remixLocal(template, values) {
    const base = fillBody(template.body || '', values || {});
    const hint = (template.ai && template.ai.promptHint) || '';
    const kind = template.kind;

    const v1 = base;

    let v2 = base
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+\n/g, '\n')
      .trim();
    if (kind === 'buyer-message') {
      v2 = v2
        .replace(/^Hi\s+[^,\n]+,\s*/i, 'Hello,\n\n')
        .replace(/\nThanks[\s\S]*$/i, '\nBest regards,');
      // shorter: drop parenthetical clauses
      v2 = v2.replace(/\s*\([^)]*\)/g, '');
    } else if (kind === 'listing-description') {
      // compact: strip some padding-heavy noise isn't ideal on HTML — mark as Compact variant header
      v2 = '<!-- compact remix -->\n' + v2;
    }

    let v3 = base;
    if (kind === 'buyer-message') {
      v3 = base
        .replace(/^Hi\s+/i, 'Dear ')
        .replace(/no hassle/gi, 'at no cost to you')
        .replace(/Quick update/gi, 'Order update');
      if (!/regards|sincerely/i.test(v3)) {
        v3 = v3.replace(/\n([^\n]+)\s*$/, '\nKind regards,\n$1');
      }
    } else if (kind === 'listing-description') {
      v3 = '<!-- formal remix · ' + hint.slice(0, 80) + ' -->\n' + base;
    } else {
      v3 = base + '\n\n— Remix note: ' + (hint || 'Keep structure; vary tone only.');
    }

    const wanted = (template.ai && template.ai.variantsWanted) || 3;
    const all = [
      { id: 'a', label: 'Original structure', body: v1 },
      { id: 'b', label: 'Tighter / shorter', body: v2 },
      { id: 'c', label: 'More formal', body: v3 },
    ].slice(0, Math.max(1, Math.min(10, wanted)));

    const map = loadRemixes();
    map[template.id] = { createdAt: new Date().toISOString(), variants: all, hint };
    saveRemixes(map);
    return all;
  }

  function workflowSteps(template) {
    const steps = (template.payload && template.payload.steps) || [];
    return steps.map((s) => (typeof s === 'string' ? s : s.key)).filter(Boolean);
  }

  function automationFromWorkflow(template, marketplace) {
    const mk = marketplace || (template.marketplace && template.marketplace[0]) || 'ebay';
    const meta = getMeta(template);
    return {
      id: 'pack-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 5),
      label: template.title,
      marketplace: mk,
      steps: workflowSteps(template),
      interval: (template.payload && template.payload.interval) || 'Manual',
      auditAgent: !(template.payload && template.payload.auditAgent === false),
      fromTemplate: template.id,
      status: meta.status,
      sharedWith: meta.sharedWith.slice(),
      kind: 'workflow',
    };
  }

  function automationFromModule(template, marketplace) {
    const mk = marketplace || (template.marketplace && template.marketplace[0]) || 'ebay';
    const steps = workflowSteps(template);
    // automation-module may store action labels as steps
    const actionSteps = (template.payload && template.payload.actions) || [];
    const keys = steps.length
      ? steps
      : actionSteps.map((a, i) => a.key || a.type || ('step-' + (i + 1)));
    return {
      id: 'mod-' + Date.now().toString(36),
      label: template.title || 'Imported automation',
      marketplace: mk,
      steps: keys,
      interval: (template.payload && template.payload.interval) || 'Manual',
      auditAgent: true,
      fromTemplate: template.id,
      kind: 'automation-module',
      mutationHistory: (template.payload && template.payload.mutationHistory) || [],
      raw: template,
    };
  }

  function parseImportJson(text) {
    const data = JSON.parse(text);
    // accept full template object or { templates: [...] } or automation export
    if (Array.isArray(data.templates)) return data.templates;
    if (data.id && data.kind) return [data];
    if (data.kind === 'automation-module' || data.actions || data.steps) {
      return [{
        id: data.id || ('import.' + Date.now().toString(36)),
        version: data.version || '1.0.0',
        kind: data.kind || 'automation-module',
        title: data.title || data.label || 'Imported module',
        summary: data.summary || '',
        status: data.status || 'draft',
        createdBy: data.createdBy || 'import',
        sharedWith: data.sharedWith || [],
        marketplace: data.marketplace || ['ebay'],
        tags: data.tags || ['import'],
        variables: data.variables || [],
        payload: data.payload || {
          steps: data.steps || [],
          actions: data.actions || [],
          mutationHistory: data.mutationHistory || [],
          interval: data.interval || 'Manual',
        },
        body: data.body || null,
      }];
    }
    throw new Error('Unrecognized template JSON shape');
  }

  function validateAutomationModule(t) {
    const errors = [];
    if (!t.title && !t.id) errors.push('Missing title/id');
    const steps = workflowSteps(t);
    const actions = (t.payload && t.payload.actions) || [];
    if (!steps.length && !actions.length) errors.push('No steps/actions');
    return { ok: errors.length === 0, errors };
  }

  root.SyndraxTemplates = {
    META_KEY,
    loadMeta,
    saveMeta,
    getMeta,
    setMeta,
    fillBody,
    remixLocal,
    workflowSteps,
    automationFromWorkflow,
    automationFromModule,
    parseImportJson,
    validateAutomationModule,
    loadRemixes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
