import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SecureFile } from './secure-file.mjs';
import { normalizeOrigin, secureHeaders, httpError } from './connection-security.mjs';
import { imageModels } from './image-client.mjs';
import { openaiModels, readServerJson } from './openai-client.mjs';
import { inspectComfyUI } from './comfyui-client.mjs';
import { githubSource, repositoryUrl } from './update-source.mjs';
export { normalizeOrigin } from './connection-security.mjs';

export function validateProfile(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || raw.id.length > 100) throw new Error('Ungültige Verbindung.');
  if (raw.type !== undefined && !['ollama', 'openai-chat', 'image-api', 'comfyui'].includes(raw.type)) throw new Error('Diese Verbindungsart ist noch nicht verfügbar.');
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
    ...(raw.type === 'comfyui' ? { serverInfo: { modelFiles: Array.isArray(raw.serverInfo?.modelFiles) ? raw.serverInfo.modelFiles.filter(f => typeof f === 'string' && f.length <= 200 && !/[\x00-\x1f]/.test(f)).slice(0, 100) : [], ggufAvailable: raw.serverInfo?.ggufAvailable === true, nodeCount: Number.isInteger(raw.serverInfo?.nodeCount) ? raw.serverInfo.nodeCount : 0 } } : {}),
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
  const excludedModels = raw.excludedModels ?? [];
  if (!Array.isArray(excludedModels) || excludedModels.length > 500 || excludedModels.some(p => !['ollama', 'openai-chat', 'image-api', 'comfyui'].includes(p?.type) || typeof p.model !== 'string' || !p.model || p.model.length > 200 || /\s|[\x00-\x1f]/.test(p.model))) throw new Error('Ungültige Liste entfernter Modelle.');
  const updateRepository = raw.updateRepository == null ? null : repositoryUrl(githubSource(raw.updateRepository));
  return { version: 1, activeId: raw.activeId, profiles, updateRepository, excludedModels: excludedModels.map(p => ({ baseUrl: normalizeOrigin(p.baseUrl), type: p.type, model: p.model })) };
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
    next.excludedModels = next.excludedModels.filter(p => !(p.baseUrl === profile.baseUrl && p.type === profile.type && p.model === profile.model));
    return this.commit(next);
  }
  async setUpdateRepository(url) {
    return this.commit({ ...this.snapshot(), updateRepository: repositoryUrl(githubSource(url)) });
  }
  async importServer({ name, baseUrl, allowHttp, models, authRef, authType, type = 'ollama', restoreRemoved = false }) {
    if (typeof name !== 'string' || !name.trim() || name.length > 30) throw new Error('Servername muss zwischen 1 und 30 Zeichen lang sein.');
    const origin = normalizeOrigin(baseUrl); const next = this.snapshot();
    if (!Array.isArray(models) || !models.length) throw new Error('Der Server hat noch keine Modelle.');
    for (const info of models) {
      const modelType = info.type ?? type;
      const sameModel = p => p.baseUrl === origin && p.model === info.name && p.type === modelType;
      if (!restoreRemoved && next.excludedModels.some(sameModel)) continue;
      if (restoreRemoved) next.excludedModels = next.excludedModels.filter(p => !sameModel(p));
      const existing = next.profiles.find(sameModel);
      const reportedLimit = Number.isInteger(info.contextLimit) && info.contextLimit > 0 ? info.contextLimit : null;
      const chatCapable = !info.capabilities?.includes('embedding') || info.capabilities.includes('completion');
      const modelProfile = validateProfile({
        ...existing, id: existing?.id ?? randomUUID(), name: existing?.name ?? `${name.trim()} · ${info.name}`.slice(0, 60),
        type: modelType, baseUrl: origin, model: info.name, enabled: chatCapable && (existing?.enabled ?? false), allowHttp, authRef, authType,
        capabilities: info.detailsAvailable === false ? existing?.capabilities ?? [] : info.capabilities, contextLimit: reportedLimit ?? existing?.contextLimit, serverInfo: info.serverInfo ?? existing?.serverInfo,
        options: { ...(existing?.options ?? { num_ctx: 8192, num_predict: 2048, temperature: 0.7 }), num_ctx: Math.min(existing?.options?.num_ctx ?? 8192, reportedLimit ?? existing?.contextLimit ?? 32768) },
      });
      if (existing) next.profiles[next.profiles.indexOf(existing)] = modelProfile; else next.profiles.push(modelProfile);
      if (!modelProfile.enabled && next.activeId === modelProfile.id) next.activeId = null;
    }
    return this.commit(next);
  }
  async remove(id, wholeServer = false) {
    const profile = this.db.profiles.find(p => p.id === id);
    if (!profile || typeof wholeServer !== 'boolean') throw new Error('Verbindung nicht gefunden.');
    const next = this.snapshot();
    const removed = next.profiles.filter(p => wholeServer ? p.baseUrl === profile.baseUrl : p.id === id);
    const ids = new Set(removed.map(p => p.id));
    next.profiles = next.profiles.filter(p => !ids.has(p.id));
    if (ids.has(next.activeId)) next.activeId = null;
    for (const p of removed) if (!next.excludedModels.some(e => e.baseUrl === p.baseUrl && e.type === p.type && e.model === p.model)) next.excludedModels.push({ baseUrl: p.baseUrl, type: p.type, model: p.model });
    await this.commit(next); return removed;
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
  if (profile.type === 'comfyui') return (await inspectComfyUI({ ...profile, baseUrl }, auth)).map(m => m.name);
  if (profile.type === 'image-api') return imageModels({ ...profile, baseUrl }, auth);
  if (profile.type === 'openai-chat') return (await openaiModels({ ...profile, baseUrl }, auth, signal)).map(m => m.name);
  if (profile.type === 'auto') return (await inspectServer({ ...profile, baseUrl }, auth)).map(m => m.name);
  const origin = normalizeOrigin(baseUrl); const headers = secureHeaders({ ...profile, baseUrl: origin }, auth);
  const combined = AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]);
  let response;
  try { response = await fetch(`${origin}/api/tags`, { headers, signal: combined, redirect: 'error' }); }
  catch { throw new Error('Der Ollama-Server ist nicht erreichbar. Adresse, VPN und gültiges TLS-Zertifikat prüfen.'); }
  if (!response.ok) { await response.body?.cancel(); const error = new Error(httpError(response.status)); error.status = response.status; throw error; }
  let data;
  try { data = await readServerJson(response); } catch { throw new Error('Ollama liefert keine gültige Modellliste.'); }
  if (!Array.isArray(data.models) || data.models.length > 100) throw new Error('Ollama liefert keine gültige Modellliste oder mehr als 100 Modelle.');
  return [...new Set(data.models.map(m => m?.name ?? m?.model).filter(name => typeof name === 'string' && name.length <= 200 && !/\s|[\x00-\x1f]/.test(name)))].sort();
}
export async function inspectServer(profile, auth) {
  if (!['auto', 'ollama', 'openai-chat', 'image-api', 'comfyui', undefined].includes(profile.type)) throw new Error('Unbekannte Verbindungsart.');
  secureHeaders(profile, auth);
  if (profile.type === 'comfyui') return inspectComfyUI(profile, auth);
  if (profile.type === 'image-api') return (await imageModels(profile, auth)).map(name => ({ name, capabilities: ['image-generation', 'image-edit'], contextLimit: null }));
  if (profile.type === 'openai-chat') return openaiModels(profile, auth);
  if (profile.type === 'auto') {
    let native = []; let nativeError; let compatible = []; let compatibleError;
    try { native = await inspectServer({ ...profile, type: 'ollama' }, auth); }
    catch (error) { if ([401, 403].includes(error.status)) throw error; nativeError = error; }
    try { compatible = await openaiModels(profile, auth, undefined, { optional: true }) ?? []; }
    catch (error) { if ([401, 403].includes(error.status)) throw error; compatibleError = error; }
    if (nativeError && compatibleError) throw new Error('Keine unterstützte Modellliste erreichbar. Serveradresse, API, VPN und Zugang prüfen.');
    if (nativeError && !compatible.length) throw nativeError;
    const names = new Set(native.map(m => m.name));
    return [...native.map(m => ({ ...m, type: 'ollama' })), ...compatible.filter(m => !names.has(m.name))];
  }
  const names = await discoverModels(profile.baseUrl, { profile, auth });
  const headers = secureHeaders(profile, auth); const models = [];
  const deadline = AbortSignal.timeout(20000);
  for (let index = 0; index < names.length; index += 4) {
    const batch = await Promise.all(names.slice(index, index + 4).map(async name => {
    try {
      const response = await fetch(`${normalizeOrigin(profile.baseUrl)}/api/show`, { method: 'POST', headers, body: JSON.stringify({ model: name }), signal: AbortSignal.any([deadline, AbortSignal.timeout(10000)]), redirect: 'error' });
      if (!response.ok) { await response.body?.cancel(); return { name, capabilities: [], contextLimit: null, detailsAvailable: false }; }
      const info = await readServerJson(response);
      const limits = Object.entries(info.model_info ?? {}).filter(([key, value]) => key.endsWith('.context_length') && Number.isInteger(value) && value > 0).map(([,value]) => value);
      return { name, capabilities: Array.isArray(info.capabilities) ? info.capabilities.filter(x => typeof x === 'string').slice(0, 15) : [], contextLimit: limits.length ? Math.min(...limits) : null, detailsAvailable: true };
    } catch { return { name, capabilities: [], contextLimit: null, detailsAvailable: false }; }
    })); models.push(...batch);
  }
  return models;
}
