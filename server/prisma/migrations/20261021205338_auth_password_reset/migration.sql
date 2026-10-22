-- AlterTable
ALTER TABLE `Match` MODIFY `status` ENUM('new', 'viewed', 'skipped', 'saved', 'applied', 'expired') NOT NULL DEFAULT 'new';

-- AlterTable
ALTER TABLE `User` ADD COLUMN `failedSignins` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastFailedSigninAt` DATETIME(3) NULL,
    ADD COLUMN `lockedUntil` DATETIME(3) NULL,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NULL,
    ADD COLUMN `passwordHash` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
