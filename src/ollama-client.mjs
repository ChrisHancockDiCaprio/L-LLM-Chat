import { generationFetch, delayedAnswer, unknownOutcome } from './generation-transport.mjs';
import { createOllamaRequest } from './ollama-request.mjs';
import { normalizeOrigin } from './settings-store.mjs';
import { secureHeaders, httpError } from './connection-security.mjs';

// Codex-owned transport. The separate request builder is the Qwen contribution.
export async function sendChat(messages, { signal, profile, auth, onSlow } = {}) {
  if (!profile || !profile.enabled || profile.type !== 'ollama') throw new Error('Diese KI ist nicht aktiviert.');
  const baseUrl = normalizeOrigin(profile.baseUrl);
  const model = profile.model;
  if (typeof model !== 'string' || !model.trim() || model.length > 200 || /\s/.test(model)) throw new Error('Ungültiger Modellname.');
  const body = createOllamaRequest(messages);
  if (body.messages.some(m => m.images?.length) && !profile.capabilities?.includes('vision')) throw new Error('Das ausgewählte Modell unterstützt keine Bildeingaben.');
  body.model = model;
  const headers = secureHeaders(profile, auth);
  const combined = signal ?? new AbortController().signal; const clearSlow = delayedAnswer(onSlow);
  try {
    const response = await generationFetch(`${baseUrl}/api/chat`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...body, options: profile.options ?? { num_ctx: 8192, num_predict: 2048, temperature: 0.7 } }), signal: combined, redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(httpError(response.status));
    }
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (combined.aborted) throw error;
      throw new Error('Ollama liefert kein gültiges JSON.', { cause: error });
    }
    if (data?.done !== true) throw new Error('Die Antwort der KI ist unvollständig.');
    if (data.done_reason === 'length') throw new Error('Die Antwort wurde am Ausgabelimit abgeschnitten.');
    if (typeof data.message?.content !== 'string' || !data.message.content.trim()) {
      throw new Error('Die KI liefert keinen gültigen Antworttext.');
    }
    return data.message.content;
  } catch (error) {
    if (signal?.aborted) throw new Error('Nicht mehr gewartet. ' + unknownOutcome);
    if (error instanceof TypeError) throw new Error('Ollama ist nicht erreichbar. Bitte die Verbindung prüfen. ' + unknownOutcome, { cause: error });
    throw new Error(error.message + ' ' + unknownOutcome);
  } finally { clearSlow(); }
}
