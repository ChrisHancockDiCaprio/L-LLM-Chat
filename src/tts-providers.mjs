import { DOMParser } from '@xmldom/xmldom';
import { normalizeOrigin, normalizeAuth, secureHeaders } from './connection-security.mjs';
import { ttsConnection, ttsCapabilities, ttsRequest, synthesize, boundedBody, validateWav, MAX_AUDIO } from './tts-client.mjs';
import { generationFetch } from './generation-transport.mjs';

export const PROVIDERS = ['qwen', 'azure-speech', 'azure-foundry'];
export const SPEECH_FORMATS = {
  'riff-24khz-16bit-mono-pcm': ['wav', 'audio/wav'],
  'riff-48khz-16bit-mono-pcm': ['wav', 'audio/wav'],
  'audio-24khz-96kbitrate-mono-mp3': ['mp3', 'audio/mpeg'],
  'audio-48khz-192kbitrate-mono-mp3': ['mp3', 'audio/mpeg'],
  'ogg-24khz-16bit-mono-opus': ['ogg', 'audio/ogg'],
};
export const FOUNDRY_FORMATS = {mp3:['mp3','audio/mpeg'],wav:['wav','audio/wav'],opus:['ogg','audio/ogg'],aac:['aac','audio/aac'],flac:['flac','audio/flac'],pcm:['pcm','application/octet-stream']};
const models = ['tts-1','tts-1-hd','gpt-4o-mini-tts'];
const identifier = (value, label) => {
  if(typeof value !== 'string' || !/^[a-zA-Z0-9_.-]{1,200}$/.test(value))throw Error('Ungültiges '+label+'.');
  return value;
};
export function providerConnection(raw) {
  const provider=raw?.provider??'qwen';
  if(!PROVIDERS.includes(provider))throw Error('Unbekannter TTS-Provider.');
  if(provider==='qwen')return {...ttsConnection(raw),provider};
  const region=raw.region?.trim()??'';
  if(region && !/^[a-z0-9-]{2,40}$/.test(region))throw Error('Ungültige Azure-Region.');
  const baseUrl=normalizeOrigin(raw.baseUrl?.trim() || (provider==='azure-speech'&&region ? `https://${region}.tts.speech.microsoft.com` : ''));
  if(!baseUrl.startsWith('https:'))throw Error('Azure erfordert HTTPS.');
  secureHeaders({baseUrl});
  if(provider==='azure-speech') {
    if(raw.deployment?.trim())throw Error('Dieser Adapter nutzt vorgefertigte Speech-Stimmen; Custom-Voice-Deployments werden nicht unterstützt.');
    return {provider,baseUrl,region};
  }
  if(!models.includes(raw.model))throw Error('Bitte die Modellfamilie des TTS-Deployments wählen.');
  const apiVersion=raw.apiVersion?.trim()||'2025-04-01-preview';
  if(!/^\d{4}-\d{2}-\d{2}(-preview)?$/.test(apiVersion))throw Error('Ungültige Azure-API-Version.');
  return {provider,baseUrl,region,deployment:identifier(raw.deployment?.trim(),'Deployment'),model:raw.model,apiVersion};
}
export function apiKey(value) {return normalizeAuth({type:'bearer',token:value}).token;}
export function publicConnection(connection) {
  if(!connection)return null;
  const {key,...safe}=connection;
  return {...safe,hasKey:Boolean(key)};
}
function headers(c) {
  secureHeaders(c);apiKey(c.key);
  return {'Content-Type':'application/json',[c.provider==='azure-speech'?'Ocp-Apim-Subscription-Key':'api-key']:c.key};
}
export function speechPath(c, action) {
  const resource = !/\.tts\.speech\.(microsoft\.com|azure\.us|azure\.cn)$/.test(new URL(c.baseUrl).hostname);
  return c.baseUrl+(resource?'/tts':'')+'/cognitiveservices/'+(action==='voices'?'voices/list':'v1');
}
export function foundryPath(c) {return `${c.baseUrl}/openai/deployments/${encodeURIComponent(c.deployment)}/audio/speech?api-version=${encodeURIComponent(c.apiVersion)}`;}
function azureError(status) {
  const errors={400:'Eingabe oder Parameter ungültig. SSML und Deployment-Modell prüfen.',401:'API-Key oder Azure-Ressource/Region stimmt nicht.',403:'Azure-Zugriff verboten. Berechtigungen und Netzwerkfreigabe prüfen.',404:'Endpoint, Deployment oder API-Version nicht gefunden.',429:'Azure-Kontingent oder Kapazität erreicht. Später erneut versuchen.'};
  return Error(`Azure HTTP ${status}: ${errors[status]??'Dienstfehler. Später erneut versuchen.'}`);
}
async function checkedFetch(url,init,fetchImpl) {
  let response;
  try {response=await fetchImpl(url,{...init,redirect:'error'});}catch(error) {
    if(init.signal?.aborted)throw error;
    throw Error('TTS-Dienst nicht erreichbar. Endpoint, Netzwerk und TLS-Zertifikat prüfen.');
  }
  if(!response.ok){await response.body?.cancel();throw azureError(response.status);}
  return response;
}
const strings=(values=[])=>{
  if(!Array.isArray(values)||values.length>1000||values.some(s=>typeof s!=='string'||s.length>200||!s||/[\x00-\x1f]/.test(s)))throw Error('Ungültige Azure-Stimmenliste.');
  return [...new Set(values)];
};
export function speechVoice(v) {
  if(!v || typeof v.ShortName!=='string'||!v.ShortName||v.ShortName.length>200||!v.Locale)throw Error('Ungültige Azure-Stimme.');
  const hd=/DragonHD/i.test(v.ShortName);const omni=/DragonHDOmni/i.test(v.ShortName);
  // Azure's OpenAI voices exposed through Speech have restricted SSML support.
  const openai=/(Alloy|Echo|Fable|Onyx|Nova|Shimmer)(Multilingual)?Neural$/i.test(v.ShortName);
  const locales=strings([v.Locale,...(v.SecondaryLocaleList??[])]);
  return {id:v.ShortName,name:v.DisplayName||v.ShortName,model:hd?(omni?'Dragon HD Omni':'Dragon HD'):(openai?'OpenAI voices':'Neural'),
    locales,styles:!hd||omni?strings(v.StyleList):[],roles:!hd?strings(v.RolePlayList):[],
    prosody:!hd&&!openai,hd,omni,openai};
}
export async function providerCapabilities(c,{signal,fetchImpl=fetch}={}) {
  if(c.provider==='qwen')return ttsCapabilities(c,{signal,fetchImpl});
  if(c.provider==='azure-foundry')return {provider:c.provider,verified:false,ssml:false,models:[c.model],formats:Object.keys(FOUNDRY_FORMATS),voices:
    ['alloy','echo','fable','onyx','nova','shimmer',...(c.model==='gpt-4o-mini-tts'?['ash','coral','sage']:[])].map(id=>({id,name:id,model:c.model,locales:[],styles:[],roles:[],speed:true,instruction:c.model==='gpt-4o-mini-tts'}))};
  const response=await checkedFetch(speechPath(c,'voices'),{headers:headers(c),signal:AbortSignal.any([AbortSignal.timeout(30000),...(signal?[signal]:[])])},fetchImpl);
  let voices;
  try{voices=JSON.parse((await boundedBody(response,2*1024*1024)).toString('utf8'));}catch{throw Error('Azure liefert keine gültige Stimmenliste.');}
  if(!Array.isArray(voices)||!voices.length||voices.length>5000)throw Error('Azure meldet keine gültigen Stimmen.');
  voices=voices.map(speechVoice);
  return {provider:c.provider,verified:true,ssml:true,voices,models:[...new Set(voices.map(v=>v.model))],formats:Object.keys(SPEECH_FORMATS)};
}
const xml=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
function number(raw,key,min,max,fallback) {
  const value=raw[key]??fallback;
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Ungültiger TTS-Parameter: '+key);
  return value;
}
function optional(raw,key,supported) {if(!supported && raw[key]!==undefined && raw[key]!=='' && raw[key]!==false)throw Error('Die Stimme unterstützt '+key+' nicht.');}
function hdParameters(raw,voice) {
  const values=[];
  for(const [key,min,max] of [['temperature',voice.omni?0.3:0,1],['top_p',0.3,1],['top_k',1,50],['cfg_scale',1,2]]) {
    optional(raw,key,voice.hd&&(key==='temperature'||voice.omni));
    if(raw[key]!==undefined){const value=number(raw,key,min,max);if(key==='top_k'&&!Number.isInteger(value))throw Error('Top K muss ganzzahlig sein.');values.push(`${key}=${value}`);}
  }
  optional(raw,'enhancePronunciation',voice.hd);
  if(raw.enhancePronunciation===true)values.push('enhancePronunciation=true');
  return values.length?` parameters="${values.join(';')}"`:'';
}
export function validateSsml(text,caps) {
  if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>60000)throw Error('SSML muss 1–60000 UTF-8-Bytes enthalten.');
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('SSML darf keine DTD oder Entities deklarieren.');
  let invalid=false;let doc;
  try{doc=new DOMParser({onError:()=>{invalid=true;}}).parseFromString(text,'application/xml');}catch{invalid=true;}
  const root=doc?.documentElement;
  if(invalid||!root||root.localName!=='speak'||root.namespaceURI!=='http://www.w3.org/2001/10/synthesis')throw Error('Ungültiges SSML: vollständiges XML mit speak-Wurzel und SSML-Namespace erforderlich.');
  let count=0,voiceCount=0;
  function walk(element,voice,depth) {
    if(++count>5000||depth>40)throw Error('SSML ist zu komplex.');
    const name=element.localName;
    const extension=element.namespaceURI==='http://www.w3.org/2001/mstts'||element.namespaceURI==='https://www.w3.org/2001/mstts';
    const basic=['speak','voice','p','s','break','prosody','lang','say-as','sub','phoneme','emphasis','bookmark'];
    if(!(extension?['express-as','silence','viseme','audioduration'].includes(name):element.namespaceURI===root.namespaceURI&&basic.includes(name)))throw Error('SSML-Element nicht unterstützt: '+name+'. Externe Audio-/Lexikon-URLs sind gesperrt.');
    if(name==='voice') {
      voice=caps.voices.find(v=>v.id===element.getAttribute('name'));
      if(!voice)throw Error('SSML enthält eine nicht verfügbare Stimme.');voiceCount++;
    }
    if(name!=='speak'&&!voice)throw Error('SSML-Inhalt muss in einer voice stehen.');
    if(voice?.hd && (['prosody','emphasis','bookmark','silence','viseme','audioduration'].includes(name)||!voice.omni&&name==='express-as'||voice.omni&&['break','phoneme'].includes(name)))throw Error('SSML-Element wird von dieser HD-Stimme nicht unterstützt: '+name);
    if(voice?.openai && !['speak','voice','p','s','break'].includes(name))throw Error('SSML-Element wird von dieser OpenAI-Speech-Stimme nicht unterstützt: '+name);
    if(name==='express-as') {
      const style=element.getAttribute('style');const role=element.getAttribute('role');
      if(style&&!voice.styles.includes(style)||role&&!voice.roles.includes(role))throw Error('SSML-Stil oder Rolle wird von der Stimme nicht unterstützt.');
    }
    for(let child=element.firstChild;child;child=child.nextSibling)if(child.nodeType===1)walk(child,voice,depth+1);
  }
  walk(root,null,0);if(!voiceCount)throw Error('SSML muss mindestens eine verfügbare voice enthalten.');
  return text;
}
export function providerRequest(c,raw,caps,reference) {
  if(!caps)throw Error('TTS-Verbindung zuerst laden.');
  if(c.provider==='qwen') {
    if(raw.inputMode==='ssml')throw Error('Qwen unterstützt kein SSML.');
    return {body:ttsRequest(raw,caps,reference),extension:'wav',mime:'audio/wav'};
  }
  const format=raw.format??(c.provider==='azure-speech'?Object.keys(SPEECH_FORMATS)[0]:'mp3');
  const info=(c.provider==='azure-speech'?SPEECH_FORMATS:FOUNDRY_FORMATS)[format];
  if(!info)throw Error('Ungültiges Audioformat.');
  if(c.provider==='azure-speech' && raw.inputMode==='ssml')return {body:validateSsml(raw.text,caps),format,extension:info[0],mime:info[1]};
  if(raw.inputMode && raw.inputMode!=='text')throw Error('Dieser Provider unterstützt nur Text, kein SSML.');
  const voice=caps.voices.find(v=>v.id===raw.speaker&&(!raw.model||v.model===raw.model));
  if(!voice)throw Error('Bitte eine verfügbare Stimme und ihr Modell wählen.');
  const text=typeof raw.text==='string'?raw.text.trim():'';
  if(!text||text.length>4000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw Error('Text muss 1–4000 gültige Zeichen enthalten.');
  if(c.provider==='azure-foundry') {
    for(const key of ['pitch','volume','style','role','language'])optional(raw,key,false);
    optional(raw,'instruct',voice.instruction);
    if(raw.instruct?.length>2000)throw Error('Anweisung zu lang.');
    return {body:{model:c.deployment,input:text,voice:voice.id,response_format:format,speed:number(raw,'speed',0.25,4,1),...(voice.instruction&&raw.instruct?.trim()?{instructions:raw.instruct.trim()}:{})},format,extension:info[0],mime:info[1]};
  }
  if(!voice.locales.includes(raw.language))throw Error('Sprache wird von der Stimme nicht unterstützt.');
  for(const key of ['speed','pitch','volume'])optional(raw,key,voice.prosody);
  if(raw.style&&!voice.styles.includes(raw.style)||raw.role&&!voice.roles.includes(raw.role))throw Error('Stil/Rolle wird von der Stimme nicht unterstützt.');
  if(raw.role&&!raw.style)throw Error('Für eine Rolle zuerst einen Stil wählen.');
  const params=hdParameters(raw,voice);
  let content=xml(text);
  if(voice.prosody)content=`<prosody rate="${number(raw,'speed',0.5,2,1)}" pitch="${number(raw,'pitch',-50,50,0)}%" volume="${number(raw,'volume',0,100,100)}">${content}</prosody>`;
  if(raw.style)content=`<mstts:express-as style="${xml(raw.style)}"${raw.role?` role="${xml(raw.role)}"`:''}${raw.styledegree!==undefined?` styledegree="${number(raw,'styledegree',0.01,2,1)}"`:''}>${content}</mstts:express-as>`;
  return {body:`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${xml(raw.language)}"><voice name="${xml(voice.id)}"${params}>${content}</voice></speak>`,format,extension:info[0],mime:info[1]};
}
export function validateAudio(bytes,extension) {
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_AUDIO)throw Error('Ungültige oder zu große Audioantwort.');
  if(extension==='wav')return validateWav(bytes);
  const magic=bytes.subarray(0,4).toString('ascii');
  if(extension==='mp3' && !(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224) || extension==='ogg'&&magic!=='OggS' || extension==='flac'&&magic!=='fLaC' || extension==='aac'&&!(bytes[0]===255&&(bytes[1]&240)===240))throw Error('TTS-Dienst hat kein gültiges Audio im gewählten Format geliefert.');
  return bytes;
}
export async function providerSynthesize(c,request,{signal,fetchImpl=generationFetch}={}) {
  if(c.provider==='qwen')return synthesize(c,request.body,{signal,fetchImpl});
  const speech=c.provider==='azure-speech';
  const response=await checkedFetch(speech?speechPath(c,'generate'):foundryPath(c),{method:'POST',signal,headers:{...headers(c),...(speech?{'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':request.format,'User-Agent':'KAIROS'}:{})},body:speech?request.body:JSON.stringify(request.body)},fetchImpl);
  if(!/^(audio\/|application\/octet-stream)/i.test(response.headers.get('content-type')??'')){await response.body?.cancel();throw Error('Azure hat keine Audioantwort geliefert.');}
  return validateAudio(await boundedBody(response,MAX_AUDIO),request.extension);
}
export function pythonExample(c) {
  if(!c || c.provider==='qwen')return '# Qwen: siehe QWEN-TTS.md. Kein Python-Code wird in KAIROS ausgeführt.';
  const speech=c.provider==='azure-speech';
  return `# Nur Referenz; KAIROS führt diesen Code nicht aus.\n# pip install requests\nimport os\nfrom pathlib import Path\nimport requests\n\nendpoint = ${JSON.stringify(speech?speechPath(c,'generate'):foundryPath(c))}\nkey = os.environ[${JSON.stringify(speech?'AZURE_SPEECH_KEY':'AZURE_OPENAI_API_KEY')}]\nheaders = {${JSON.stringify(speech?'Ocp-Apim-Subscription-Key':'api-key')}: key}\n${speech?'headers.update({"Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm", "User-Agent": "KAIROS"})\nssml = Path("input.ssml").read_text(encoding="utf-8")\nresponse = requests.post(endpoint, headers=headers, data=ssml.encode("utf-8"), timeout=120, allow_redirects=False)':'payload = {"model": '+JSON.stringify(c.deployment)+', "input": "Hallo!", "voice": "alloy", "response_format": "wav", "speed": 1}\nresponse = requests.post(endpoint, headers=headers, json=payload, timeout=120, allow_redirects=False)'}\nif 300 <= response.status_code < 400:\n    raise RuntimeError("Redirect rejected")\nresponse.raise_for_status()\nPath("speech.wav").write_bytes(response.content)\n`;
}
