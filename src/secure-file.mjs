import { readFile, writeFile, rename, mkdir, unlink, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

// The production cipher is Windows DPAPI through Electron safeStorage.
// No plaintext fallback, no encryption keys in application files.
export class SecureFile {
  constructor(directory, name, cipher, legacyFile, { preferLegacy = false } = {}) {
    if (!cipher?.encrypt || !cipher?.decrypt) throw new Error('Verschlüsselter Speicher ist erforderlich.');
    this.directory = directory; this.file = join(directory, `${name}.vault`);
    this.cipher = cipher; this.legacyFile = legacyFile; this.queue = Promise.resolve(); this.preferLegacy = preferLegacy;
  }
  async write(text) {
    this.queue = this.queue.catch(() => {}).then(async () => {
      const encrypted = await this.cipher.encrypt(text);
      if (await this.cipher.decrypt(encrypted) !== text) throw new Error('Tresorprüfung fehlgeschlagen.');
      await mkdir(this.directory, { recursive: true });
      const temporary = join(this.directory, `${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, encrypted, { flag: 'wx' });
        // Verify the actual disk contents before replacing the existing vault.
        if (await this.cipher.decrypt(await readFile(temporary)) !== text) throw new Error('Tresorprüfung fehlgeschlagen.');
        await rename(temporary, this.file);
      } finally { await unlink(temporary).catch(() => {}); }
    });
    await this.queue;
  }
  async read() {
    let text;
    try { text = await this.cipher.decrypt(await readFile(this.file)); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Der verschlüsselte Tresor konnte nicht geöffnet werden. Er bleibt erhalten.'); }
    if (this.legacyFile) {
      let legacy;
      try { legacy = await readFile(this.legacyFile, 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (legacy !== undefined) {
        if (text === undefined) { await this.write(legacy); text = legacy; }
        else if (text !== legacy) {
          // Preserve a leftover migration source without overwriting newer data.
          const archive = new SecureFile(this.directory, `migration-${randomUUID()}`, this.cipher);
          await archive.write(this.preferLegacy ? text : legacy);
          if (this.preferLegacy) { await this.write(legacy); text = legacy; }
        }
        await unlink(this.legacyFile);
      }
    }
    if (text === undefined) { const error = new Error('Not found'); error.code = 'ENOENT'; throw error; }
    return text;
  }
}

export async function protectLegacyBackups(directory, vaultDirectory, cipher) {
  let names;
  try { names = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const name of names) {
    if (basename(name) !== name || !/^(history|settings)-(unlesbar-.*\.json|.*\.tmp)$/.test(name)) continue;
    const file = join(directory, name);
    const archived = new SecureFile(vaultDirectory, `migration-${randomUUID()}`, cipher);
    await archived.write(await readFile(file, 'utf8'));
    await unlink(file);
  }
}
