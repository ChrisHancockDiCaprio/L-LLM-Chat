import {apiUrl,endpointFields} from './api-endpoint.mjs';
import {secureHeaders,httpError} from './connection-security.mjs';
import {readServerJson} from './openai-client.mjs';
const amount=v=>typeof v==='number' && Number.isFinite(v) && v>=0 && v<=Number.MAX_SAFE_INTEGER?v:null;
export async function readProviderQuota(profile,auth) {
  endpointFields(profile);
  if(profile.provider!=='openrouter') return {state:'unknown',checkedAt:Date.now(),message:'Keine gesonderte Quotenabfrage für diesen Anschluss. Bitte das Anbieter-Dashboard verwenden.'};
  if(auth?.type!=='bearer') throw Error('Bitte einen eigenen API-Schlüssel für diesen Anschluss hinterlegen.');
  const response=await fetch(apiUrl(profile,'key'),{headers:secureHeaders(profile,auth),redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok){await response.body?.cancel();throw Error(httpError(response.status));}
  const data=(await readServerJson(response,65536)).data;
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('Der Anbieter liefert keine gültige Zugangsauskunft.');
  const daily=data.free_model_daily_requests;
  const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
  return {state:'checked',checkedAt:Date.now(),message:'Eigener Schlüssel geprüft. Modellverfügbarkeit und kostenlose Nutzung sind dadurch nicht bestätigt.',isFreeTier:typeof data.is_free_tier==='boolean'?data.is_free_tier:null,creditLimit:amount(data.limit),creditRemaining:amount(data.limit_remaining),usage:amount(data.usage),usageDaily:amount(data.usage_daily),freeDailyLimit:count(daily?.limit),freeDailyUsed:count(daily?.used),freeDailyRemaining:count(daily?.remaining)};
}
