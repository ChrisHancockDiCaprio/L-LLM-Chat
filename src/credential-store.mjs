import { randomUUID } from 'node:crypto';
import { SecureFile } from './secure-file.mjs';
import { normalizeAuth, normalizeOrigin } from './connection-security.mjs';

export class CredentialStore {
  constructor(directory, cipher) { this.storage = new SecureFile(directory, 'credentials', cipher); }
  async load() {
    try { this.db = JSON.parse(await this.storage.read()); }
    catch (error) { if (error.code !== 'ENOENT') throw error; this.db = { version: 1, entries: {} }; await this.save(); }
    if (this.db?.version !== 1 || !this.db.entries || Array.isArray(this.db.entries)) throw new Error('Ungültiger Zugangstresor.');
    for (const entry of Object.values(this.db.entries)) { normalizeOrigin(entry.origin); normalizeAuth(entry.auth); }
  }
  save() { return this.storage.write(JSON.stringify(this.db)); }
  async add(origin, raw) {
    const auth = normalizeAuth(raw);
    if (auth.type === 'none') return null;
    const id = randomUUID(); this.db.entries[id] = { origin: normalizeOrigin(origin), auth };
    try { await this.save(); } catch (error) { delete this.db.entries[id]; throw error; }
    return id;
  }
  get(profile) {
    if (!profile.authRef) return { type: 'none' };
    const entry = this.db.entries[profile.authRef];
    if (!entry || entry.origin !== normalizeOrigin(profile.baseUrl)) throw new Error('Der gespeicherte Zugang gehört nicht zu diesem Server.');
    return normalizeAuth(entry.auth);
  }
  async remove(id) { if (id && this.db.entries[id]) { delete this.db.entries[id]; await this.save(); } }
}
