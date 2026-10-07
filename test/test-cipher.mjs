import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
// Tests only: an ephemeral key never written to disk. Production uses DPAPI.
export function makeTestCipher() {
  const key = randomBytes(32);
  return {
    async encrypt(text) {
      const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
      const payload = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), payload]);
    },
    async decrypt(buffer) {
      const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
      decipher.setAuthTag(buffer.subarray(12, 28));
      return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}
export const testCipher = makeTestCipher();
