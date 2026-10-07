import { normalizeOrigin, secureHeaders, httpError } from './connection-security.mjs';
import { readServerJson } from './openai-client.mjs';
import { randomUUID, randomInt } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { imageAttachment, MAX_IMAGE_BYTES } from './attachments.mjs';

export const COMFY_BASE_URL = 'http://192.168.0.175:8188';
export const COMFY_FIELDS = ['prompt', 'negativePrompt', 'width', 'height', 'steps', 'seed', 'cfg'];
export const COMFY_DEFAULTS = { negativePrompt: '', width: 1024, height: 1024, steps: 20, seed: -1, cfg: 7 };
export const COMFY_LIMITS = { width: { min: 128, max: 4096, step: 8 }, height: { min: 128, max: 4096, step: 8 }, steps: { min: 1, max: 150, step: 1 }, seed: { min: -1, max: 4294967295, step: 1 }, cfg: { min: 0, max: 100, step: 0.1 } };

export function validateLimits(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Ungültige Parametergrenzen.');
  const result = structuredClone(COMFY_LIMITS);
  for (const field of Object.keys(result)) {
    const limit = { ...result[field], ...raw[field] }; const cap = COMFY_LIMITS[field];
    if (![limit.min, limit.max, limit.step].every(Number.isFinite) || limit.min < cap.min || limit.max > cap.max || limit.min > limit.max || limit.step < cap.step || (field !== 'cfg' && ![limit.min, limit.max, limit.step].every(Number.isInteger))) throw new Error(`Ungültige Grenzen für ${field}.`);
    result[field] = { min: limit.min, max: limit.max, step: limit.step };
  }
  return result;
}

export function comfyEndpoints(profile, clientId, promptId) {
  const origin = normalizeOrigin(profile.baseUrl);
  return { info: `${origin}/object_info`, stats: `${origin}/system_stats`, prompt: `${origin}/prompt`,
    history: promptId ? `${origin}/history/${encodeURIComponent(promptId)}` : `${origin}/history`,
    ws: `${origin.replace(/^http/, 'ws')}/ws${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}` };
}

export async function inspectComfyUI(profile, auth) {
  const headers = secureHeaders(profile, auth); const endpoints = comfyEndpoints(profile);
  const read = async (url, max) => {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) { await response.body?.cancel(); throw new Error(httpError(response.status)); }
    return readServerJson(response, max);
  };
  let stats, info;
  try { stats = await read(endpoints.stats, 256 * 1024); info = await read(endpoints.info, 8 * 1024 * 1024); }
  catch (error) { if (error instanceof TypeError) throw new Error('ComfyUI ist nicht erreichbar. Serveradresse, VPN und TLS prüfen.'); throw error; }
  if (!stats?.system || !info || Array.isArray(info) || typeof info !== 'object' || !Object.keys(info).length) throw new Error('Der Server liefert keine gültige ComfyUI-Schnittstelle.');
  const files = new Set();
  for (const node of Object.values(info)) for (const section of ['required', 'optional']) {
    for (const [key, description] of Object.entries(node?.input?.[section] ?? {})) {
      if (!/(unet|ckpt|checkpoint|model|clip|vae).*name/.test(key) || !Array.isArray(description?.[0])) continue;
      for (const file of description[0]) if (typeof file === 'string' && file.length <= 200 && !/[\x00-\x1f]/.test(file) && files.size < 100) files.add(file);
    }
  }
  return [{ name: 'workflow', type: 'comfyui', capabilities: ['image-generation', 'workflow-required'], contextLimit: null,
    serverInfo: { modelFiles: [...files].sort(), ggufAvailable: Object.keys(info).some(name => /gguf/i.test(name)), nodeCount: Object.keys(info).length } }];
}

export function validateWorkflow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Array.isArray(raw.nodes)) throw new Error('Bitte den Workflow im API-Format exportieren; die normale Editor-Datei genügt nicht.');
  const entries = Object.entries(raw);
  if (!entries.length || entries.length > 300 || Buffer.byteLength(JSON.stringify(raw)) > 2 * 1024 * 1024) throw new Error('Der API-Workflow ist leer oder zu groß.');
  for (const [id, node] of entries) {
    if (!/^\d{1,12}$/.test(id) || !node || typeof node.class_type !== 'string' || !node.class_type || node.class_type.length > 200 || !node.inputs || typeof node.inputs !== 'object' || Array.isArray(node.inputs)) throw new Error('Ungültiger API-Workflow: Knoten mit class_type und inputs erwartet.');
    for (const [key, value] of Object.entries(node.inputs)) if (/^(api[_-]?key|password|authorization|access[_-]?token|bearer[_-]?token)$/i.test(key) && typeof value === 'string' && value.trim()) throw new Error('Zugangsdaten gehören in den separaten Zugangstresor, nicht in Workflow-Nodes.');
  }
  return structuredClone(raw);
}

