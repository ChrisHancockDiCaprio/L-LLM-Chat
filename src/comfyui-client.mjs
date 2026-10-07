import { delayedAnswer, unknownOutcome } from './generation-transport.mjs';
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


function comfyRequest(profile, auth, signal) {
  const headers = secureHeaders(profile, auth); const origin = normalizeOrigin(profile.baseUrl);
  return async (path, init = {}) => {
    signal?.throwIfAborted();
    const response = await fetch(origin + path, { ...init, headers, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(httpError(response.status)); }
    return response;
  };
}
function jobId(job) { if (!job?.serverId || !/^[A-Za-z0-9_-]{1,100}$/.test(job.serverId)) throw Error('Server-Auftrags-ID fehlt. Ein neuer Auftrag wird nicht gesendet.'); return job.serverId; }
export async function queryComfyJob(job, {profile,auth,signal} = {}) {
  const id=jobId(job);const request=comfyRequest(profile,auth,signal);
  const history=await readServerJson(await request('/history/'+encodeURIComponent(id)),4*1024*1024); const result=history?.[id];
  if(result) {
    const messages=result.status?.messages ?? [];
    if(messages.some(m=>m?.[0]==='execution_interrupted')) return {state:'cancelled',detail:'Serverseitiger Abbruch bestätigt.'};
    if(result.status?.status_str==='error' || messages.some(m=>m?.[0]==='execution_error')) return {state:'failed',detail:'ComfyUI meldet einen fehlgeschlagenen Auftrag.'};
    if(result.status?.completed===true || result.status?.status_str==='success') return {state:'completed',detail:'Ergebnis in der Serverhistorie vorhanden.',result};
  }
  const queue=await readServerJson(await request('/queue'),4*1024*1024);
  if(!Array.isArray(queue.queue_running) || !Array.isArray(queue.queue_pending)) throw Error('ComfyUI liefert keine verlässliche Auftragswarteschlange.');
  for(const [key,state] of [['queue_running','running'],['queue_pending','queued']]) {
    const item=queue[key].find(x=>Array.isArray(x)&&x[1]===id);
    if(item) {
      if(job.clientId && item[3]?.client_id && item[3].client_id!==job.clientId) return {state:'unknown',detail:'Die Server-ID gehört nicht zum erwarteten KAIROS-Client.'};
      return {state,detail:state==='running'?'ComfyUI meldet diesen Auftrag als laufend.':'Dieser Auftrag wartet in der ComfyUI-Warteschlange.'};
    }
  }
  // Close the queue/history completion race with a second history read.
  const finalHistory=await readServerJson(await request('/history/'+encodeURIComponent(id)),4*1024*1024);
  const final=finalHistory?.[id];
  if(final) {
    if(final.status?.messages?.some(m=>m?.[0]==='execution_interrupted'))return {state:'cancelled',detail:'Serverseitiger Abbruch bestätigt.'};
    if(final.status?.status_str==='error')return {state:'failed',detail:'ComfyUI meldet einen fehlgeschlagenen Auftrag.'};
    if(final.status?.completed || final.status?.status_str==='success')return {state:'completed',detail:'Ergebnis vorhanden.',result:final};
  }
  return {state:result?'unknown':'missing',detail:result?'Der Server meldet keinen eindeutigen Abschlussstatus.':'Auftrag weder in Queue noch History auffindbar. Historie kann gelöscht oder abgelaufen sein.'};
}
export async function fetchComfyResult(job, result, {profile,auth,signal} = {}) {
  const images=result?.outputs?.[job.outputNode]?.images;
  if(!Array.isArray(images)||!images.length||images.length>4)throw Error('Der gespeicherte Ausgabe-Node liefert kein gültiges Bildergebnis (maximal vier Bilder).');
  const request=comfyRequest(profile,auth,signal);const attachments=[];
  for(const image of images) {
    const query=outputQuery(image);const bytes=await readImage(await request('/view?'+query));
    attachments.push(imageAttachment(bytes.toString('base64'),image.filename));
  }
  return {images:attachments,seed:job.seed};
}
export async function cancelComfyJob(job, options) {
  // Running /interrupt is intentionally unavailable without an audited, atomic
  // job-scoped interrupt contract. Old ComfyUI versions interrupt globally.
  const before=await queryComfyJob(job,options);
  if(before.state!=='queued')return {...before,confirmed:false,detail:before.state==='running'?'Kein verifizierter auftragsspezifischer Abbruch für laufende Berechnungen. Nicht mehr warten bleibt möglich.':before.detail};
  const request=comfyRequest(options.profile,options.auth,options.signal);
  await request('/queue',{method:'POST',body:JSON.stringify({delete:[jobId(job)]})});
  const after=await queryComfyJob(job,options);
  if(after.state==='missing')return {state:'cancelled',confirmed:true,detail:'Eigener wartender Auftrag gezielt gelöscht; Queue und History bestätigen, dass er nicht mehr vorhanden ist.'};
  return {...after,confirmed:after.state==='cancelled',detail:after.detail};
}
export async function generateComfyImages(prompt, {profile,auth,entry,options,signal,onProgress=()=>{},onAccepted=async()=>{},onSlow=()=>{},pollInterval=1000,clientId=randomUUID()} = {}) {
  if(profile?.type!=='comfyui'||!profile.enabled)throw Error('Bitte das ComfyUI-Bild-Backend aktivieren.');
  const prepared=prepareComfyWorkflow(entry,prompt,options);const request=comfyRequest(profile,auth,signal);
  const clearSlow=delayedAnswer(()=>onSlow('Die Antwort dauert länger als erwartet. Der ComfyUI-Auftragsstatus wird weiter geprüft.'));
  try {
    onProgress({state:'submitting',message:'Bild-Workflow wird an ComfyUI gesendet …'});
    const queued=await readServerJson(await request('/prompt',{method:'POST',body:JSON.stringify({prompt:prepared.nodes,client_id:clientId})}));
    if(typeof queued.prompt_id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(queued.prompt_id)||Object.keys(queued.node_errors??{}).length)throw Error('ComfyUI hat den Workflow nicht angenommen.');
    const job={serverId:queued.prompt_id,clientId,outputNode:prepared.mapping.outputNode,seed:prepared.options.seed};
    await onAccepted(job);
    onProgress({state:'queued',message:'ComfyUI hat den Auftrag angenommen. Queue und History werden geprüft …'});
    while(true) {
      signal?.throwIfAborted();const status=await queryComfyJob(job,{profile,auth,signal});
      if(status.state==='completed') {onProgress({state:'receiving',message:'ComfyUI-Bilder werden geladen und verschlüsselt gespeichert …'});return await fetchComfyResult(job,status.result,{profile,auth,signal});}
      onProgress({state:status.state,message:status.detail});
      if(['failed','cancelled','missing'].includes(status.state)){const error=Error(status.detail);error.jobState=status.state;throw error;}
      await pause(pollInterval,undefined,{signal});
    }
  }catch(error) {
    if(signal?.aborted)throw Error('Nicht mehr gewartet. '+unknownOutcome);
    if(error.jobState)throw error;
    throw Error(error.message+' '+unknownOutcome);
  }finally{clearSlow();}
}
