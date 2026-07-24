-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "tone" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "audioPath" TEXT,
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'text';

-- AlterTable
ALTER TABLE "Persona" ADD COLUMN     "voice" TEXT NOT NULL DEFAULT 'amy';

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Changelog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT 'New',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Changelog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "Changelog_published_createdAt_idx" ON "Changelog"("published", "createdAt");
