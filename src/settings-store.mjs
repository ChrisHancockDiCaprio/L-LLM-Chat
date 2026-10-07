import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SecureFile } from './secure-file.mjs';
import { normalizeOrigin, secureHeaders, httpError } from './connection-security.mjs';
import { imageModels } from './image-client.mjs';
export { normalizeOrigin } from './connection-security.mjs';

export function validateProfile(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || raw.id.length > 100) throw new Error('Ungültige Verbindung.');
  if (raw.type !== undefined && !['ollama', 'image-api'].includes(raw.type)) throw new Error('Diese Verbindungsart ist noch nicht verfügbar.');
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 60) throw new Error('Der Name muss zwischen 1 und 60 Zeichen lang sein.');
  if (typeof raw.model !== 'string' || !raw.model.trim() || raw.model.length > 200 || /\s|[\x00-\x1f]/.test(raw.model.trim())) throw new Error('Bitte einen gültigen Ollama-Modellnamen eingeben.');
  if (typeof raw.enabled !== 'boolean') throw new Error('Aktivierung muss ein Ja/Nein-Wert sein.');
  const options = raw.options ?? { num_ctx: 8192, num_predict: 2048, temperature: 0.7 };
  if (!Number.isInteger(options.num_ctx) || options.num_ctx < 512 || options.num_ctx > 32768 || !Number.isInteger(options.num_predict) || options.num_predict < 128 || options.num_predict > 8192 || !Number.isFinite(options.temperature) || options.temperature < 0 || options.temperature > 2) throw new Error('Ungültige Modelleinstellungen.');
  const contextLimit = Number.isInteger(raw.contextLimit) && raw.contextLimit > 0 ? raw.contextLimit : null;
  if (contextLimit && options.num_ctx > contextLimit) throw new Error('Das Kontextfenster übersteigt die vom Modell gemeldete Grenze.');
  if (raw.allowHttp !== undefined && typeof raw.allowHttp !== 'boolean') throw new Error('Ungültige HTTP-Freigabe.');
  if (raw.authRef != null && (typeof raw.authRef !== 'string' || raw.authRef.length > 100)) throw new Error('Ungültiger Zugang.');
  return {
    id: raw.id, type: raw.type ?? 'ollama', name: raw.name.trim(), baseUrl: normalizeOrigin(raw.baseUrl), model: raw.model.trim(), enabled: raw.enabled,
    allowHttp: raw.allowHttp === true, authRef: raw.authRef ?? null,
    authType: ['basic', 'bearer'].includes(raw.authType) ? raw.authType : 'none',
    options: { num_ctx: options.num_ctx, num_predict: options.num_predict, temperature: options.temperature },
    contextLimit, capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.filter(x => typeof x === 'string' && x.length <= 40).slice(0, 15) : [],
  };
}
function validateSettings(raw) {
  if (raw?.version !== 1 || !Array.isArray(raw.profiles) || raw.profiles.length > 100) throw new Error('Ungültige Einstellungen.');
  const profiles = raw.profiles.map(validateProfile);
  if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error('Verbindungen müssen eindeutige IDs haben.');
  if (raw.activeId !== null && !profiles.some(p => p.id === raw.activeId && p.enabled)) throw new Error('Die ausgewählte KI ist nicht aktiviert.');
  return { version: 1, activeId: raw.activeId, profiles };
}
export class SettingsStore {
  constructor(directory, cipher, { legacyDirectory, legacyHttpAllowed = false } = {}) {
    this.directory = directory; this.storage = new SecureFile(directory, 'settings', cipher, legacyDirectory ? join(legacyDirectory, 'settings.json') : undefined);
    this.file = this.storage.file; this.notice = ''; this.legacyHttpAllowed = legacyHttpAllowed;
  }
  get active() { return this.db.profiles.find(p => p.id === this.db.activeId && p.enabled) ?? null; }
  snapshot() { return structuredClone(this.db); }
  async load() {
    try {
      const raw = JSON.parse(await this.storage.read());
      if (this.legacyHttpAllowed) raw.profiles?.forEach(p => { if (p.allowHttp === undefined) p.allowHttp = true; });
      this.db = validateSettings(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.db = { version: 1, activeId: null, profiles: [] };
    }
    await this.commit(this.db); return this.snapshot();
  }
  async commit(next) {
    const validated = validateSettings(next);
    await this.storage.write(JSON.stringify(validated)); this.db = validated; return this.snapshot();
  }
  async upsert(raw) {
    const next = this.snapshot(); const existing = next.profiles.find(p => p.id === raw?.id);
    if (raw?.id && !existing) throw new Error('Verbindung nicht gefunden.');
    const profile = validateProfile({ ...existing, ...raw, id: raw?.id || randomUUID(), authRef: existing?.authRef ?? null, authType: existing?.authType ?? 'none' });
    if (existing && profile.baseUrl !== existing.baseUrl) { profile.authRef = null; profile.authType = 'none'; profile.capabilities = []; profile.contextLimit = null; }
    const index = next.profiles.findIndex(p => p.id === profile.id);
    if (index >= 0) next.profiles[index] = profile;
    else { if (next.profiles.length >= 100) throw new Error('Maximal 100 Modelle sind möglich.'); next.profiles.push(profile); }
    if (next.activeId === profile.id && !profile.enabled) next.activeId = null;
    return this.commit(next);
  }
  async importServer({ name, baseUrl, allowHttp, models, authRef, authType, type = 'ollama' }) {
    if (typeof name !== 'string' || !name.trim() || name.length > 30) throw new Error('Servername muss zwischen 1 und 30 Zeichen lang sein.');
    const origin = normalizeOrigin(baseUrl); const next = this.snapshot();
    if (!Array.isArray(models) || !models.length) throw new Error('Der Server hat noch keine Modelle.');
    for (const info of models) {
      const existing = next.profiles.find(p => p.baseUrl === origin && p.model === info.name && p.type === type);
      const reportedLimit = Number.isInteger(info.contextLimit) && info.contextLimit > 0 ? info.contextLimit : null;
      const chatCapable = !info.capabilities?.includes('embedding') || info.capabilities.includes('completion');
      const modelProfile = validateProfile({
        ...existing, id: existing?.id ?? randomUUID(), name: existing?.name ?? `${name.trim()} · ${info.name}`.slice(0, 60),
        type, baseUrl: origin, model: info.name, enabled: chatCapable && (existing?.enabled ?? false), allowHttp, authRef, authType,
        capabilities: info.capabilities, contextLimit: reportedLimit,
        options: { ...(existing?.options ?? { num_ctx: 8192, num_predict: 2048, temperature: 0.7 }), num_ctx: Math.min(existing?.options?.num_ctx ?? 8192, reportedLimit ?? 8192) },
      });
      if (existing) next.profiles[next.profiles.indexOf(existing)] = modelProfile; else next.profiles.push(modelProfile);
      if (!modelProfile.enabled && next.activeId === modelProfile.id) next.activeId = null;
    }
    return this.commit(next);
  }
  async toggle(id, enabled) {
    const profile = this.db.profiles.find(p => p.id === id);
    if (!profile || typeof enabled !== 'boolean') throw new Error('Ungültige Aktivierung.');
    if (enabled && profile.capabilities.includes('embedding') && !profile.capabilities.includes('completion')) throw new Error('Dieses Modell ist für Embeddings vorgesehen, nicht für Textchat.');
    return this.upsert({ ...profile, enabled });
  }
  async select(id) {
    if (!this.db.profiles.some(p => p.id === id && p.enabled)) throw new Error('Bitte zuerst diese KI aktivieren.');
    return this.commit({ ...this.snapshot(), activeId: id });
  }
}
export async function discoverModels(baseUrl, { signal, profile = { baseUrl }, auth } = {}) {
  if (profile.type === 'image-api') return imageModels({ ...profile, baseUrl }, auth);
  const origin = normalizeOrigin(baseUrl); const headers = secureHeaders({ ...profile, baseUrl: origin }, auth);
  const combined = AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]);
  let response;
  try { response = await fetch(`${origin}/api/tags`, { headers, signal: combined, redirect: 'error' }); }
  catch { throw new Error('Der Ollama-Server ist nicht erreichbar. Adresse, VPN und gültiges TLS-Zertifikat prüfen.'); }
  if (!response.ok) { await response.body?.cancel(); throw new Error(httpError(response.status)); }
  let data;
  try { data = await response.json(); } catch { throw new Error('Ollama liefert keine gültige Modellliste.'); }
  if (!Array.isArray(data.models) || data.models.length > 100) throw new Error('Ollama liefert keine gültige Modellliste oder mehr als 100 Modelle.');
  return [...new Set(data.models.map(m => m?.name ?? m?.model).filter(name => typeof name === 'string' && name.length <= 200 && !/\s|[\x00-\x1f]/.test(name)))].sort();
}
export async function inspectServer(profile, auth) {
  if (profile.type === 'image-api') return (await imageModels(profile, auth)).map(name => ({ name, capabilities: ['image-generation', 'image-edit'], contextLimit: null }));
  const names = await discoverModels(profile.baseUrl, { profile, auth });
  const headers = secureHeaders(profile, auth); const models = [];
  for (const name of names) {
    try {
      const response = await fetch(`${profile.baseUrl}/api/show`, { method: 'POST', headers, body: JSON.stringify({ model: name }), signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) { await response.body?.cancel(); models.push({ name, capabilities: [], contextLimit: null, detailsAvailable: false }); continue; }
      const info = await response.json();
      const limits = Object.entries(info.model_info ?? {}).filter(([key, value]) => key.endsWith('.context_length') && Number.isInteger(value) && value > 0).map(([,value]) => value);
      models.push({ name, capabilities: Array.isArray(info.capabilities) ? info.capabilities.filter(x => typeof x === 'string').slice(0, 15) : [], contextLimit: limits.length ? Math.min(...limits) : null, detailsAvailable: true });
    } catch { models.push({ name, capabilities: [], contextLimit: null, detailsAvailable: false }); }
  }
  return models;
}
