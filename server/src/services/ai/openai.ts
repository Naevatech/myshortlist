import OpenAI from 'openai';
import { env } from '../../config/env.js';
import type { AiProvider, ChatRequest } from './index.js';

export class OpenAiProvider implements AiProvider {
  name = 'openai';
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async completeJson(req: ChatRequest) {
    const res = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: req.temperature ?? 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    });
    return {
      text: res.choices[0]?.message?.content ?? '{}',
      usage: { input: res.usage?.prompt_tokens, output: res.usage?.completion_tokens },
    };
  }
}
