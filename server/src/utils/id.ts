import crypto from 'node:crypto';

/** A random, URL-safe id for storage keys and idempotency keys. */
export const createId = () => crypto.randomUUID().replace(/-/g, '');
