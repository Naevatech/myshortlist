import { Resend } from 'resend';
import { env } from '../../config/env.js';
import type { EmailMessage, EmailProvider } from './index.js';

export class ResendProvider implements EmailProvider {
  private client = new Resend(env.RESEND_API_KEY);

  async send(msg: EmailMessage) {
    const { data, error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      replyTo: msg.replyTo,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error) throw new Error(`Email provider error: ${error.name}`);
    return { id: data?.id, dryRun: false };
  }
}
