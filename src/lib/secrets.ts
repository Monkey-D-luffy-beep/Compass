import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The API key is encrypted at rest with AES-256-GCM. The key for that comes from COMPASS_KEY (base64, 32 bytes) or, if
 * unset, from a key file created on first use in the data folder. This protects a copied database file; it does not
 * protect against someone who has the whole machine.
 */
const ALG = 'aes-256-gcm';

export function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function decrypt(blob: string, key: Buffer): string {
  const [v, iv, tag, ct] = blob.split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unreadable secret.');
  const d = createDecipheriv(ALG, key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
}

export function loadKey(dataDir: string, env: string | undefined = process.env.COMPASS_KEY): Buffer {
  if (env) {
    const k = Buffer.from(env, 'base64');
    if (k.length !== 32) throw new Error('COMPASS_KEY must be 32 bytes, base64 encoded.');
    return k;
  }
  // Hosted servers have no disk that survives: a key file made there would vanish and the saved API key become unreadable.
  if (process.env.VERCEL) throw new Error('Set COMPASS_KEY (32 bytes, base64) in the hosting environment.');
  const file = path.join(dataDir, 'secret.key');
  if (existsSync(file)) return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
  mkdirSync(dataDir, { recursive: true });
  const k = randomBytes(32);
  writeFileSync(file, k.toString('base64'), { mode: 0o600 });
  return k;
}