export function validateImageOptions(raw, mapping, rawLimits) {
  const options = { ...COMFY_DEFAULTS, ...raw };
  if (typeof options.negativePrompt !== 'string' || options.negativePrompt.length > 4000) throw new Error('Negative Prompt darf maximal 4000 Zeichen enthalten.');
  if (mapping && !mapping.negativePrompt && options.negativePrompt.trim()) throw new Error('Für Negative Prompt ist kein Eingang zugeordnet.');
  const limits = validateLimits(rawLimits);
  for (const [field, limit] of Object.entries(limits)) {
    if (mapping && !mapping[field]) continue;
    const value = options[field]; const aligned = (value - (['width','height'].includes(field) ? 0 : limit.min)) / limit.step;
    if (!Number.isFinite(value) || (field !== 'cfg' && !Number.isInteger(value)) || value < limit.min || value > limit.max || Math.abs(aligned - Math.round(aligned)) > 1e-6) throw new Error(`${field}: Wert außerhalb der Profilgrenzen oder des Schrittmaßes.`);
  }
  return Object.fromEntries(Object.keys(COMFY_DEFAULTS).filter(key => !mapping || mapping[key]).map(key => [key, options[key]]));
}

export function validateMapping(nodes, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Bitte die Workflow-Nodes zuordnen.');
  const targets = new Set(); const mapping = {};
  for (const field of COMFY_FIELDS) {
    const target = raw[field];
    if (field !== 'prompt' && target == null) { if (Object.hasOwn(raw, field)) mapping[field] = null; continue; }
    if (!target || typeof target.nodeId !== 'string' || !/^\d{1,12}$/.test(target.nodeId) || !Object.hasOwn(nodes, target.nodeId) || typeof target.input !== 'string' || target.input.length > 100 || ['__proto__','constructor','prototype'].includes(target.input)) throw new Error(`Bitte einen Workflow-Eingang für ${field} wählen.`);
    const node = nodes[target.nodeId];
    if (!node || !Object.hasOwn(node.inputs, target.input) || typeof node.inputs[target.input] !== (['prompt', 'negativePrompt'].includes(field) ? 'string' : 'number')) throw new Error(`Der Eingang für ${field} fehlt oder ist verbunden statt direkt editierbar.`);
    const key = JSON.stringify([target.nodeId, target.input]);
    if (targets.has(key)) throw new Error('Jeder Parameter benötigt einen eigenen Workflow-Eingang.');
    targets.add(key); mapping[field] = { nodeId: target.nodeId, input: target.input };
  }
  if (typeof raw.outputNode !== 'string' || !Object.hasOwn(nodes, raw.outputNode)) throw new Error('Bitte den Ausgabe-Node für gespeicherte Bilder wählen.');
  return { ...mapping, outputNode: raw.outputNode };
}

export function prepareComfyWorkflow(entry, prompt, rawOptions) {
  if (!entry?.nodes) throw new Error('Bitte zuerst einen ComfyUI-API-Workflow importieren.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw new Error('Bitte eine Bildbeschreibung bis 4000 Zeichen eingeben.');
  const nodes = validateWorkflow(entry.nodes); const mapping = validateMapping(nodes, entry.mapping);
  const options = validateImageOptions({ ...entry.options, ...rawOptions }, mapping, entry.limits);
  const seed = options.seed === -1 ? randomInt(0, 4294967296) : options.seed;
  for (const [field, value] of Object.entries({ prompt: prompt.trim(), ...options, seed })) {
    const target = mapping[field]; if (target) nodes[target.nodeId].inputs[target.input] = value;
  }
  return { nodes, mapping, options: { ...options, seed } };
}

async function readImage(response) {
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_IMAGE_BYTES) throw new Error('Das ComfyUI-Bild ist größer als 8 MB.'); chunks.push(Buffer.from(value)); } }
  finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
