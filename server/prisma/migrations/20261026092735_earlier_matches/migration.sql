-- AlterTable
ALTER TABLE `Match` ADD COLUMN `startedAt` DATETIME(3) NULL;

-- Matches are no longer marked "expired" after 14 days: they stay under Earlier until the retention purge.
UPDATE `Match` SET `status` = 'viewed' WHERE `status` = 'expired';
