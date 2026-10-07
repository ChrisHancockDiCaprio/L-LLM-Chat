import { readServerJson } from './openai-client.mjs';

export function githubSource(value) {
  if (typeof value !== 'string' || value.length > 300) throw new Error('Bitte die GitHub-Adresse des Repositorys eingeben.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Bitte eine vollständige GitHub-Adresse mit https:// eingeben.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('Erlaubt ist eine GitHub-Repository-Adresse über HTTPS, ohne Zugangsdaten oder Zusätze.');
  const match = /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9_.-]{1,100})\/?$/.exec(url.pathname);
  if (!match || match[1].includes('--') || /^\.+$/.test(match[2])) throw new Error('Bitte die Repository-Hauptseite eingeben: https://github.com/Benutzer/Repository.');
  const repo = match[2].replace(/\.git$/, '');
  if (!repo || /^\.+$/.test(repo)) throw new Error('Ungültiger Repository-Name.');
  return { provider: 'github', owner: match[1], repo };
}
export const repositoryUrl = source => `https://github.com/${source.owner}/${source.repo}`;

export async function probeUpdateRepository(value) {
  const source = githubSource(value);
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Die TLS-Prüfung darf für Updates nicht deaktiviert sein.');
  const signal = AbortSignal.timeout(10000);
  const api = `https://api.github.com/repos/${source.owner}/${source.repo}`;
  async function request(url, optional = false) {
    let response;
    try { response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, redirect: 'error', signal }); }
    catch { throw new Error('GitHub ist nicht erreichbar. Internetverbindung und Repository-Adresse prüfen.'); }
    if (!response.ok) {
      await response.body?.cancel();
      if (optional && response.status === 404) return null;
      if (response.status === 404) throw new Error('Das Repository wurde nicht gefunden oder ist nicht öffentlich.');
      if ([403, 429].includes(response.status)) throw new Error('GitHub begrenzt die Anfragen. Bitte später erneut prüfen.');
      throw new Error('Das Repository konnte nicht geprüft werden.');
    }
    return readServerJson(response);
  }
  const repository = await request(api);
  if (repository.private !== false || repository.disabled || typeof repository.full_name !== 'string' || repository.full_name.toLowerCase() !== `${source.owner}/${source.repo}`.toLowerCase()) throw new Error('Kein passendes öffentliches Repository gefunden.');
  const canonical = githubSource(`https://github.com/${repository.full_name}`);
  const release = await request(`${api}/releases/latest`, true);
  if (release && (release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets))) throw new Error('GitHub liefert keine gültige stabile Veröffentlichung.');
  const assets = release?.assets.map(a => a.name) ?? [];
  const ready = assets.includes('latest.yml') && assets.some(name => typeof name === 'string' && name.endsWith('.exe'));
  return { source: canonical, repository: repositoryUrl(canonical), ready, notice: !release ? 'Repository erreichbar. Noch kein stabiles Release veröffentlicht; Entwürfe stehen für Updates nicht bereit.' : ready ? 'Repository erreichbar. Windows-Update-Dateien vorhanden; mit „Auf Updates prüfen“ die Version prüfen.' : 'Repository erreichbar. Im neuesten Release fehlen Windows-Setup oder latest.yml.' };
}
