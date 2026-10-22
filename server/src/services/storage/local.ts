import fs from 'node:fs/promises';
import path from 'node:path';
import type { Storage } from './index.js';

export class LocalStorage implements Storage {
  constructor(private root: string) {}

  private resolve(key: string): string {
    if (!/^[A-Za-z0-9/_.-]+$/.test(key) || key.includes('..')) throw new Error('Invalid storage key');
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}
