import {normalizeOrigin} from './connection-security.mjs';

export const PROVIDERS = Object.freeze({
  groq: Object.freeze({name:'Groq',baseUrl:'https://api.groq.com',apiPath:'/openai/v1'}),
  openrouter: Object.freeze({name:'OpenRouter',baseUrl:'https://openrouter.ai',apiPath:'/api/v1'}),
});
export function normalizeApiPath(value='/v1') {
  if(typeof value!=='string' || value.length>160 || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value)) throw Error('API-Pfad muss aus einfachen Pfadsegmenten bestehen, zum Beispiel /v1. Keine URL, Punkte, Abfrage oder Zugangsdaten.');
  return value;
}
export function endpointFields(raw) {
  if(!['openai-chat','auto'].includes(raw.type)) return {};
  const provider=raw.provider??'custom';
  if(provider!=='custom' && !Object.hasOwn(PROVIDERS,provider)) throw Error('Unbekannter KI-Anbieter.');
  const preset=PROVIDERS[provider];const apiPath=normalizeApiPath(raw.apiPath??preset?.apiPath??'/v1');
  if(preset && (normalizeOrigin(raw.baseUrl)!==preset.baseUrl || apiPath!==preset.apiPath || raw.ssh?.enabled)) throw Error('Dieser Anbieter benötigt seinen offiziellen HTTPS-Anschluss. Für einen eigenen Server bitte „Eigener Anschluss“ wählen.');
  return {provider,apiPath};
}
export function apiUrl(profile,resource) {
  if(!['models','chat/completions','key'].includes(resource)) throw Error('Unbekannte API-Aktion.');
  const fields=endpointFields({...profile,type:'openai-chat'});
  return normalizeOrigin(profile.baseUrl)+fields.apiPath+'/'+resource;
}
// Preserve historical identities for the old generic /v1 connection.
export function endpointScope(profile) {
  const fields=endpointFields(profile);
  return fields.apiPath && (fields.apiPath!=='/v1' || fields.provider!=='custom') ? [fields.provider,fields.apiPath] : null;
}
