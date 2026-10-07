import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SecureFile } from './secure-file.mjs';

const freshSession = () => ({ id: randomUUID(), title: 'Neues Gespräch', createdAt: new Date().toISOString(), messages: [] });
function validDatabase(db) {
  return db?.version === 1 && Array.isArray(db.sessions) && db.sessions.length > 0 &&
    db.sessions.some(s => s.id === db.activeId) && new Set(db.sessions.map(s => s.id)).size === db.sessions.length &&
    db.sessions.every(s => typeof s.id === 'string' && typeof s.title === 'string' && typeof s.createdAt === 'string' && Number.isFinite(Date.parse(s.createdAt)) && Array.isArray(s.messages) &&
      s.messages.every(m => typeof m.id === 'string' && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' &&
        typeof m.createdAt === 'string' && Number.isFinite(Date.parse(m.createdAt)) && ['complete', 'pending', 'failed', 'cancelled'].includes(m.state) &&
        (m.attachmentIds === undefined || Array.isArray(m.attachmentIds) && m.attachmentIds.length <= 4 && m.attachmentIds.every(id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id)))));
}

export class SessionStore {
  constructor(directory, cipher, { legacyDirectory, importLatestLegacy = false } = {}) { this.directory = directory; this.storage = new SecureFile(directory, 'history', cipher, legacyDirectory ? join(legacyDirectory, 'history.json') : undefined, { preferLegacy: importLatestLegacy }); this.file = this.storage.file; }
  async load() {
    this.notice = '';
    try {
      this.db = JSON.parse(await this.storage.read());
      if (!validDatabase(this.db)) throw new Error('Invalid history format');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const session = freshSession(); this.db = { version: 1, activeId: session.id, sessions: [session] };
    }
    for (const session of this.db.sessions) {
      for (const message of session.messages) if (message.state === 'pending') message.state = 'cancelled';
    }
    await this.save(); return this.db;
  }
  save() {
    const json = JSON.stringify(this.db, null, 2) + '\n';
    return this.storage.write(json);
  }
  get active() { return this.db.sessions.find(s => s.id === this.db.activeId); }
  async create() {
    const session = freshSession(); this.db.sessions.unshift(session); this.db.activeId = session.id;
    await this.save(); return session;
  }
  async select(id) {
    if (!this.db.sessions.some(s => s.id === id)) throw new Error('Gespräch nicht gefunden.');
    this.db.activeId = id; await this.save();
  }
}

// Keep complete rounds together; preserve full history on disk. Budget is a
// conservative byte cap, not a tokenizer. The newest input is always included.
export function selectContext(messages, newText, maxBytes = 5000, latestParts = {}) {
  const latest = { role: 'user', content: newText, ...latestParts };
  const textBytes = list => Buffer.byteLength(JSON.stringify(list.map(({role,content}) => ({role,content}))));
  if (textBytes([latest]) > maxBytes) throw new Error('Nachricht und Dateien sind zu lang für das Kontextfenster. Bitte aufteilen oder das Kontextfenster vergrößern.');
  const completed = messages.filter(m => m.state === 'complete');
  const pairs = [];
  for (let i = 0; i < completed.length; i++) {
    if (completed[i].role === 'user' && completed[i + 1]?.role === 'assistant') {
      pairs.push(completed.slice(i, i + 2).map(({ role, content, images }) => ({ role, content, ...(images?.length ? { images } : {}) }))); i++;
    }
  }
  let selected = [latest]; let used = 0;
  for (let i = pairs.length - 1; i >= 0; i--) {
    const candidate = [...pairs[i], ...selected];
    if (textBytes(candidate) > maxBytes || candidate.reduce((n,m) => n + (m.images?.length ?? 0), 0) > 4) break;
    selected = candidate; used++;
  }
  return { messages: selected, omittedRounds: pairs.length - used };
}
