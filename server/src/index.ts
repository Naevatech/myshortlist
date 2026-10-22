import cron from 'node-cron';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';
import { runDailyMatches } from './jobs/dailyMatches.js';
import { processScheduledSends } from './jobs/processScheduledSends.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Shortlist API listening on ${env.API_URL} (job provider: ${env.JOB_PROVIDER})`);
});

/**
 * Scheduled jobs. In development they run in this process. In production the same jobs are triggered by
 * POST /api/cron/daily-matches and /api/cron/process-sends with the x-cron-secret header (or keep this
 * process running as a worker).
 */
if (env.runScheduler) {
  let sending = false;
  cron.schedule('*/5 * * * * *', async () => {
    if (sending) return;
    sending = true;
    try {
      await processScheduledSends();
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'processScheduledSends failed');
    } finally {
      sending = false;
    }
  });
  cron.schedule(
    `0 ${env.DAILY_MATCH_HOUR} * * *`,
    () => {
      runDailyMatches().catch((err) => logger.error({ err: (err as Error).message }, 'daily matches failed'));
    },
    { timezone: 'Europe/London' },
  );
}

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