function outputQuery(image) {
  if (!image || image.type !== 'output' || typeof image.filename !== 'string' || !image.filename || image.filename.length > 200 || /[\\/\x00-\x1f]/.test(image.filename) || /^\.+$/.test(image.filename)) throw new Error('ComfyUI meldet keine gültige gespeicherte Bilddatei.');
  const subfolder = image.subfolder ?? '';
  if (typeof subfolder !== 'string' || subfolder.length > 500 || /[\\\x00-\x1f]/.test(subfolder) || subfolder.startsWith('/') || subfolder.split('/').some(part => part === '..' || part.includes(':'))) throw new Error('ComfyUI meldet einen ungültigen Ausgabeordner.');
  return new URLSearchParams({ filename: image.filename, subfolder, type: 'output' });
}

export async function generateComfyImages(prompt, { profile, auth, entry, options, signal, onProgress = () => {}, pollInterval = 1000 } = {}) {
  if (profile?.type !== 'comfyui' || !profile.enabled) throw new Error('Bitte das ComfyUI-Bild-Backend aktivieren.');
  const prepared = prepareComfyWorkflow(entry, prompt, options);
  const headers = secureHeaders(profile, auth); const origin = normalizeOrigin(profile.baseUrl);
  const deadline = AbortSignal.timeout(20 * 60 * 1000);
  const combined = AbortSignal.any([deadline, ...(signal ? [signal] : [])]);
  async function request(url, init = {}) {
    const response = await fetch(url, { ...init, headers, redirect: 'error', signal: AbortSignal.any([combined, AbortSignal.timeout(30000)]) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(httpError(response.status)); }
    return response;
  }
  try {
    onProgress({ state: 'submitting', message: 'Bild-Workflow wird an ComfyUI gesendet …' });
    const queued = await readServerJson(await request(`${origin}/prompt`, { method: 'POST', body: JSON.stringify({ prompt: prepared.nodes, client_id: randomUUID() }) }));
    if (typeof queued.prompt_id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(queued.prompt_id) || Object.keys(queued.node_errors ?? {}).length) throw new Error('ComfyUI hat den Workflow nicht angenommen. Nodes und Modelldateien prüfen.');
    onProgress({ state: 'queued', message: 'ComfyUI berechnet dein Bild. Warteschlange und Ergebnis werden geprüft …' });
    while (true) {
      combined.throwIfAborted();
      const history = await readServerJson(await request(`${origin}/history/${encodeURIComponent(queued.prompt_id)}`), 2 * 1024 * 1024);
      const result = history?.[queued.prompt_id];
      if (result?.status?.status_str === 'error' || result?.status?.messages?.some(m => ['execution_error', 'execution_interrupted'].includes(m?.[0]))) throw new Error('ComfyUI konnte den Workflow nicht abschließen. Prüfe den Workflow und die Serverkonsole.');
      if (result && (result.status?.completed === true || result.status?.status_str === 'success')) {
        const images = result.outputs?.[prepared.mapping.outputNode]?.images;
        if (!Array.isArray(images) || !images.length) throw new Error('Der gewählte Ausgabe-Node hat kein Bild gespeichert. Bitte einen SaveImage-Ausgabe-Node zuordnen.');
        if (images.length > 4) throw new Error('Der Workflow liefert mehr als vier Bilder. Bitte die Batchgröße reduzieren.');
        onProgress({ state: 'receiving', message: 'ComfyUI-Bilder werden geladen und verschlüsselt gespeichert …' });
        const attachments = [];
        for (const image of images) {
          const query = outputQuery(image);
          const bytes = await readImage(await request(`${origin}/view?${query}`));
          attachments.push(imageAttachment(bytes.toString('base64'), image.filename));
        }
        return { images: attachments, seed: prepared.options.seed };
      }
      await pause(pollInterval, undefined, { signal: combined });
    }
  } catch (error) {
    if (signal?.aborted) throw new Error('Bildanfrage abgebrochen. Der ComfyUI-Auftrag kann auf dem Server weiterlaufen.');
    if (deadline.aborted) throw new Error('ComfyUI hat innerhalb von 20 Minuten kein fertiges Bild geliefert. Der Serverauftrag kann weiterlaufen.');
    if (error instanceof TypeError) throw new Error('ComfyUI ist nicht erreichbar. Serveradresse, VPN und TLS prüfen.');
    if (error.name === 'TimeoutError') throw new Error('ComfyUI antwortet derzeit nicht. Der Serverauftrag kann weiterlaufen.');
    throw error;
  }
}
