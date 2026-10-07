import { normalizeOrigin, secureHeaders, httpError } from './connection-security.mjs';
import { imageAttachment, MAX_IMAGE_BYTES } from './attachments.mjs';

async function jsonBounded(response, max = 24 * 1024 * 1024) {
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; total += value.byteLength; if (total > max) throw new Error('Die Bildantwort ist zu groß.'); chunks.push(Buffer.from(value)); } }
  finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Der Bildserver liefert kein gültiges JSON.'); }
}
export async function imageModels(profile, auth) {
  const response = await fetch(`${normalizeOrigin(profile.baseUrl)}/v1/models`, { headers: secureHeaders(profile, auth), signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) { await response.body?.cancel(); throw new Error(httpError(response.status)); }
  const data = await jsonBounded(response, 256 * 1024);
  if (!Array.isArray(data.data) || data.data.length > 100) throw new Error('Ungültige Modellliste des Bildservers.');
  return [...new Set(data.data.map(m => m.id).filter(x => typeof x === 'string' && x && x.length <= 200 && !/\s/.test(x)))];
}
export async function generateImage(prompt, { profile, auth, signal, references = [] } = {}) {
  if (!profile?.enabled || profile.type !== 'image-api') throw new Error('Bitte einen Bildgenerator aktivieren.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw new Error('Bitte eine Bildbeschreibung bis 4000 Zeichen eingeben.');
  if (references.length > 4 || references.some(a => a.kind !== 'image')) throw new Error('Der Bildgenerator unterstützt bis zu vier Bilder, keine Textdateien.');
  const headers = secureHeaders(profile, auth); const baseUrl = normalizeOrigin(profile.baseUrl);
  let body;
  if (references.length) {
    body = new FormData(); body.set('model', profile.model); body.set('prompt', prompt); body.set('n', '1'); body.set('size', '1024x1024');
    body.set('response_format', 'b64_json');
    for (const a of references) body.append('image[]', new Blob([Buffer.from(a.base64, 'base64')], { type: a.mime }), a.name);
    delete headers['Content-Type'];
  } else body = JSON.stringify({ model: profile.model, prompt, n: 1, size: '1024x1024', response_format: 'b64_json' });
  const deadline = AbortSignal.timeout(600000); const combined = signal ? AbortSignal.any([deadline, signal]) : deadline;
  try {
    const response = await fetch(`${baseUrl}/v1/images/${references.length ? 'edits' : 'generations'}`, { method: 'POST', headers, body, signal: combined, redirect: 'error' });
    if (!response.ok) { await response.body?.cancel(); throw new Error(httpError(response.status)); }
    const data = await jsonBounded(response);
    if (!Array.isArray(data.data) || data.data.length !== 1 || typeof data.data[0]?.b64_json !== 'string') throw new Error('Der Bildserver muss ein Bild als b64_json zurückgeben. Externe Bild-URLs werden nicht automatisch geöffnet.');
    return imageAttachment(data.data[0].b64_json, 'Generiertes Bild.png');
  } catch (error) {
    if (signal?.aborted) throw new Error('Die Bildanfrage wurde abgebrochen. Die Berechnung auf dem Server kann noch weiterlaufen.');
    if (deadline.aborted) throw new Error('Der Bildserver hat innerhalb von zehn Minuten nicht geantwortet.');
    if (error instanceof TypeError) throw new Error('Der Bildserver ist nicht erreichbar.');
    throw error;
  }
}
