import Groq from 'groq-sdk';
import { env } from '../../config/env.js';
import type { AiProvider, ChatRequest } from './index.js';

export class GroqProvider implements AiProvider {
  name = 'groq';
  private client = new Groq({ apiKey: env.GROQ_API_KEY });

  async completeJson(req: ChatRequest) {
    const res = await this.client.chat.completions.create({
      model: env.GROQ_MODEL,
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
