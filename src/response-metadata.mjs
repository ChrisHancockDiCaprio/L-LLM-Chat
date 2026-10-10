const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER?v:null;
export function responseLimits(response) {
  const count=name=>{const value=response.headers.get(name);return value!==null&&/^\d{1,15}$/.test(value)?amount(Number(value)):null;};
  const retry=response.headers.get('retry-after');let retryAfterSeconds=null;
  if(retry&&/^\d{1,6}$/.test(retry)) retryAfterSeconds=Math.min(Number(retry),86400);
  else if(retry) {const time=Date.parse(retry);if(Number.isFinite(time))retryAfterSeconds=Math.max(0,Math.min(86400,Math.ceil((time-Date.now())/1000)));}
  return {requestsRemaining:count('x-ratelimit-remaining-requests'),tokensRemaining:count('x-ratelimit-remaining-tokens'),retryAfterSeconds,checkedAt:Date.now()};
}
export function responseUsage(data) {
  if(!data || typeof data!=='object') return null;
  const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
  return {promptTokens:count(data.prompt_tokens),completionTokens:count(data.completion_tokens),totalTokens:count(data.total_tokens),reportedCost:amount(data.cost)};
}
