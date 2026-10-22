-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `name` VARCHAR(200) NULL,
    `googleId` VARCHAR(64) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `onboardingCompletedAt` DATETIME(3) NULL,
    `matchesPerDay` INTEGER NOT NULL DEFAULT 5,
    `notifyNewMatches` BOOLEAN NOT NULL DEFAULT true,
    `notifyAppUpdates` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_googleId_key`(`googleId`),
    INDEX `User_deletedAt_idx`(`deletedAt`),
    INDEX `User_onboardingCompletedAt_idx`(`onboardingCompletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpCode` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `codeHash` VARCHAR(128) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OtpCode_email_createdAt_idx`(`email`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `userAgent` VARCHAR(400) NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cv` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fileKey` VARCHAR(400) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mime` VARCHAR(120) NOT NULL,
    `size` INTEGER NOT NULL,
    `rawText` LONGTEXT NOT NULL,
    `parsedJson` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Cv_userId_isActive_idx`(`userId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profile` (
    `userId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(200) NOT NULL DEFAULT '',
    `email` VARCHAR(320) NOT NULL DEFAULT '',
    `phone` VARCHAR(40) NULL,
    `location` VARCHAR(200) NOT NULL DEFAULT '',
    `headline` VARCHAR(200) NOT NULL DEFAULT '',
    `summary` TEXT NOT NULL DEFAULT '',
    `experienceJson` JSON NOT NULL,
    `educationJson` JSON NOT NULL,
    `skillsJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Preferences` (
    `userId` VARCHAR(191) NOT NULL,
    `rolesJson` JSON NOT NULL,
    `location` VARCHAR(200) NOT NULL DEFAULT '',
    `radiusMiles` INTEGER NOT NULL DEFAULT 15,
    `workStylesJson` JSON NOT NULL,
    `minSalary` INTEGER NULL,
    `rightToWorkUk` BOOLEAN NOT NULL DEFAULT true,
    `needsSponsorship` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Job` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `company` VARCHAR(200) NOT NULL,
    `location` VARCHAR(200) NOT NULL,
    `workMode` ENUM('remote', 'hybrid', 'onsite') NOT NULL,
    `workModeDetail` VARCHAR(200) NULL,
    `salaryMin` INTEGER NULL,
    `salaryMax` INTEGER NULL,
    `description` TEXT NOT NULL,
    `requirementsJson` JSON NOT NULL,
    `applyRoute` ENUM('email', 'form', 'site') NOT NULL,
    `applyUrl` VARCHAR(1000) NULL,
    `applyEmail` VARCHAR(320) NULL,
    `formSchemaJson` JSON NULL,
    `postedAt` DATETIME(3) NOT NULL,
    `rawJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Job_postedAt_idx`(`postedAt`),
    UNIQUE INDEX `Job_provider_externalId_key`(`provider`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Match` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `reasonsJson` JSON NOT NULL,
    `reasonLine` VARCHAR(400) NOT NULL,
    `status` ENUM('new', 'viewed', 'skipped', 'saved', 'applied') NOT NULL DEFAULT 'new',
    `matchedOn` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Match_userId_matchedOn_idx`(`userId`, `matchedOn`),
    INDEX `Match_jobId_idx`(`jobId`),
    UNIQUE INDEX `Match_userId_jobId_key`(`userId`, `jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `type` ENUM('cv', 'cover_letter') NOT NULL,
    `blocksJson` JSON NOT NULL,
    `editedByUser` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `promptVersion` VARCHAR(40) NOT NULL DEFAULT 'template-1',
    `pdfKey` VARCHAR(400) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Document_matchId_idx`(`matchId`),
    UNIQUE INDEX `Document_matchId_type_key`(`matchId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FormAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `label` VARCHAR(400) NOT NULL,
    `value` TEXT NOT NULL DEFAULT '',
    `source` ENUM('cv', 'profile', 'ai', 'user') NOT NULL,
    `needsAttention` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `multiline` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FormAnswer_matchId_idx`(`matchId`),
    UNIQUE INDEX `FormAnswer_matchId_key_key`(`matchId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Application` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `route` ENUM('email', 'form', 'site') NOT NULL,
    `status` ENUM('approved', 'applied', 'viewed', 'interview', 'offer', 'rejected', 'withdrawn') NOT NULL DEFAULT 'approved',
    `approvedAt` DATETIME(3) NOT NULL,
    `scheduledSendAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `undoneAt` DATETIME(3) NULL,
    `sendError` VARCHAR(400) NULL,
    `notes` TEXT NOT NULL DEFAULT '',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Application_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Application_userId_status_idx`(`userId`, `status`),
    INDEX `Application_matchId_idx`(`matchId`),
    INDEX `Application_jobId_idx`(`jobId`),
    INDEX `Application_status_scheduledSendAt_idx`(`status`, `scheduledSendAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `label` VARCHAR(400) NOT NULL,
    `detail` VARCHAR(1000) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApplicationEvent_applicationId_occurredAt_idx`(`applicationId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(80) NOT NULL,
    `metaJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AuditLog_userId_idx`(`userId`),
    INDEX `AuditLog_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cv` ADD CONSTRAINT `Cv_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Preferences` ADD CONSTRAINT `Preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `Job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormAnswer` ADD CONSTRAINT `FormAnswer_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `Job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationEvent` ADD CONSTRAINT `ApplicationEvent_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
