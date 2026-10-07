import { join, resolve, isAbsolute } from 'node:path';

// Application identity and data paths are independent of the installation/version.
export const APP_ID = 'sol.qwen-chat';
export function dataPaths({ root, appData, verify = false, verifySuite, releaseTestRoot }) {
  const normalBase = resolve(appData, '../Local/QwenChat');
  if (releaseTestRoot && (!isAbsolute(releaseTestRoot) || resolve(releaseTestRoot).toLowerCase().startsWith(normalBase.toLowerCase()))) throw new Error('Ungültiger Testordner.');
  const base = releaseTestRoot ? resolve(releaseTestRoot) : verify ? resolve(root, verifySuite === 'update' ? '../../work/qwen-chat-update-verification' : '../../work/qwen-chat-security-verification') : normalBase;
  return { dataDir: releaseTestRoot ? join(base, 'Vault') : verify ? base : join(base, 'Vault'), appDataDir: join(base, 'App'), legacyDirectory: releaseTestRoot ? join(base, 'legacy') : verify ? resolve(root, '../../work/qwen-chat-verification') : join(root, 'data') };
}
