import { normalizeOrigin, secureHeaders, httpError } from './connection-security.mjs';
import { readServerJson } from './openai-client.mjs';

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
  }
  return structuredClone(raw);
}
