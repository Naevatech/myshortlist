import { prisma } from './prisma.js';
import { toJson } from './json.js';

/** Records an action without personal data in the meta. */
export async function audit(userId: string | null, action: string, meta?: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { userId, action, metaJson: meta ? toJson(meta) : undefined } });
}
