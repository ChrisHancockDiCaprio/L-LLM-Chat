import { app, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
async function render() {
  await app.whenReady();
  const window = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const svg = await readFile(join(root, 'assets/sol-icon.svg'), 'utf8');
  await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="margin:0;overflow:hidden">${svg}</body></html>`));
  await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const master = await window.webContents.capturePage();
  await writeFile(join(root, 'assets/icon.png'), master.resize({ width: 512, height: 512 }).toPNG());
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const frames = sizes.map(size => master.resize({ width: size, height: size }).toPNG());
  const header = Buffer.alloc(6 + 16 * sizes.length); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  frames.forEach((frame, i) => {
    const at = 6 + 16 * i; header[at] = sizes[i] === 256 ? 0 : sizes[i]; header[at + 1] = header[at];
    header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6); header.writeUInt32LE(frame.length, at + 8); header.writeUInt32LE(offset, at + 12); offset += frame.length;
  });
  await writeFile(join(root, 'build/icon.ico'), Buffer.concat([header, ...frames]));
  console.log('SoL icon exported: PNG and seven-size Windows ICO.'); window.destroy(); app.quit();
}
void render().catch(error => { console.error(error); app.exit(1); });
