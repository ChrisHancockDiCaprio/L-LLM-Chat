import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SecureFile } from './secure-file.mjs';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export function imageMime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new Error('Nur gültige PNG-, JPEG- oder WebP-Bilder sind zulässig.');
}
export function imageAttachment(base64, name = 'Bild.png') {
  if (typeof base64 !== 'string' || !base64 || base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Das Bild ist ungültig oder größer als 8 MB.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== base64) throw new Error('Ungültiges Bildformat.');
  return { id: randomUUID(), kind: 'image', name: basename(name).slice(0, 120), mime: imageMime(bytes), base64, size: bytes.length };
}
const TEXT_EXTENSIONS = new Set(['.txt','.md','.csv','.json','.log','.py','.js','.mjs','.cjs','.ts','.tsx','.jsx','.html','.css','.xml','.yaml','.yml','.toml','.ini','.sql','.c','.cpp','.h','.rs','.go','.java','.ps1']);
export class AttachmentStore {
  constructor(directory, cipher, validateImage = () => {}) { this.directory = directory; this.cipher = cipher; this.validateImage = validateImage; this.items = new Map(); }
  async importFile(filename) {
    const info = await stat(filename);
    if (!info.isFile() || info.size > MAX_IMAGE_BYTES) throw new Error('Bitte eine Datei bis 8 MB auswählen.');
    const bytes = await readFile(filename); const name = basename(filename).slice(0, 120);
    let attachment;
    if (['.png','.jpg','.jpeg','.webp'].includes(extname(filename).toLowerCase())) attachment = imageAttachment(bytes.toString('base64'), name);
    else {
      if (!TEXT_EXTENSIONS.has(extname(filename).toLowerCase())) throw new Error('Dateianhänge unterstützen derzeit Text und Code. PDF, Office und ausführbare Dateien sind noch nicht unterstützt.');
      if (bytes.length > 16 * 1024) throw new Error('Textdateien dürfen bis 16 KB groß sein. Größere Dateien bitte aufteilen.');
      let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Bitte eine Textdatei im UTF-8-Format auswählen.'); }
      if (!text.trim() || text.includes('\0')) throw new Error('Die Textdatei ist leer oder enthält Binärdaten.');
      attachment = { id: randomUUID(), kind: 'text', name, text, size: bytes.length };
    }
    if (attachment.kind === 'image') this.validateImage(attachment);
    this.items.set(attachment.id, attachment); return this.preview(attachment.id);
  }
  preview(id) {
    const item = this.get(id); return { id, kind: item.kind, name: item.name, size: item.size, ...(item.kind === 'image' ? { src: `data:${item.mime};base64,${item.base64}` } : {}) };
  }
  get(id) { const item = this.items.get(id); if (!item) throw new Error('Der Anhang ist nicht verfügbar.'); return item; }
  async persist(ids) { for (const id of ids) await new SecureFile(this.directory, `attachment-${id}`, this.cipher).write(JSON.stringify(this.get(id))); }
  async restore(messages) {
    const ids = new Set(messages.flatMap(m => m.attachmentIds ?? []));
    for (const id of ids) {
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Ungültiger Anhang im Tresor.');
      const item = JSON.parse(await new SecureFile(this.directory, `attachment-${id}`, this.cipher).read());
      if (item.id !== id || !['image','text'].includes(item.kind) || typeof item.name !== 'string') throw new Error('Beschädigter Anhang.');
      if (item.kind === 'image') { if (imageAttachment(item.base64, item.name).mime !== item.mime) throw new Error('Beschädigtes Bildformat.'); this.validateImage(item); }
      else if (typeof item.text !== 'string' || Buffer.byteLength(item.text) > 16384) throw new Error('Beschädigter Textanhang.');
      this.items.set(id, item);
    }
  }
  wireMessage(message, profile) {
    const items = (message.attachmentIds ?? []).map(id => this.get(id));
    const images = items.filter(a => a.kind === 'image');
    const content = message.content + items.filter(a => a.kind === 'text').map(a => `\n\nAngehängte Datei ${JSON.stringify(a.name)}:\n${a.text}`).join('');
    return { role: message.role, content, ...(images.length ? { images: images.map(a => a.base64) } : {}) };
  }
}
