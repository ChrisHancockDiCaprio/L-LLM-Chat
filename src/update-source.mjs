import semver from 'semver';
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
  const ready = assets.some(portableAsset);
  return { source: canonical, repository: repositoryUrl(canonical), ready, notice: !release ? 'Repository erreichbar. Noch kein stabiles Release veröffentlicht; Entwürfe stehen für Updates nicht bereit.' : ready ? 'Repository erreichbar. Portable Windows-ZIP vorhanden; mit „Auf Updates prüfen“ die Version prüfen.' : 'Repository erreichbar. Im neuesten Release fehlt eine portable Windows-ZIP.' };
}

const portableAsset=name=>typeof name==='string'&&/^KAIROS-Portable-[A-Za-z0-9.+-]+-x64\.zip$/i.test(name);

// Read public releases rather than infer a channel from the tag's prerelease label.
export async function newerReleases(source, version) {
  const checked = githubSource(repositoryUrl(source));
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('TLS-Prüfung erforderlich.');
  const base = 'https://api.github.com/repos/' + checked.owner + '/' + checked.repo;
  const releases = []; const signal = AbortSignal.timeout(15000);
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(base + '/releases?per_page=100&page=' + page, { headers: { Accept: 'application/vnd.github+json' }, redirect: 'error', signal });
    if (!response.ok) { await response.body?.cancel(); throw new Error('GitHub-Veröffentlichungen konnten nicht gelesen werden.'); }
    const entries = await readServerJson(response, 4 * 1024 * 1024);
    if (!Array.isArray(entries)) throw new Error('Ungültige GitHub-Veröffentlichungen.');
    for (const r of entries) {
      const next = semver.valid(r.tag_name);
      if (r.draft!==false || typeof r.prerelease!=='boolean' || !next || !semver.gt(next, version)) continue;
      const names = (r.assets ?? []).map(a => a.name);
      const channel = names.includes('latest.yml') ? 'latest' : String(semver.prerelease(next)?.[0] ?? 'latest');
      releases.push({ channel, version: next, tag: r.tag_name, prerelease: r.prerelease === true,
        downloadable: names.some(portableAsset),
        url: repositoryUrl(checked) + '/releases/tag/' + encodeURIComponent(r.tag_name) });
    }
    if (entries.length < 100) return releases.sort((a,b) => semver.rcompare(a.version, b.version));
  }
  throw new Error('Zu viele Veröffentlichungen für eine vollständige Prüfung.');
}
