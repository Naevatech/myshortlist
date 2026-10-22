import type { Prisma } from '@prisma/client';

/** Prisma returns Json columns as JsonValue; these narrow with a fallback (and tolerate MariaDB returning text). */
export function asArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const v = JSON.parse(value);
      return Array.isArray(v) ? (v as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function asObject<T>(value: Prisma.JsonValue | null | undefined, fallback: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export const toJson = (v: unknown) => v as Prisma.InputJsonValue;
