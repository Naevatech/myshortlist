import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ResendProvider } from './resend.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<{ id?: string; dryRun: boolean }>;
}

/** Emails "sent" without a provider. Tests read the latest one to get sign-in codes. */
export const outbox: EmailMessage[] = [];

class ConsoleProvider implements EmailProvider {
  async send(msg: EmailMessage) {
    outbox.push(msg);
    if (outbox.length > 50) outbox.shift();
    if (!env.isTest) {
      // Development fallback only: printing the message is how you read sign-in codes without an email key.
      console.log(
        `\n--- Email (not sent: ${env.emailEnabled ? 'test address' : 'RESEND_API_KEY is empty'}) ---\nTo: ${msg.to}\nSubject: ${msg.subject}\n` +
          `${msg.attachments?.length ? `Attachments: ${msg.attachments.map((a) => a.filename).join(', ')}\n` : ''}` +
          `\n${msg.text}\n-------------------------------------------------\n`,
      );
    }
    return { dryRun: true };
  }
}

/** Domains reserved for examples and testing (RFC 2606). Email providers reject them, and they reach nobody. */
export function isReservedAddress(address: string): boolean {
  const domain = address.split('@').pop()?.toLowerCase() ?? '';
  return (
    ['example.com', 'example.net', 'example.org'].includes(domain) ||
    /(^|\.)(example|test|invalid|localhost)$/.test(domain)
  );
}

/** Sends through the real provider, except to reserved test addresses (demo users, placeholder employers). */
class RoutingProvider implements EmailProvider {
  constructor(
    private real: EmailProvider,
    private local: EmailProvider,
  ) {}

  send(msg: EmailMessage) {
    return isReservedAddress(msg.to) ? this.local.send(msg) : this.real.send(msg);
  }
}

let instance: EmailProvider | undefined;

export function email(): EmailProvider {
  if (!instance) {
    const local = new ConsoleProvider();
    instance = env.emailEnabled && !env.isTest ? new RoutingProvider(new ResendProvider(), local) : local;
    if (!env.emailEnabled && !env.isTest) logger.warn('RESEND_API_KEY is empty: emails are printed to the console.');
  }
  return instance;
}
