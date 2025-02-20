-- CreateTable
CREATE TABLE `Chat` (
    `id` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `visibility` ENUM('public', 'private') NOT NULL DEFAULT 'private',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` CHAR(36) NOT NULL,
    `chatId` CHAR(36) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vote` (
    `chatId` CHAR(36) NOT NULL,
    `messageId` CHAR(36) NOT NULL,
    `isUpvoted` BOOLEAN NOT NULL,

    PRIMARY KEY (`chatId`, `messageId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NULL,
    `kind` ENUM('text', 'code', 'image', 'sheet') NOT NULL DEFAULT 'text',
    `userId` CHAR(36) NOT NULL,

    PRIMARY KEY (`id`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Suggestion` (
    `id` CHAR(36) NOT NULL,
    `documentId` CHAR(36) NOT NULL,
    `documentCreatedAt` DATETIME(3) NOT NULL,
    `originalText` VARCHAR(191) NOT NULL,
    `suggestedText` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `userId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_chatId_fkey` FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vote` ADD CONSTRAINT `Vote_chatId_fkey` FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vote` ADD CONSTRAINT `Vote_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Suggestion` ADD CONSTRAINT `Suggestion_documentId_documentCreatedAt_fkey` FOREIGN KEY (`documentId`, `documentCreatedAt`) REFERENCES `Document`(`id`, `createdAt`) ON DELETE RESTRICT ON UPDATE CASCADE;
