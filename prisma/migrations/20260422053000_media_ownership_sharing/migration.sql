-- CreateEnum
CREATE TYPE "MediaObjectType" AS ENUM ('FILE', 'FOLDER');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN "emailNormalized" TEXT;

-- CreateTable
CREATE TABLE "MediaObject" (
    "id" TEXT NOT NULL,
    "ghlId" TEXT NOT NULL,
    "type" "MediaObjectType" NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "parentId" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "raw" JSONB,
    "ghlCreatedAt" TIMESTAMP(3),
    "ghlUpdatedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaShare" (
    "id" TEXT NOT NULL,
    "mediaObjectId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedWithId" TEXT,
    "sharedWithEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_emailNormalized_key" ON "AppUser"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "MediaObject_ghlId_key" ON "MediaObject"("ghlId");

-- CreateIndex
CREATE INDEX "MediaObject_ownerId_parentId_isDeleted_idx" ON "MediaObject"("ownerId", "parentId", "isDeleted");

-- CreateIndex
CREATE INDEX "MediaObject_parentId_idx" ON "MediaObject"("parentId");

-- CreateIndex
CREATE INDEX "MediaObject_type_idx" ON "MediaObject"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MediaShare_mediaObjectId_sharedWithEmail_key" ON "MediaShare"("mediaObjectId", "sharedWithEmail");

-- CreateIndex
CREATE INDEX "MediaShare_sharedWithEmail_idx" ON "MediaShare"("sharedWithEmail");

-- CreateIndex
CREATE INDEX "MediaShare_sharedWithId_idx" ON "MediaShare"("sharedWithId");

-- AddForeignKey
ALTER TABLE "MediaObject" ADD CONSTRAINT "MediaObject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaObject" ADD CONSTRAINT "MediaObject_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MediaObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaShare" ADD CONSTRAINT "MediaShare_mediaObjectId_fkey" FOREIGN KEY ("mediaObjectId") REFERENCES "MediaObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaShare" ADD CONSTRAINT "MediaShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaShare" ADD CONSTRAINT "MediaShare_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
