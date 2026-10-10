import{apiDestination}from'./ssh-store.mjs';
import { randomUUID } from 'node:crypto';
import { SecureFile } from './secure-file.mjs';
import { normalizeAuth, normalizeOrigin } from './connection-security.mjs';
import {endpointScope} from './api-endpoint.mjs';

export class CredentialStore {
  constructor(directory, cipher) { this.storage = new SecureFile(directory, 'credentials', cipher); }
  async load() {
    try { this.db = JSON.parse(await this.storage.read()); }
    catch (error) { if (error.code !== 'ENOENT') throw error; this.db = { version: 1, entries: {} }; await this.save(); }
    if (this.db?.version !== 1 || !this.db.entries || Array.isArray(this.db.entries)) throw new Error('Ungültiger Zugangstresor.');
    for (const entry of Object.values(this.db.entries)) { normalizeOrigin(entry.origin); normalizeAuth(entry.auth); }
  }
  save() { return this.storage.write(JSON.stringify(this.db)); }
  async add(origin, raw, target) {
    const auth = normalizeAuth(raw);
    if (auth.type === 'none') return null;
    const id = randomUUID(); this.db.entries[id] = { origin: normalizeOrigin(origin), auth, ...(target?{target}:{}) };
    try { await this.save(); } catch (error) { delete this.db.entries[id]; throw error; }
    return id;
  }
  get(profile) {
    if (!profile.authRef) return { type: 'none' };
    const entry = this.db.entries[profile.authRef];
    if (!entry || entry.origin !== normalizeOrigin(profile.baseUrl)) throw new Error('Der gespeicherte Zugang gehört nicht zu diesem Server.');
    if(entry.target && entry.target!==apiDestination(profile) || (profile.ssh || endpointScope(profile)) && !entry.target)throw Error('API-Zugang gehört zu einem anderen Anbieter-/Pfad-/SSH-Ziel. Bitte neu hinterlegen.');
    return normalizeAuth(entry.auth);
  }
  async remove(id) {
    if (!id || !this.db.entries[id]) return;
    const entry = this.db.entries[id]; delete this.db.entries[id];
    try { await this.save(); } catch (error) { this.db.entries[id] = entry; throw error; }
  }
  async collectUnused(profiles) {
    const used = new Set(profiles.map(p => p.authRef).filter(Boolean));
    const previous = this.db.entries;
    const next = Object.fromEntries(Object.entries(previous).filter(([id]) => used.has(id)));
    if (Object.keys(next).length === Object.keys(previous).length) return;
    this.db.entries = next;
    try { await this.save(); } catch (error) { this.db.entries = previous; throw error; }
  }
}
