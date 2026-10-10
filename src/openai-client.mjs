import { generationFetch, delayedAnswer, unknownOutcome } from './generation-transport.mjs';
import { normalizeOrigin, secureHeaders, httpError } from './connection-security.mjs';
import { createOllamaRequest } from './ollama-request.mjs';
import { imageAttachment } from './attachments.mjs';
import {apiUrl} from './api-endpoint.mjs';
import {responseLimits,responseUsage} from './response-metadata.mjs';

export async function readServerJson(response, maximum = 256 * 1024) {
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      total += value.byteLength; if (total > maximum) throw new Error('Die Serverantwort ist zu groß.');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Der Server liefert kein gültiges JSON.'); }
}

export async function openaiModels(profile, auth, signal, { optional = false } = {}) {
  const response = await fetch(apiUrl(profile,'models'), {
    headers: secureHeaders(profile, auth), redirect: 'error',
    signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (optional && [404, 405].includes(response.status)) return null;
    const error = new Error(httpError(response.status)); error.status = response.status; throw error;
  }
  const data = await readServerJson(response,4*1024*1024);
  if (!Array.isArray(data.data) || data.data.length > 3000) throw new Error('Der Server liefert keine gültige Modellliste oder mehr als 3000 Modelle.');
  const models = new Map();
  for (const item of data.data) {
    if (typeof item?.id !== 'string' || !item.id || item.id.length > 200 || /\s|[\x00-\x1f]/.test(item.id)) continue;
    const capabilities = Array.isArray(item.capabilities) ? item.capabilities.filter(c => typeof c === 'string' && c.length <= 40).slice(0, 15) : [];
    if ((item.input_modalities??item.architecture?.input_modalities)?.includes('image') && !capabilities.includes('vision')) capabilities.push('vision');
    models.set(item.id, { name: item.id, type: 'openai-chat', capabilities,
      contextLimit: Number.isInteger(item.context_length) && item.context_length >= 512 ? item.context_length : null });
  }
  return [...models.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function sendOpenaiChat(messages, { profile, auth, signal, onSlow, onHeaders, onMetadata } = {}) {
  if (!profile?.enabled || profile.type !== 'openai-chat') throw new Error('Diese KI ist nicht aktiviert.');
  const validated = createOllamaRequest(messages).messages;
  if (validated.some(m => m.images?.length) && !profile.capabilities?.includes('vision')) throw new Error('Das ausgewählte Modell unterstützt keine Bildeingaben.');
  const wire = validated.map(m => ({ role: m.role, content: !m.images?.length ? m.content : [
    { type: 'text', text: m.content }, ...m.images.map(base64 => {
      const image = imageAttachment(base64, 'Bild');
      return { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } };
    }),
  ] }));
  const combined = signal ?? new AbortController().signal; const clearSlow = delayedAnswer(onSlow);
  try {
    const response = await generationFetch(apiUrl(profile,'chat/completions'), {
      method: 'POST', headers: secureHeaders(profile, auth), redirect: 'error', signal: combined,
      body: JSON.stringify({ model: profile.model, messages: wire, stream: false,
        temperature: profile.options.temperature, max_tokens: profile.options.num_predict }),
    });
    const limits=responseLimits(response);onHeaders?.(limits);
    if (!response.ok) { await response.body?.cancel(); throw new Error(httpError(response.status)+(response.status===429?' Zu viele Anfragen.':response.status===402?' Guthaben oder Schlüssellimit prüfen.':'')+(limits.retryAfterSeconds!==null?' Frühestens in '+limits.retryAfterSeconds+' Sekunden erneut versuchen.':'')); }
    const data = await readServerJson(response, 2 * 1024 * 1024); const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error('Die Antwort wurde am Ausgabelimit abgeschnitten.');
    if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('Der Server liefert keine vollständige Textantwort.');
    onMetadata?.({finishReason:choice.finish_reason,usage:responseUsage(data.usage??data.x_groq?.usage)});
    return choice.message.content;
  } catch (error) {
    if (signal?.aborted) throw new Error('Nicht mehr gewartet. ' + unknownOutcome);
    if (error instanceof TypeError) throw new Error('Der Chatserver ist nicht erreichbar. Adresse, VPN und gültiges TLS-Zertifikat prüfen. ' + unknownOutcome);
    throw new Error(error.message + ' ' + unknownOutcome);
  } finally { clearSlow(); }
}
