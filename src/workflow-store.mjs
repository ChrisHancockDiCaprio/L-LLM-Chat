import { SecureFile } from './secure-file.mjs';
import { normalizeOrigin } from './connection-security.mjs';
import { validateWorkflow, validateMapping, validateImageOptions, validateLimits, COMFY_DEFAULTS } from './comfyui-client.mjs';
function identity(profile) {
  const id = typeof profile === 'string' ? profile : profile?.id;
  if (typeof id !== 'string' || !id || id.length > 200 || ['__proto__','constructor','prototype'].includes(id)) throw new Error('Ungültiges Workflow-Profil.');
  return { id, backendType: 'comfyui', baseUrl: normalizeOrigin(typeof profile === 'string' ? profile : profile.baseUrl) };
}
function cleanPrompts(nodes, mapping) {
  for (const field of ['prompt','negativePrompt']) { const t = mapping?.[field]; if (t) nodes[t.nodeId].inputs[t.input] = ''; }
  return nodes;
}
export class WorkflowStore {
  constructor(directory, cipher) { this.storage = new SecureFile(directory, 'workflows', cipher); this.db = { version: 2, entries: {} }; }
  async load(profiles = []) {
    try {
      const raw = JSON.parse(await this.storage.read());
      if (![1,2].includes(raw?.version) || !raw.entries || Array.isArray(raw.entries) || Object.keys(raw.entries).length > 100) throw new Error('Ungültiger Workflow-Tresor.');
      for (const entry of Object.values(raw.entries)) {
        validateWorkflow(entry.nodes); if (entry.mapping) validateMapping(entry.nodes, entry.mapping);
        validateImageOptions(entry.options, entry.mapping, entry.limits); if (typeof entry.name !== 'string') throw new Error('Ungültiger Workflowname.');
      }
      if (raw.version === 1 && profiles.length) {
        const entries = {};
        for (const p of profiles.filter(p => p.type === 'comfyui')) if (raw.entries[p.baseUrl]) entries[p.id] = { ...structuredClone(raw.entries[p.baseUrl]), ...identity(p) };
        this.db = { version: 2, entries };
      } else this.db = { version: 2, entries: raw.entries };
      for (const entry of Object.values(this.db.entries)) {
        if (entry.backendType && entry.backendType !== 'comfyui') throw new Error('Unbekanntes Workflow-Backend.');
        if (entry.baseUrl) normalizeOrigin(entry.baseUrl);
        entry.nodes = cleanPrompts(entry.nodes, entry.mapping); entry.options = { ...entry.options, negativePrompt: '' };
      }
      await this.storage.write(JSON.stringify(this.db));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  get(profile) {
    const { id, baseUrl } = identity(profile); const entry = this.db.entries[id];
    if (entry?.baseUrl && entry.baseUrl !== baseUrl) return null;
    return structuredClone(entry ?? null);
  }
  summary(profile) {
    const entry = this.get(profile);
    return entry ? { name: entry.name, backendType: 'comfyui', baseUrl: entry.baseUrl, nodeCount: Object.keys(entry.nodes).length, ready: Boolean(entry.mapping), mapping: entry.mapping ?? null, options: entry.options ?? COMFY_DEFAULTS, limits: validateLimits(entry.limits),
      editableInputs: Object.entries(entry.nodes).flatMap(([nodeId, node]) => Object.entries(node.inputs).filter(([input, value]) => ['string','number'].includes(typeof value) && input.length <= 100).map(([input, value]) => ({ nodeId, input, type: typeof value, label: `${nodeId} · ${node.class_type} · ${input}` }))),
      outputNodes: Object.entries(entry.nodes).map(([id, node]) => ({ id, label: `${id} · ${node.class_type}` })) } : null;
  }
  async import(profile, name, raw) {
    const meta = identity(profile); const bundle = raw?.backendType ? raw : null;
    if (bundle && (bundle.backendType !== meta.backendType || normalizeOrigin(bundle.baseUrl) !== meta.baseUrl)) throw new Error('Backend oder Server des importierten Profils passen nicht zur Verbindung.');
    const nodes = validateWorkflow(bundle ? bundle.nodes : raw); const mapping = bundle?.mapping ? validateMapping(nodes, bundle.mapping) : null;
    const limits = validateLimits(bundle?.limits); const options = validateImageOptions({ ...COMFY_DEFAULTS, ...bundle?.options, negativePrompt: '' }, mapping, limits);
    const next = structuredClone(this.db); next.entries[meta.id] = { ...meta, name: String(bundle?.name ?? name).slice(0, 200), nodes: cleanPrompts(nodes, mapping), mapping, options, limits };
    await this.storage.write(JSON.stringify(next)); this.db = next; return this.summary(profile);
  }
  async configure(profile, rawMapping, rawOptions, rawLimits) {
    const meta = identity(profile); const entry = this.get(profile); if (!entry) throw new Error('Bitte zuerst einen API-Workflow importieren.');
    const mapping = validateMapping(entry.nodes, rawMapping); const limits = validateLimits(rawLimits ?? entry.limits);
    const options = validateImageOptions({ ...rawOptions, negativePrompt: '' }, mapping, limits);
    const next = structuredClone(this.db); next.entries[meta.id] = { ...entry, ...meta, nodes: cleanPrompts(entry.nodes, mapping), mapping, options, limits };
    await this.storage.write(JSON.stringify(next)); this.db = next; return this.summary(profile);
  }
  async collectUnused(profiles) {
    const ids = new Set(profiles.filter(p => p.type === 'comfyui').map(p => p.id));
    const entries = Object.fromEntries(Object.entries(this.db.entries).filter(([id]) => ids.has(id)));
    if (Object.keys(entries).length === Object.keys(this.db.entries).length) return;
    const next = { version: 2, entries }; await this.storage.write(JSON.stringify(next)); this.db = next;
  }
}
