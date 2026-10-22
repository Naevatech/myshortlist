import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

// Tests run against a separate database: TEST_DATABASE_URL, or DATABASE_URL with the name "shortlist_test".
const fileEnv = fs.existsSync(path.resolve(__dirname, '.env')) ? dotenv.parse(fs.readFileSync(path.resolve(__dirname, '.env'))) : {};
const base = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL ?? 'mysql://root:password@localhost:3306/shortlist';
const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(base);
// Never run the resetting test suite against a remote server unless TEST_DATABASE_URL asks for it.
const testUrl =
  process.env.TEST_DATABASE_URL ??
  (isLocal ? base.replace(/\/[^/?]+(\?|$)/, '/shortlist_test$1') : 'mysql://root:@localhost:3306/shortlist_test');
process.env.SHORTLIST_TEST_DATABASE_URL = testUrl; // read by test/globalSetup.ts

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    // Tests never call real job APIs, whatever server/.env says.
    env: { NODE_ENV: 'test', JOB_PROVIDER: 'placeholder', DATABASE_URL: testUrl, UNDO_WINDOW_SECONDS: '10', OTP_MAX_ATTEMPTS: '5', UPLOAD_DIR: './uploads-test' },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
