import { isIP } from 'node:net';

export function normalizeOrigin(value) {
  if (typeof value !== 'string' || value.length > 300) throw new Error('Bitte eine gültige Serveradresse eingeben.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Die Serveradresse muss mit http:// oder https:// beginnen.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Bitte nur die Serveradresse mit Port angeben, ohne Zugangsdaten oder API-Pfad.');
  return url.origin;
}
export function normalizeAuth(raw = { type: 'none' }) {
  if (!raw || !['none', 'bearer', 'basic'].includes(raw.type)) throw new Error('Ungültige Zugangsart.');
  if (raw.type === 'none') return { type: 'none' };
  const secret = raw.type === 'bearer' ? raw.token : raw.password;
  if (typeof secret !== 'string' || !secret || secret.length > 4096 || /[\x00-\x1f\x7f]/.test(secret)) throw new Error('Bitte einen gültigen Schlüssel oder ein Passwort eingeben.');
  if (raw.type === 'bearer') {
    if (!/^[\x21-\x7e]+$/.test(secret)) throw new Error('API-Schlüssel darf keine Leerzeichen oder Steuerzeichen enthalten.');
    return { type: 'bearer', token: secret };
  }
  if (typeof raw.username !== 'string' || !raw.username || raw.username.length > 200 || /[:\x00-\x1f\x7f]/.test(raw.username)) throw new Error('Bitte einen gültigen Benutzernamen eingeben.');
  return { type: 'basic', username: raw.username, password: secret };
}
function privateAddress(host) {
  if (host === 'localhost' || host === '[::1]') return true;
  if (isIP(host) !== 4) return false;
  const [a, b] = host.split('.').map(Number);
  return a === 10 || a === 127 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
}
export function secureHeaders(profile, rawAuth) {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Die TLS-Zertifikatsprüfung wurde in der Umgebung deaktiviert. Bitte diese Einstellung entfernen.');
  const origin = normalizeOrigin(profile.baseUrl);
  const auth = normalizeAuth(rawAuth);
  const url = new URL(origin);
  if (url.protocol !== 'https:') {
    if (auth.type !== 'none') throw new Error('Zugangsdaten werden ausschließlich über HTTPS übertragen.');
    if (profile.allowHttp !== true || !privateAddress(url.hostname)) throw new Error('HTTPS ist erforderlich. HTTP darf nur ausdrücklich für eine private IP-Adresse im Heimnetz freigegeben werden.');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (auth.type === 'bearer') headers.Authorization = `Bearer ${auth.token}`;
  if (auth.type === 'basic') headers.Authorization = `Basic ${Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64')}`;
  return headers;
}
export function httpError(status) {
  if (status === 401) return 'Zugang abgelehnt (401). Schlüssel oder Benutzername/Passwort prüfen.';
  if (status === 403) return 'Zugang verboten (403). Die Berechtigungen auf dem Server prüfen.';
  return `Der Server antwortet mit HTTP ${status}.`;
}
