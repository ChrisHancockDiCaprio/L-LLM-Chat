import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export async function backupVault(directory, cipher, version) {
  const destination = join(directory, 'BeforeUpdate', `${Date.now()}-${randomUUID()}`);
  const staging = destination + '.pending';
  await mkdir(staging, { recursive: true });
  const entries = [];
  const attachments = (await readdir(directory)).filter(name => /^attachment-[a-f0-9-]{36}\.vault$/.test(name));
  for (const name of ['history.vault', 'settings.vault', 'credentials.vault', ...attachments]) {
    const encrypted = await readFile(join(directory, name));
    // All required stores must be readable. A failed backup blocks installation.
    await cipher.decrypt(encrypted);
    await writeFile(join(staging, name), encrypted, { flag: 'wx' });
    const saved = await readFile(join(staging, name));
    if (!saved.equals(encrypted)) throw new Error('Die verschlüsselte Sicherung konnte nicht geprüft werden.');
    entries.push({ name, sha256: createHash('sha256').update(saved).digest('hex') });
  }
  // The backup inventory contains only hashes/version and is encrypted too.
  await writeFile(join(staging, 'inventory.vault'), await cipher.encrypt(JSON.stringify({ version, entries })), { flag: 'wx' });
  await rename(staging, destination); return destination;
}
