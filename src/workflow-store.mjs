import { SecureFile } from './secure-file.mjs';
import { normalizeOrigin } from './connection-security.mjs';
import { validateWorkflow, validateMapping, validateImageOptions, COMFY_DEFAULTS } from './comfyui-client.mjs';

export class WorkflowStore {
  constructor(directory, cipher) { this.storage = new SecureFile(directory, 'workflows', cipher); this.db = { version: 1, entries: {} }; }
  async load() {
    try { const raw = JSON.parse(await this.storage.read());
      if (raw?.version !== 1 || !raw.entries || Array.isArray(raw.entries) || Object.keys(raw.entries).length > 100) throw new Error('Ungültiger Workflow-Tresor.');
      for (const [origin, entry] of Object.entries(raw.entries)) { normalizeOrigin(origin); validateWorkflow(entry.nodes); if (entry.mapping) validateMapping(entry.nodes, entry.mapping); validateImageOptions(entry.options); if (typeof entry.name !== 'string') throw new Error('Ungültiger Workflowname.'); }
      this.db = raw;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  get(origin) { return structuredClone(this.db.entries[normalizeOrigin(origin)] ?? null); }
  summary(origin) {
    const entry = this.db.entries[origin];
    return entry ? { name: entry.name, nodeCount: Object.keys(entry.nodes).length, ready: Boolean(entry.mapping), mapping: entry.mapping ?? null, options: entry.options ?? COMFY_DEFAULTS,
      editableInputs: Object.entries(entry.nodes).flatMap(([nodeId, node]) => Object.entries(node.inputs).filter(([input, value]) => ['string','number'].includes(typeof value) && input.length <= 100).map(([input, value]) => ({ nodeId, input, type: typeof value, label: `${nodeId} · ${node.class_type} · ${input}` }))),
      outputNodes: Object.entries(entry.nodes).map(([id, node]) => ({ id, label: `${id} · ${node.class_type}` })) } : null;
  }
  async import(origin, name, raw) {
    const nodes = validateWorkflow(raw); const next = structuredClone(this.db);
    next.entries[normalizeOrigin(origin)] = { name: String(name).slice(0, 200), nodes, mapping: null, options: COMFY_DEFAULTS };
    await this.storage.write(JSON.stringify(next)); this.db = next;
    return this.summary(normalizeOrigin(origin));
  }
  async configure(origin, rawMapping, rawOptions) {
    origin = normalizeOrigin(origin); const entry = this.db.entries[origin];
    if (!entry) throw new Error('Bitte zuerst einen API-Workflow importieren.');
    const mapping = validateMapping(entry.nodes, rawMapping); const options = validateImageOptions(rawOptions);
    if (!mapping.negativePrompt && options.negativePrompt.trim()) throw new Error('Bitte einen Eingang für Negative Prompt zuordnen oder das Feld leeren.');
    const next = structuredClone(this.db); next.entries[origin] = { ...next.entries[origin], mapping, options };
    await this.storage.write(JSON.stringify(next)); this.db = next;
    return this.summary(origin);
  }
  async collectUnused(profiles) {
    const origins = new Set(profiles.filter(p => p.type === 'comfyui').map(p => p.baseUrl));
    const entries = Object.fromEntries(Object.entries(this.db.entries).filter(([origin]) => origins.has(origin)));
    if (Object.keys(entries).length === Object.keys(this.db.entries).length) return;
    const next = { version: 1, entries }; await this.storage.write(JSON.stringify(next)); this.db = next;
  }
}
