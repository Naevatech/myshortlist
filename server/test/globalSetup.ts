import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Resets the test database to the committed migrations before the suite runs. */
export default function setup() {
  const url = process.env.SHORTLIST_TEST_DATABASE_URL;
  if (!url || !/shortlist_test|_test\b/.test(url)) throw new Error('Refusing to reset a database that is not a test database.');
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  return () => fs.rmSync(path.resolve(__dirname, '../uploads-test'), { recursive: true, force: true });
}
