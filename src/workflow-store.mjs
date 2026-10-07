import { SecureFile } from './secure-file.mjs';
import { normalizeOrigin } from './connection-security.mjs';
import { validateWorkflow } from './comfyui-client.mjs';

export class WorkflowStore {
  constructor(directory, cipher) { this.storage = new SecureFile(directory, 'workflows', cipher); this.db = { version: 1, entries: {} }; }
  async load() {
    try { const raw = JSON.parse(await this.storage.read());
      if (raw?.version !== 1 || !raw.entries || Array.isArray(raw.entries) || Object.keys(raw.entries).length > 100) throw new Error('Ungültiger Workflow-Tresor.');
      for (const [origin, entry] of Object.entries(raw.entries)) { normalizeOrigin(origin); validateWorkflow(entry.nodes); if (typeof entry.name !== 'string') throw new Error('Ungültiger Workflowname.'); }
      this.db = raw;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  summary(origin) { const entry = this.db.entries[origin]; return entry ? { name: entry.name, nodeCount: Object.keys(entry.nodes).length } : null; }
  async import(origin, name, raw) {
    const nodes = validateWorkflow(raw); const next = structuredClone(this.db);
    next.entries[normalizeOrigin(origin)] = { name: String(name).slice(0, 200), nodes };
    await this.storage.write(JSON.stringify(next)); this.db = next;
    return this.summary(normalizeOrigin(origin));
  }
  async collectUnused(profiles) {
    const origins = new Set(profiles.filter(p => p.type === 'comfyui').map(p => p.baseUrl));
    const entries = Object.fromEntries(Object.entries(this.db.entries).filter(([origin]) => origins.has(origin)));
    if (Object.keys(entries).length === Object.keys(this.db.entries).length) return;
    const next = { version: 1, entries }; await this.storage.write(JSON.stringify(next)); this.db = next;
  }
}
