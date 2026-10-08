import { secureHeaders, normalizeOrigin, httpError } from './connection-security.mjs';
import { generationFetch } from './generation-transport.mjs';

export const MAX_AUDIO = 16 * 1024 * 1024;
export function ttsConnection(raw) {
  const profile = { baseUrl: normalizeOrigin(raw?.baseUrl), allowHttp: raw?.allowHttp === true };
  secureHeaders(profile); return profile;
}
export async function boundedBody(response, limit) {
  const reader = response.body.getReader(); const parts = []; let size = 0;
  try {
    for (;;) { const {done,value} = await reader.read(); if(done)break;
      size += value.length; if(size > limit) throw Error('TTS-Antwort ist zu groß.'); parts.push(value);
    }
  } finally { await reader.cancel().catch(()=>{}); }
  return Buffer.concat(parts, size);
}
export async function ttsCapabilities(profile, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(profile.baseUrl + '/v1/tts/capabilities', {
    headers: secureHeaders(profile), redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]),
  });
  if(!response.ok)throw Error(httpError(response.status));
  const raw = JSON.parse((await boundedBody(response, 65536)).toString('utf8'));
  if(raw?.protocol !== 'kairos-qwen-tts-v1' || !Array.isArray(raw.modes) || !raw.modes.length || raw.modes.length > 3) throw Error('Bitte die KAIROS-Qwen-TTS-Serverbrücke verwenden.');
  const seen = new Set();
  const modes = raw.modes.map(m => {
    if(!['custom','design','clone'].includes(m.id) || seen.has(m.id) || typeof m.model !== 'string' || m.model.length > 200)throw Error('Ungültige TTS-Fähigkeiten.');
    seen.add(m.id);
    const strings = value => { if(!Array.isArray(value) || value.length > 100 || value.some(v=>typeof v!=='string'||!v||v.length>100))throw Error('Ungültige TTS-Auswahlliste.');return [...new Set(value)]; };
    const languages = strings(m.languages); const speakers = strings(m.speakers ?? []);
    if(!languages.length || (m.id==='custom' && !speakers.length))throw Error('TTS-Modell meldet keine Sprache oder Stimme.');
    return {id:m.id,model:m.model,languages,speakers,instruction:m.id==='design'||m.id==='custom'&&m.instruction===true};
  });
  return {protocol:raw.protocol,modes};
}
export function ttsRequest(raw, capabilities, reference) {
  const mode = capabilities?.modes.find(m=>m.id===raw?.mode);
  if(!mode)throw Error('TTS-Verbindung zuerst prüfen und einen verfügbaren Modus wählen.');
  const text = typeof raw.text==='string' ? raw.text.trim() : '';
  if(!text || text.length > 4000)throw Error('Sprachtext muss 1–4000 Zeichen enthalten.');
  if(!mode.languages.includes(raw.language))throw Error('Sprache wird vom Modell nicht unterstützt.');
  const request = {mode:mode.id,text,language:raw.language};
  if(mode.id==='custom') { if(!mode.speakers.includes(raw.speaker))throw Error('Stimme wird vom Modell nicht unterstützt.');request.speaker=raw.speaker; }
  if(mode.instruction) {
    if(typeof raw.instruct!=='string'||raw.instruct.length>2000)throw Error('Stimmbeschreibung ist zu lang.');
    request.instruct=raw.instruct.trim();
    if(mode.id==='design'&&!request.instruct)throw Error('Bitte die gewünschte Stimme beschreiben.');
  } else if(raw.instruct?.trim()) throw Error('Dieses Modell unterstützt keine Stil-Anweisung.');
  if(mode.id==='clone') {
    if(!reference)throw Error('Bitte ein Referenz-WAV auswählen.');
    request.ref_audio=reference.base64;
    request.x_vector_only_mode=raw.x_vector_only_mode===true;
    if(!request.x_vector_only_mode) {
      if(typeof raw.ref_text!=='string'||!raw.ref_text.trim()||raw.ref_text.length>4000)throw Error('Das genaue Transkript der Referenz ist erforderlich.');
      request.ref_text=raw.ref_text.trim();
    }
  }
  // Omitted values preserve checkpoint defaults. No fabricated pitch/speed controls.
  if(raw.advanced) {
    const ranges={temperature:[0.01,2],top_p:[0.01,1],top_k:[1,1000],repetition_penalty:[1,2],max_new_tokens:[64,4096]};
    request.do_sample=raw.do_sample===true;
    for(const [key,[min,max]] of Object.entries(ranges)) {
      const value=raw[key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(['top_k','max_new_tokens'].includes(key)&&!Number.isInteger(value)))throw Error('Ungültiger TTS-Parameter: '+key);
      request[key]=value;
    }
  }
  return request;
}
export function validateWav(bytes) {
  if(bytes.length<44||bytes.length>MAX_AUDIO||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Bitte ein gültiges WAV bis 16 MB verwenden.');
  let fmt=false,data=false;
  for(let offset=12;offset+8<=bytes.length;) {
    const size=bytes.readUInt32LE(offset+4);const end=offset+8+size;
    if(end>bytes.length)throw Error('Beschädigtes WAV.');
    const id=bytes.toString('ascii',offset,offset+4);
    if(id==='fmt ') { if(size<16 || ![1,3].includes(bytes.readUInt16LE(offset+8)) || ![1,2].includes(bytes.readUInt16LE(offset+10)) || bytes.readUInt32LE(offset+12)<8000 || bytes.readUInt32LE(offset+12)>96000)throw Error('WAV muss PCM/Float, mono/stereo, 8–96 kHz sein.');fmt=true; }
    if(id==='data'&&size>0)data=true;
    offset=end+(size%2);
  }
  if(!fmt||!data)throw Error('WAV enthält keine Audiodaten.');return bytes;
}
export async function synthesize(profile, request, {signal,fetchImpl=generationFetch}={}) {
  const response=await fetchImpl(profile.baseUrl+'/v1/tts/generate',{method:'POST',headers:secureHeaders(profile),redirect:'error',signal,body:JSON.stringify(request)});
  if(!response.ok)throw Error(httpError(response.status));
  if(!/^audio\/(wav|x-wav)(;|$)/i.test(response.headers.get('content-type')??''))throw Error('TTS-Server hat kein WAV geliefert.');
  return validateWav(await boundedBody(response,MAX_AUDIO));
}
