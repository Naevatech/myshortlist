import { env } from '../../config/env.js';
import { LocalStorage } from './local.js';
import { S3Storage } from './s3.js';

/** Private file storage. Nothing here is ever served statically; files are streamed through authorised routes. */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

let instance: Storage | undefined;

export function storage(): Storage {
  instance ??= env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage(env.uploadDir);
  return instance;
}
