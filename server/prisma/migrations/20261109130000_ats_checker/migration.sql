-- CreateTable
CREATE TABLE `AtsCheck` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NULL,
    `cvSource` VARCHAR(20) NOT NULL,
    `cvFileName` VARCHAR(255) NOT NULL,
    `cvText` LONGTEXT NOT NULL,
    `profileJson` JSON NOT NULL,
    `jobSource` VARCHAR(20) NOT NULL,
    `jobTitle` VARCHAR(200) NULL,
    `company` VARCHAR(200) NULL,
    `jobText` TEXT NULL,
    `initialScore` INTEGER NOT NULL,
    `stateJson` JSON NOT NULL,
    `copyJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AtsCheck_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AtsCheck_matchId_idx`(`matchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AtsCheck` ADD CONSTRAINT `AtsCheck_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AtsCheck` ADD CONSTRAINT `AtsCheck_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
