import { Agent } from 'undici';
// fetch's own five-minute defaults must also be overridden at dispatch time.
const agent = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
export const generationDispatcher = { dispatch(options, handler) { return agent.dispatch({ ...options, headersTimeout: 0, bodyTimeout: 0 }, handler); } };
export function generationFetch(url, options) { return fetch(url, { ...options, dispatcher: generationDispatcher }); }
export function delayedAnswer(onSlow = () => {}, { milliseconds = 240000, schedule = setTimeout, unschedule = clearTimeout } = {}) {
  const timer = schedule(() => onSlow('Die Antwort dauert länger als erwartet. Der Serverstatus lässt sich nicht prüfen. KAIROS wartet weiter auf die Antwort.'), milliseconds);
  timer.unref?.(); return () => unschedule(timer);
}
export const unknownOutcome = 'Der Server rechnet möglicherweise weiter. Es wird kein neuer Auftrag automatisch gesendet.';
