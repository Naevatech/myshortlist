import type { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { GroqProvider } from './groq.js';
import { OpenAiProvider } from './openai.js';

export interface ChatRequest {
  system: string;
  user: string;
  temperature?: number;
}

export interface AiProvider {
  name: string;
  /** Returns the raw JSON text of the model's reply. */
  completeJson(req: ChatRequest): Promise<{ text: string; usage?: { input?: number; output?: number } }>;
}

let instance: AiProvider | null | undefined;

/** The configured AI provider, or null when no key is set (callers then use rule-based fallbacks). */
export function ai(): AiProvider | null {
  if (instance !== undefined) return instance;
  if (env.isTest) return (instance = null);
  const groq = env.GROQ_API_KEY ? new GroqProvider() : null;
  const openai = env.OPENAI_API_KEY ? new OpenAiProvider() : null;
  instance = env.AI_PROVIDER === 'openai' ? (openai ?? groq) : (groq ?? openai);
  if (!instance) logger.warn('No AI key set: using rule-based CV parsing, scoring and templates.');
  return instance;
}

/** Calls the model for JSON, validates it with zod and retries once on invalid output. */
export async function aiJson<S extends z.ZodTypeAny>(
  schema: S,
  req: ChatRequest,
  task: string,
): Promise<z.infer<S> | null> {
  const provider = ai();
  if (!provider) return null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text, usage } = await provider.completeJson(req);
      // Token usage only. Never log prompts or CV text.
      logger.info({ task, provider: provider.name, attempt, usage }, 'ai call');
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      logger.warn({ task, attempt }, 'ai returned JSON that did not match the schema');
    } catch (err) {
      logger.warn({ task, attempt, err: (err as Error).message }, 'ai call failed');
    }
  }
  return null;
}
