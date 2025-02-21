/*
  Warnings:

  - A unique constraint covering the columns `[type]` on the table `Prompt` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Prompt_type_key` ON `Prompt`(`type`);
